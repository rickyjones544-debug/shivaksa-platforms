#!/usr/bin/env python3
"""AGI: authorize a customer-platform outbound call.

Called from context [from-shivaksa-customer-platform] for every INVITE that
arrives on a managed customer endpoint. Asks the platform whether the call is
allowed and which carrier endpoint/dial string/caller ID to use.

ARG1 = authenticated endpoint name (= SIP username)
ARG2 = dialed destination (raw)
ARG3 = channel name (for later hangup requests)
"""

import json
import re
import sys
import urllib.request
import urllib.error

CONFIG_PATH = "/etc/shivaksa-gateway/agent.env"


def load_env(path):
    env = {}
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    env[key.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        pass
    return env


ENV = load_env(CONFIG_PATH)
PLATFORM = ENV.get("PLATFORM_API_URL", "https://app.shivaksatechnology.com").rstrip("/")
API_KEY = ENV.get("GATEWAY_API_KEY", "")


def read_agi_env():
    env = {}
    for line in sys.stdin:
        line = line.strip()
        if not line:
            break
        key, _, value = line.partition(":")
        env[key.strip()] = value.strip()
    return env


def agi(command):
    sys.stdout.write(command + "\n")
    sys.stdout.flush()
    sys.stdin.readline()


def setvar(name, value):
    safe = str(value).replace('"', "").replace("\n", " ")[:200]
    agi('SET VARIABLE %s "%s"' % (name, safe))


def fail(cause):
    setvar("SHV_AUTHORIZED", "0")
    setvar("SHV_CAUSE", cause)
    setvar("SHV_REASON", "unauthorized")


def main():
    env = read_agi_env()
    username = env.get("agi_arg_1", "")
    destination = env.get("agi_arg_2", "")
    channel = env.get("agi_arg_3", "")

    if not API_KEY or not username or not destination:
        fail(21)
        return

    payload = {"username": username, "destination": destination, "channel": channel}
    req = urllib.request.Request(
        PLATFORM + "/api/internal/gateway/authorize",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"x-gateway-api-key": API_KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = json.loads(res.read().decode() or "{}")
    except (urllib.error.URLError, OSError, ValueError):
        # Fail closed: never let an unverifiable call through.
        fail(34)
        return

    data = body.get("data") or {}
    if data.get("authorized") is not True:
        setvar("SHV_AUTHORIZED", "0")
        setvar("SHV_CAUSE", data.get("hangupCause", 21))
        setvar("SHV_REASON", data.get("reason", "rejected"))
        return

    setvar("SHV_AUTHORIZED", "1")
    setvar("SHV_CALLID", data["gatewayCallId"])
    setvar("SHV_ORGID", data["organizationId"])
    setvar("SHV_ENDPOINT", data["carrierEndpoint"])
    setvar("SHV_DIALSTRING", data["dialString"])
    setvar("SHV_CALLERID", data["callerId"])
    setvar("SHV_MAXSEC", data["maxDurationSeconds"])


if __name__ == "__main__":
    main()
