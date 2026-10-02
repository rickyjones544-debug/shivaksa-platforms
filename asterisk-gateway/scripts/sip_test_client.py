#!/usr/bin/env python3
"""Minimal SIP UDP client for Phase 2 acceptance testing.

Registers with digest auth, then places one INVITE, reporting SIP status codes.
Never logs the password.
"""
import hashlib
import json
import re
import socket
import sys
import time

SERVER = "82.152.141.69"
PORT = 5060
DEST = sys.argv[1] if len(sys.argv) else "+30123456789"

creds = json.load(open("/tmp/sip_test_credentials.json"))
USER = creds["username"]
PASSWORD = creds["password"]

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.settimeout(6)
local_ip = sock.getsockname()[0] if True else ""
sock.bind(("0.0.0.0", 0))
lport = sock.getsockname()[1]

CSEQ = 0
CALL_TAG = hashlib.md5(str(time.time()).encode()).hexdigest()[:10]
BRANCH = "z9hG4bK" + hashlib.md5(str(time.time()).encode()).hexdigest()[:12]


def md5(s):
    return hashlib.md5(s.encode()).hexdigest()


def build(method, uri, auth_hdr=None, extra=""):
    global CSEQ
    CSEQ += 1
    msg = (
        f"{method} {uri} SIP/2.0\r\n"
        f"Via: SIP/2.0/UDP 127.0.0.1:{lport};branch={BRANCH}{CSEQ};rport\r\n"
        f"Max-Forwards: 70\r\n"
        f"From: <sip:{USER}@82.152.141.69>;tag={CALL_TAG}\r\n"
        f"To: <sip:{uri.split(' ')[0].split(':')[1].split('@')[0]}@82.152.141.69>\r\n"
        f"Call-ID: {CALL_TAG}@shvtest\r\n"
        f"CSeq: {CSEQ} {method}\r\n"
        f"Contact: <sip:{USER}@127.0.0.1:{lport}>\r\n"
    )
    if auth_hdr:
        msg += auth_hdr
    msg += f"Content-Length: 0\r\n{extra}\r\n"
    return msg


def parse_challenge(resp):
    m = re.search(r"(WWW-Authenticate|Proxy-Authenticate):\s*Digest\s+(.*)", resp, re.I)
    if not m:
        return None, None
    header_name = "Authorization" if m.group(1).lower().startswith("www") else "Proxy-Authorization"
    params = dict(re.findall(r'(\w+)="([^"]*)"', m.group(2)))
    return header_name, params


def digest_auth(method, uri, params):
    realm = params.get("realm", "asterisk")
    nonce = params["nonce"]
    ha1 = md5(f"{USER}:{realm}:{PASSWORD}")
    ha2 = md5(f"{method}:{uri}")
    resp = md5(f"{ha1}:{nonce}:{ha2}")
    return (
        f'realm="{realm}", nonce="{nonce}", uri="{uri}", '
        f'username="{USER}", response="{resp}", algorithm=MD5'
    )


def transact(msg, name):
    sock.sendto(msg.encode(), (SERVER, PORT))
    while True:
        try:
            data, _ = sock.recvfrom(65535)
        except socket.timeout:
            return None
        text = data.decode("utf-8", "replace")
        m = re.search(r"SIP/2\.0 (\d+)", text)
        if not m:
            # Inbound request (e.g. OPTIONS qualify) — answer 200 OK.
            if text.startswith("OPTIONS"):
                via = re.search(r"Via: ([^\r\n]+)", text)
                callid = re.search(r"Call-ID: ([^\r\n]+)", text)
                cseq = re.search(r"CSeq: ([^\r\n]+)", text)
                frm = re.search(r"From: ([^\r\n]+)", text)
                to = re.search(r"To: ([^\r\n]+)", text)
                if all([via, callid, cseq, frm, to]):
                    ok = (
                        "SIP/2.0 200 OK\r\n"
                        f"Via: {via.group(1)}\r\n"
                        f"From: {frm.group(1)}\r\n"
                        f"To: {to.group(1)};tag={CALL_TAG}\r\n"
                        f"Call-ID: {callid.group(1)}\r\n"
                        f"CSeq: {cseq.group(1)}\r\n"
                        "Content-Length: 0\r\n\r\n"
                    )
                    sock.sendto(ok.encode(), (SERVER, PORT))
            continue
        code = int(m.group(1))
        if code < 200:
            print(f"  [{name}] provisional {code}")
            continue
        print(f"  [{name}] final {code}")
        return text


def do_register():
    uri = "sip:82.152.141.69"
    resp = transact(build("REGISTER", uri), "REGISTER")
    if resp is None:
        print("REGISTER_TIMEOUT")
        return False
    if "SIP/2.0 200" in resp:
        return True
    header_name, params = parse_challenge(resp)
    if not params:
        return False
    auth = f"{header_name}: Digest {digest_auth('REGISTER', uri, params)}\r\n"
    resp = transact(build("REGISTER", uri, auth), "REGISTER+auth")
    return bool(resp and "SIP/2.0 200" in resp)


def do_invite():
    uri = f"sip:{DEST}@82.152.141.69"
    resp = transact(build("INVITE", uri), "INVITE")
    if resp is None:
        print("INVITE_TIMEOUT")
        return
    if not re.search(r"SIP/2\.0 (401|407)", resp):
        report_final(resp)
        return
    header_name, params = parse_challenge(resp)
    auth = f"{header_name}: Digest {digest_auth('INVITE', uri, params)}\r\n"
    resp = transact(build("INVITE", uri, auth), "INVITE+auth")
    if resp:
        report_final(resp)


def report_final(resp):
    code = int(re.search(r"SIP/2\.0 (\d+)", resp).group(1))
    print(f"CALL_RESULT={code}")
    if code < 400:
        # Politely end: send CANCEL/BYE for answered/in-progress calls.
        bye_uri = f"sip:{DEST}@82.152.141.69"
        sock.sendto(build("BYE", bye_uri).encode(), (SERVER, PORT))


print(f"== REGISTER {USER} ==")
if do_register():
    print("REGISTER_OK")
    time.sleep(2)
    print(f"== INVITE {DEST} ==")
    do_invite()
else:
    print("REGISTER_FAILED")
sock.close()
