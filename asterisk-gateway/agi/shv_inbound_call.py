#!/usr/bin/env python3
"""AGI: authorize a carrier inbound DID call and find the target SIP endpoint.

Called from [from-telnyx] (or another carrier inbound context) for every
inbound INVITE. Asks the platform which SIP account owns the dialed DID and
returns the Asterisk endpoint name to dial.

ARG1 = dialed destination (DID, E.164)
ARG2 = caller ID (From number)
ARG3 = provider call id (PJSIP call-id of the carrier leg)
"""

import json
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


def fail(reason):
    setvar("SHV_INBOUND_OK", "0")
    setvar("SHV_INBOUND_REASON", reason)


def main():
    env = read_agi_env()
    destination = env.get("agi_arg_1", "")
    caller_id = env.get("agi_arg_2", "")
    provider_call_id = env.get("agi_arg_3", "")

    if not API_KEY or not destination:
        fail("unauthorized")
        return

    payload = {
        "destination": destination,
        "callerId": caller_id,
        "providerCallId": provider_call_id,
        "provider": "telnyx",
    }
    req = urllib.request.Request(
        PLATFORM + "/api/internal/gateway/authorize-inbound",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"x-gateway-api-key": API_KEY, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            body = json.loads(res.read().decode() or "{}")
    except (urllib.error.URLError, OSError, ValueError):
        # Fail closed: never let an unverifiable inbound call through.
        fail("gateway-unreachable")
        return

    data = body.get("data") or {}
    if data.get("authorized") is not True:
        fail(data.get("reason", "rejected"))
        return

    setvar("SHV_INBOUND_OK", "1")
    setvar("SHV_INBOUND_ENDPOINT", data["asteriskEndpoint"])
    setvar("SHV_CALLID", data["gatewayCallId"])
    setvar("SHV_ORGID", data["organizationId"])


if __name__ == "__main__":
    main()
