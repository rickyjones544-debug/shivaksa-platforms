'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Inviter,
  Registerer,
  RegistererState,
  Session,
  SessionState,
  UserAgent,
  UserAgentState,
} from 'sip.js';

type Status =
  | 'Initializing'
  | 'Requesting microphone'
  | 'Connecting'
  | 'Registering'
  | 'Registered'
  | 'Calling'
  | 'Ringing'
  | 'Connected'
  | 'Disconnected'
  | 'Failed';

const ECHO_EXTENSION = '6000';

interface SessionConfig {
  wssUrl: string;
  uri: string;
  username: string;
  password: string;
  displayName: string;
  expiresAt: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// sip.js keeps peerConnection on its web SessionDescriptionHandler
// implementation but does not expose it on the public interface.
function getPeerConnection(session: Session): RTCPeerConnection | undefined {
  const sdh = session.sessionDescriptionHandler as
    | { peerConnection?: RTCPeerConnection }
    | undefined;
  return sdh?.peerConnection;
}

export default function VoiceTestClient() {
  const [status, setStatus] = useState<Status>('Initializing');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const userAgentRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const configRef = useRef<SessionConfig | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsed(0);
  }, []);

  const teardownSession = useCallback(() => {
    stopTimer();
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      if (session.state === SessionState.Established) {
        session.bye().catch(() => undefined);
      } else if (session.state === SessionState.Establishing || session.state === SessionState.Initial) {
        (session as Inviter).cancel().catch(() => undefined);
        session.dispose();
      } else {
        session.dispose();
      }
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setMuted(false);
  }, [stopTimer]);

  const teardownAll = useCallback(() => {
    teardownSession();
    const registerer = registererRef.current;
    registererRef.current = null;
    if (registerer && registerer.state === RegistererState.Registered) {
      registerer.unregister().catch(() => undefined);
    }
    const ua = userAgentRef.current;
    userAgentRef.current = null;
    if (ua) {
      ua.stop().catch(() => undefined);
    }
    configRef.current = null;
  }, [teardownSession]);

  const attachRemoteAudio = useCallback((session: Session) => {
    const pc = getPeerConnection(session);
    const audio = audioRef.current;
    if (!pc || !audio) return;

    const stream = new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) stream.addTrack(receiver.track);
    });
    pc.addEventListener('track', (event) => {
      event.streams[0]?.getAudioTracks().forEach((track) => stream.addTrack(track));
    });
    audio.srcObject = stream;
    audio.play().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus('Initializing');
      try {
        const res = await fetch('/api/admin/voice-test/session', {
          method: 'POST',
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Failed to obtain voice test session');
        }
        const config: SessionConfig = json;
        configRef.current = config;

        const uri = UserAgent.makeURI(config.uri);
        if (!uri) throw new Error('Invalid SIP URI in session configuration');
        if (cancelled) return;

        setStatus('Connecting');
        const ua = new UserAgent({
          uri,
          transportOptions: { server: config.wssUrl, traceSip: false },
          authorizationUsername: config.username,
          authorizationPassword: config.password,
          displayName: config.displayName,
          delegate: {
            onDisconnect: (err) => {
              if (!cancelled) {
                setStatus('Failed');
                setError(err ? 'WebSocket connection lost' : 'Disconnected');
              }
            },
          },
        });
        userAgentRef.current = ua;

        ua.stateChange.addListener((state) => {
          if (cancelled) return;
          if (state === UserAgentState.Started) {
            setStatus('Registering');
          }
        });

        const registerer = new Registerer(ua);
        registererRef.current = registerer;
        registerer.stateChange.addListener((state) => {
          if (cancelled) return;
          if (state === RegistererState.Registered) {
            setStatus('Registered');
          } else if (state === RegistererState.Terminated) {
            setStatus((prev) => (prev === 'Connected' || prev === 'Disconnected' ? prev : 'Disconnected'));
          }
        });

        await ua.start();
        await registerer.register().catch(() => {
          if (!cancelled && registerer.state !== RegistererState.Registered) {
            setStatus('Failed');
            setError('SIP registration was rejected');
          }
        });
      } catch (err) {
        if (!cancelled) {
          setStatus('Failed');
          setError(err instanceof Error ? err.message : 'Initialization failed');
        }
      }
    }

    connect();

    const onPageHide = () => teardownAll();
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);

    return () => {
      cancelled = true;
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      teardownAll();
    };
  }, [teardownAll]);

  const callEcho = useCallback(() => {
    const ua = userAgentRef.current;
    const config = configRef.current;
    if (!ua || !config || sessionRef.current) return;
    if (registererRef.current?.state !== RegistererState.Registered) return;

    const host = config.uri.split('@')[1];
    const target = UserAgent.makeURI(`sip:${ECHO_EXTENSION}@${host}`);
    if (!target) {
      setError('Invalid test destination');
      return;
    }

    setError(null);
    setStatus('Requesting microphone');

    const inviter = new Inviter(ua, target, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });
    sessionRef.current = inviter;

    inviter.stateChange.addListener((state) => {
      if (state === SessionState.Establishing) {
        setStatus((prev) => (prev === 'Ringing' ? prev : 'Calling'));
      } else if (state === SessionState.Established) {
        attachRemoteAudio(inviter);
        setStatus('Connected');
        stopTimer();
        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);
      } else if (state === SessionState.Terminated) {
        stopTimer();
        sessionRef.current = null;
        setMuted(false);
        setStatus('Disconnected');
      }
    });

    setStatus('Calling');
    inviter
      .invite({
        requestDelegate: {
          onProgress: () => setStatus('Ringing'),
        },
      })
      .catch(() => {
        setStatus('Failed');
        setError('Call failed');
      });
  }, [attachRemoteAudio, stopTimer]);

  const hangUp = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.state === SessionState.Established) {
      session.bye().catch(() => undefined);
    } else if (session.state === SessionState.Establishing || session.state === SessionState.Initial) {
      (session as Inviter).cancel().catch(() => undefined);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const pc = sessionRef.current ? getPeerConnection(sessionRef.current) : undefined;
    if (!pc) return;
    const next = !muted;
    pc.getSenders().forEach((sender) => {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = !next;
      }
    });
    setMuted(next);
  }, [muted]);

  const canCall = status === 'Registered' || status === 'Disconnected';
  const inCall = status === 'Calling' || status === 'Ringing' || status === 'Connected';

  return (
    <div className="p-6 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Shivaksa Voice Test
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Isolated WebRTC echo test. No external dialing is available from this endpoint.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                status === 'Registered' || status === 'Connected'
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : status === 'Failed'
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
              }`}
            >
              {status}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Destination</span>
            <span className="text-sm text-zinc-900 dark:text-zinc-100">
              Asterisk Echo Test ({ECHO_EXTENSION})
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Timer</span>
            <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100">
              {formatElapsed(elapsed)}
            </span>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={callEcho}
              disabled={!canCall}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Call Echo
            </button>
            <button
              type="button"
              onClick={toggleMute}
              disabled={status !== 'Connected'}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              type="button"
              onClick={hangUp}
              disabled={!inCall}
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Hang Up
            </button>
          </div>
        </div>

        <audio ref={audioRef} autoPlay hidden />
      </div>
    </div>
  );
}
