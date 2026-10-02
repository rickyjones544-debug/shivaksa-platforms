#!/usr/bin/env bash
# Install the Shivaksa gateway agent on the Asterisk VPS.
# Safe: installs ONLY new files — never modifies existing Asterisk config.
# The two #include lines must be appended to pjsip.conf/extensions.conf
# manually (see README).
set -euo pipefail

cd "$(dirname "$0")"

install -m 0755 bin/shv_gateway_agent.py /usr/local/bin/shv_gateway_agent.py
install -m 0755 bin/shv_report_event.py /usr/local/bin/shv_report_event.py

# AGI scripts live in Asterisk's configured agi-bin directory. On Debian
# packages this is /usr/share/asterisk/agi-bin; discover it and fall back.
AGI_BIN="$(asterisk -rx 'core show settings' 2>/dev/null | awk -F': *' '/AGI.*[Dd]ir/{print $2; exit}')"
AGI_BIN="${AGI_BIN:-/usr/share/asterisk/agi-bin}"
mkdir -p "$AGI_BIN"
install -m 0755 agi/shv_customer_call.py "$AGI_BIN/shv_customer_call.py"

# agent.env holds the gateway API key. The AGI/report scripts run as the
# asterisk user, so the env dir/file must be group-readable by asterisk.
mkdir -p /etc/shivaksa-gateway /var/lib/shivaksa-gateway/endpoints
chown root:asterisk /etc/shivaksa-gateway
chmod 0750 /etc/shivaksa-gateway
if [ ! -f /etc/shivaksa-gateway/agent.env ]; then
  install -m 0640 -o root -g asterisk agent.env.example /etc/shivaksa-gateway/agent.env
  echo "NOTE: fill in GATEWAY_API_KEY in /etc/shivaksa-gateway/agent.env"
else
  chown root:asterisk /etc/shivaksa-gateway/agent.env
  chmod 0640 /etc/shivaksa-gateway/agent.env
fi

# Managed include: install only if absent (the agent rewrites it afterward).
if [ ! -f /etc/asterisk/pjsip_customer_platform.conf ]; then
  install -m 0644 asterisk/pjsip_customer_platform.conf /etc/asterisk/pjsip_customer_platform.conf
fi
install -m 0644 asterisk/extensions_customer_platform.conf /etc/asterisk/extensions_customer_platform.conf

install -m 0644 systemd/shv-gateway-agent.service /etc/systemd/system/shv-gateway-agent.service
install -m 0644 systemd/shv-sweep-reservations.service /etc/systemd/system/shv-sweep-reservations.service
install -m 0644 systemd/shv-sweep-reservations.timer /etc/systemd/system/shv-sweep-reservations.timer
systemctl daemon-reload

echo "Done. Next: append the two #include lines (see README), create agent.env,"
echo "then: systemctl enable --now shv-gateway-agent shv-sweep-reservations.timer"
