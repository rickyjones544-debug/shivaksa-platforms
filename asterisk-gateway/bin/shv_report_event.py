#!/usr/bin/env python3
"""Report a call lifecycle event to the platform.

Usage:
  shv_report_event.py ringing   <gatewayCallId> <organizationId>
  shv_report_event.py answered  <gatewayCallId> <organizationId>
  shv_report_event.py final     <gatewayCallId> <organizationId> <dialstatus> <hangupcause> <billsec>
"""

import json
import sys
import urllib.request
import urllib.error

CONFIG_PATH = "/etc/shivaksa-gateway/agent.env"

FINAL_MAP = {
    "ANSWER": ("call.completed", None),
    "BUSY": ("call.busy", 486),
    "NOANSWER": ("call.no_answer", 480),
    "CANCEL": ("call.cancelled", 487),
    "CONGESTION": ("call.failed", 503),
    "CHANUNAVAIL": ("call.failed", 503),
}


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


def main():
    env = load_env(CONFIG_PATH)
    platform = env.get("PLATFORM_API_URL", "https://app.shivaksatechnology.com").rstrip("/")
    api_key = env.get("GATEWAY_API_KEY", "")
    if not api_key or len(sys.argv) < 3:
        return

    kind = sys.argv[1]
    call_id = sys.argv[2]
    org_id = sys.argv[3] if len(sys.argv) > 3 else ""

    event = {"gatewayCallId": call_id, "organizationId": org_id}

    if kind == "ringing":
        event["eventType"] = "call.ringing"
    elif kind == "answered":
        event["eventType"] = "call.answered"
    elif kind == "final":
        dialstatus = (sys.argv[4] if len(sys.argv) > 4 else "").upper()
        try:
            hangupcause = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] else None
        except ValueError:
            hangupcause = None
        try:
            billsec = int(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] else 0
        except ValueError:
            billsec = 0

        event_type, default_code = FINAL_MAP.get(dialstatus, ("call.failed", None))
        event["eventType"] = event_type
        if event_type == "call.completed":
            event["durationSeconds"] = billsec
        if hangupcause and 100 <= hangupcause <= 699:
            event["sipResponseCode"] = hangupcause
        elif default_code:
            event["sipResponseCode"] = default_code
        if event_type not in ("call.completed",):
            event["failureReason"] = "DIALSTATUS=%s" % (dialstatus or "UNKNOWN")
    else:
        return

    req = urllib.request.Request(
        platform + "/api/internal/gateway/events",
        data=json.dumps(event).encode(),
        method="POST",
        headers={"x-gateway-api-key": api_key, "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=15).read()
    except (urllib.error.URLError, OSError):
        pass


if __name__ == "__main__":
    main()
