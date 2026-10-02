#!/usr/bin/env python3
"""Shivaksa Asterisk gateway agent.

Polls the platform for provisioning tasks, renders the isolated
pjsip_customer_platform.conf include, reloads res_pjsip, and reports results.
Also reports contact/registration state and triggers the reservation sweeper.

Outbound HTTPS only. Never touches any Asterisk config file other than the
managed customer-platform include.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import urllib.error

CONFIG_PATH = "/etc/shivaksa-gateway/agent.env"
STATE_DIR = "/var/lib/shivaksa-gateway/endpoints"
PJSIP_FILE = "/etc/asterisk/pjsip_customer_platform.conf"
POLL_SECONDS = 3
REG_SECONDS = 60
SWEEP_SECONDS = 300


def load_env(path):
    env = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                env[key.strip()] = value.strip().strip('"').strip("'")
    return env


ENV = load_env(CONFIG_PATH)
PLATFORM = ENV.get("PLATFORM_API_URL", "https://app.shivaksatechnology.com").rstrip("/")
API_KEY = ENV.get("GATEWAY_API_KEY", "")
REALM = ENV.get("ASTERISK_REALM", "asterisk")

if not API_KEY:
    sys.stderr.write("GATEWAY_API_KEY missing from %s\n" % CONFIG_PATH)
    sys.exit(1)


def api(method, path, payload=None):
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        PLATFORM + path,
        data=body,
        method=method,
        headers={
            "x-gateway-api-key": API_KEY,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            return res.status, json.loads(res.read().decode() or "{}")
    except urllib.error.HTTPError as exc:
        return exc.code, {"error": "http_%d" % exc.code}
    except Exception as exc:  # noqa: BLE001 - agent must stay alive
        return 0, {"error": str(exc)[:200]}


def asterisk(*args):
    return subprocess.run(
        ["asterisk", "-rx", " ".join(args)],
        capture_output=True, text=True, timeout=30,
    ).stdout


def endpoint_stanza(username, md5_cred):
    """endpoint + auth + aor triple. identify_by supports dynamic customer IPs:
    the endpoint is resolved from the digest/From username, never a fixed IP."""
    return (
        "\n[%(u)s]\n"
        "type=endpoint\n"
        "transport=shivaksa-udp\n"
        "context=from-shivaksa-customer-platform\n"
        "disallow=all\n"
        "allow=ulaw\n"
        "allow=alaw\n"
        "direct_media=no\n"
        "rewrite_contact=yes\n"
        "rtp_symmetric=yes\n"
        "force_rport=yes\n"
        "dtmf_mode=rfc4733\n"
        "timers=yes\n"
        "auth=%(u)s-auth\n"
        "aors=%(u)s\n"
        "identify_by=username,auth_username\n"
        "\n[%(u)s]\n"
        "type=aor\n"
        "max_contacts=2\n"
        "remove_existing=yes\n"
        "qualify_frequency=30\n"
        "qualify_timeout=4\n"
        "\n[%(u)s-auth]\n"
        "type=auth\n"
        "auth_type=md5\n"
        "username=%(u)s\n"
        "realm=%(r)s\n"
        "md5_cred=%(m)s\n"
    ) % {"u": username, "r": REALM, "m": md5_cred}


def render_config():
    """Rewrite the managed include from the state dir. Idempotent: the file is
    fully regenerated from endpoint JSON state each time."""
    os.makedirs(STATE_DIR, exist_ok=True)
    parts = [
        "; MANAGED BY shv-gateway-agent — do not edit by hand.\n"
        "; Customer SIP platform endpoints (Phase 2). Existing production\n"
        "; endpoints live in their own include files and are not touched.\n"
    ]
    for name in sorted(os.listdir(STATE_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(STATE_DIR, name)) as fh:
            state = json.load(fh)
        parts.append(endpoint_stanza(state["username"], state["md5Cred"]))
    tmp = PJSIP_FILE + ".tmp"
    with open(tmp, "w") as fh:
        fh.write("".join(parts))
    os.replace(tmp, PJSIP_FILE)


def reload_pjsip():
    out = asterisk("module reload res_pjsip.so")
    return "reloaded" in out.lower() or "module res_pjsip" in out.lower() or out == ""


def apply_task(task):
    action = task.get("action")
    payload = task.get("payload") or {}

    if action == "UPSERT_ENDPOINT":
        username = payload.get("username")
        md5_cred = payload.get("md5Cred")
        if not username or not re.fullmatch(r"shv_[a-z0-9]{8,32}", username):
            return False, "invalid username"
        if not md5_cred or not re.fullmatch(r"[0-9a-f]{32}", md5_cred):
            return False, "invalid md5Cred"
        with open(os.path.join(STATE_DIR, username + ".json"), "w") as fh:
            json.dump({"username": username, "md5Cred": md5_cred}, fh)
        render_config()
        if not reload_pjsip():
            return False, "res_pjsip reload failed"
        return True, None

    if action == "DISABLE_ENDPOINT":
        username = payload.get("username")
        if not username or not re.fullmatch(r"shv_[a-z0-9]{8,32}", username):
            return False, "invalid username"
        state_path = os.path.join(STATE_DIR, username + ".json")
        if os.path.exists(state_path):
            os.remove(state_path)
        render_config()
        if not reload_pjsip():
            return False, "res_pjsip reload failed"
        return True, None

    if action == "HANGUP_CALL":
        channel = payload.get("channel")
        if not channel or not re.fullmatch(r"[A-Za-z0-9_.:;/@+-]{1,128}", channel):
            return False, "invalid channel"
        # Only hang up channels belonging to managed customer endpoints.
        if not channel.startswith("PJSIP/shv_"):
            return False, "channel not managed"
        asterisk("channel request hangup " + channel)
        return True, None

    return False, "unknown action"


def report_registrations():
    """Snapshot contact state for managed endpoints and report upstream."""
    if not os.path.isdir(STATE_DIR):
        return
    usernames = [n[:-5] for n in os.listdir(STATE_DIR) if n.endswith(".json")]
    if not usernames:
        return
    contacts_out = asterisk("pjsip show contacts")
    # Lines look like: Contact:  shv_x/sip:shv_x@1.2.3.4:5060  <hash>  Unknown  ...
    registered = {}
    for line in contacts_out.splitlines():
        m = re.match(r"\s*Contact:\s+([A-Za-z0-9_.-]+)/(\S+)\s+\S+\s+(\S+)", line)
        if m and m.group(1).startswith("shv_"):
            registered.setdefault(m.group(1), {"uri": m.group(2), "status": m.group(3)})
    entries = []
    for username in usernames:
        contact = registered.get(username)
        entries.append(
            {
                "username": username,
                "registered": contact is not None and contact["status"] not in ("Unavailable",),
                "contactAddress": contact["uri"] if contact else None,
            }
        )
    api("POST", "/api/internal/gateway/registration", {"registrations": entries})


def run_sweep():
    api("POST", "/api/internal/jobs/sweep-reservations")


def main():
    last_reg = 0.0
    last_sweep = time.monotonic() - SWEEP_SECONDS + 30  # first sweep ~30s in
    while True:
        status, body = api("GET", "/api/internal/gateway/provisioning/pending?limit=20")
        if status == 200:
            for task in (body.get("data") or {}).get("tasks") or []:
                ok, error = apply_task(task)
                api(
                    "POST",
                    "/api/internal/gateway/provisioning/result",
                    {"taskId": task["id"], "ok": ok, **({"error": error} if error else {})},
                )
        now = time.monotonic()
        if now - last_reg >= REG_SECONDS:
            last_reg = now
            try:
                report_registrations()
            except Exception:  # noqa: BLE001
                pass
        if now - last_sweep >= SWEEP_SECONDS:
            last_sweep = now
            try:
                run_sweep()
            except Exception:  # noqa: BLE001
                pass
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
