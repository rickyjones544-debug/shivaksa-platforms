# Shivaksa Asterisk Gateway Agent (Phase 2)

Customer SIP path:

    Customer softphone --REGISTER/INVITE--> 82.152.141.69:5060/UDP
      -> Asterisk (shivaksa-udp transport, pjsip_customer_platform.conf)
      -> AGI authorize -> PLATFORM_API_URL/api/internal/gateway/authorize
      -> Dial(PJSIP/<dialString>@<carrierEndpoint>) -> upstream carrier
      -> hangup handler -> POST /api/internal/gateway/events -> billing/CDR

The platform never connects to this host. This agent polls the platform
(outbound only) and applies endpoint changes to an isolated, generated
include file. The SIP plaintext password never reaches this host — endpoint
auth is delivered as `md5(username:realm:password)` (`auth_type=md5`).

## Components

| File (repo)                              | Installs to                                   | Purpose |
|------------------------------------------|-----------------------------------------------|---------|
| `bin/shv_gateway_agent.py`               | `/usr/local/bin/`                             | Polls provisioning tasks, renders `pjsip_customer_platform.conf`, reports registration state |
| `agi/shv_customer_call.py`               | Asterisk agi-bin (`/usr/share/asterisk/agi-bin/` on Debian) | Per-call authorization against the platform |
| `bin/shv_report_event.py`                | `/usr/local/bin/`                             | Posts call lifecycle events (ringing/answered/final) from the dialplan |
| `asterisk/pjsip_customer_platform.conf`  | `/etc/asterisk/` (generated/managed)          | Customer endpoints — ONLY this file is managed by the agent |
| `asterisk/extensions_customer_platform.conf` | `/etc/asterisk/` (static, deployed once)  | `from-shivaksa-customer-platform` dialplan |
| `systemd/shv-gateway-agent.service`      | `/etc/systemd/system/`                        | Agent service |
| `systemd/shv-sweep-reservations.{service,timer}` | `/etc/systemd/system/`                | Wallet reservation sweeper, every 2 min |
| `agent.env.example`                      | `/etc/shivaksa-gateway/agent.env`             | `PLATFORM_API_URL`, `GATEWAY_API_KEY` |

## Permissions

`/etc/shivaksa-gateway/` is `0750 root:asterisk` and `agent.env` is
`0640 root:asterisk` — the AGI/event scripts run as the `asterisk` user and
must be able to read `GATEWAY_API_KEY`. The agent itself runs as root (it
needs to rewrite the managed include and reload res_pjsip).

## Deploy (manual, operator-run)

```bash
./deploy.sh    # installs scripts + config + systemd units (does NOT touch existing includes)
```

Then, ONE TIME, append the includes to the master configs (keeps the existing
include architecture — the agent never edits pjsip.conf itself):

```bash
echo '#include pjsip_customer_platform.conf'      >> /etc/asterisk/pjsip.conf
echo '#include extensions_customer_platform.conf' >> /etc/asterisk/extensions.conf
asterisk -rx 'module reload res_pjsip.so'
asterisk -rx 'dialplan reload'
```

Create `/etc/shivaksa-gateway/agent.env` with the production `GATEWAY_API_KEY`,
then:

```bash
systemctl enable --now shv-gateway-agent shv-sweep-reservations.timer
```

## Firewall

Customer endpoints authenticate by SIP username/password and register from
dynamic IPs, so `82.152.141.69 5060/udp` must be reachable from anywhere:

```bash
ufw allow to 82.152.141.69 port 5060 proto udp comment "Shivaksa customer SIP platform"
```

Fail2ban's `asterisk` jail already watches for SIP auth abuse — do not widen
any other rule.

## Reservation sweeper

`shv-sweep-reservations.timer` POSTs `/api/internal/jobs/sweep-reservations`
every 2 minutes with `x-gateway-api-key`. If the timer is not used, an
equivalent cron entry works:

```cron
*/2 * * * * curl -sf -X POST "$PLATFORM_API_URL/api/internal/jobs/sweep-reservations" -H "x-gateway-api-key: $GATEWAY_API_KEY"
```

## Acceptance test utilities (scripts/)

- `phase2_acceptance.mjs` — creates a test organization/VoIP service/SIP
  account using the app's own Prisma client + crypto on the VPS.
- `sip_test_setup.mjs` — rotates the test account password, sets caller ID,
  credits the wallet, queues a re-provisioning task. Writes the one-time
  credential to `/tmp/sip_test_credentials.json` — delete it when done.
- `sip_test_client.py` — minimal SIP/UDP client (REGISTER + INVITE with digest
  auth) run on the VPS itself for acceptance testing.

## Safety boundaries

- The agent ONLY writes `/etc/asterisk/pjsip_customer_platform.conf` and its
  state dir `/var/lib/shivaksa-gateway/endpoints/`. Existing files
  (`pjsip_shivaksa.conf`, `pjsip_client01.conf`, `pjsip_twilio.conf`,
  `pjsip_telnyx_client.conf`, transports, extensions_*.conf) are never touched.
- Reloads are limited to `module reload res_pjsip.so` — never a full restart.
