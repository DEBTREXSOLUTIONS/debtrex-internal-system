"use client";
import { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Mic, MicOff, Hash, Loader2 } from 'lucide-react';

interface User {
  id: string;
  role: string;
  status?: string;
}

type CallState = 'idle' | 'ringing' | 'connecting' | 'in-call' | 'ended';

// Global listener for inbound Twilio Voice calls.
// Mounted at the layout level so it's always active across pages.
export default function InboundCallListener({ user }: { user: User }) {
  const [state, setState] = useState<CallState>('idle');
  const [callerInfo, setCallerInfo] = useState<{ from: string; name?: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [permissionError, setPermissionError] = useState('');

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    async function initDevice() {
      try {
        // Fetch token
        const tokenRes = await fetch('/api/twilio/voice-token');
        if (!tokenRes.ok) return; // Not configured or no permission

        const tokenData = await tokenRes.json();
        if (!mounted || !tokenData.token) return;

        // Dynamic import — voice-sdk is browser-only
        const { Device } = await import('@twilio/voice-sdk');

        const device = new Device(tokenData.token, {
          logLevel: 1,
        });

        deviceRef.current = device;

        device.on('registered', () => {
          // Device ready to receive calls
        });

        device.on('error', (err: any) => {
          console.error('Inbound Device error:', err);
          if (err.message?.toLowerCase().includes('mic') || err.code === 31402) {
            setPermissionError('Microphone access denied. Allow it to receive calls.');
          }
        });

        device.on('incoming', (call: any) => {
          // Inbound call!
          callRef.current = call;
          const from = call.parameters?.From || 'Unknown';
          setCallerInfo({ from });
          setState('ringing');

          // Try to play a ringtone (best effort)
          try {
            if (audioRef.current) {
              audioRef.current.loop = true;
              audioRef.current.play().catch(() => {});
            }
          } catch {}

          call.on('accept', () => {
            stopRingtone();
            setState('in-call');
            const startedAt = Date.now();
            timerRef.current = setInterval(() => {
              setDuration(Math.floor((Date.now() - startedAt) / 1000));
            }, 1000);
          });
          call.on('disconnect', () => {
            stopRingtone();
            cleanup();
            setState('ended');
            setTimeout(() => { setState('idle'); setCallerInfo(null); setDuration(0); }, 2000);
          });
          call.on('cancel', () => {
            stopRingtone();
            cleanup();
            setState('idle');
            setCallerInfo(null);
          });
          call.on('reject', () => {
            stopRingtone();
            cleanup();
            setState('idle');
            setCallerInfo(null);
          });
        });

        await device.register();
      } catch (e) {
        console.error('Failed to init inbound device:', e);
      }
    }

    function stopRingtone() {
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
      } catch {}
    }

    function cleanup() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Only init if user has call.make perm and is online-ish
    initDevice();

    // Refresh token every 50 minutes (token expires at 1 hour)
    refreshInterval = setInterval(async () => {
      try {
        const tokenRes = await fetch('/api/twilio/voice-token');
        const tokenData = await tokenRes.json();
        if (tokenData.token && deviceRef.current) {
          deviceRef.current.updateToken(tokenData.token);
        }
      } catch {}
    }, 50 * 60 * 1000);

    return () => {
      mounted = false;
      if (refreshInterval) clearInterval(refreshInterval);
      cleanup();
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
      }
    };
  }, []);

  function accept() {
    if (callRef.current) {
      setState('connecting');
      try { callRef.current.accept(); } catch {}
    }
  }

  function reject() {
    if (callRef.current) {
      try { callRef.current.reject(); } catch {}
    }
    setState('idle');
    setCallerInfo(null);
  }

  function hangup() {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch {}
    }
  }

  function toggleMute() {
    if (callRef.current) {
      const newMuted = !muted;
      callRef.current.mute(newMuted);
      setMuted(newMuted);
    }
  }

  function sendDigit(d: string) {
    if (callRef.current) {
      try { callRef.current.sendDigits(d); } catch {}
    }
  }

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // Don't render anything when idle
  if (state === 'idle') {
    return (
      <>
        {/* Ringtone audio element - silent until played */}
        <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRrYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIAAAAA" />
      </>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRrYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIAAAAA" />

      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4 fade-in">
        <div className="bg-white rounded-lg max-w-sm w-full overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-brand-ink text-white p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-3 animate-pulse">
              <PhoneCall size={28} />
            </div>
            <div className="text-xs uppercase tracking-widest opacity-70 mb-1">
              {state === 'ringing' && 'Incoming Call'}
              {state === 'connecting' && 'Connecting...'}
              {state === 'in-call' && 'On Call'}
              {state === 'ended' && 'Call Ended'}
            </div>
            <h2 className="font-condensed text-2xl font-black uppercase break-words">
              {callerInfo?.name || callerInfo?.from || 'Unknown'}
            </h2>
            {callerInfo?.from && callerInfo?.name && (
              <p className="text-sm text-white/60 mt-1">{callerInfo.from}</p>
            )}

            {state === 'in-call' && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="font-condensed text-3xl font-black">{fmtDuration(duration)}</div>
              </div>
            )}

            {state === 'connecting' && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Connecting...
              </div>
            )}
          </div>

          {permissionError && (
            <div className="px-6 py-2 bg-brand-red-pale text-brand-red text-xs">
              {permissionError}
            </div>
          )}

          {/* Keypad */}
          {showKeypad && state === 'in-call' && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => sendDigit(d)}
                    className="aspect-square text-xl font-bold border-2 border-gray-200 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="p-6 flex items-center justify-center gap-3">
            {state === 'ringing' && (
              <>
                <button
                  type="button"
                  onClick={reject}
                  className="w-16 h-16 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                  title="Decline"
                >
                  <PhoneOff size={22} />
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors animate-pulse"
                  title="Answer"
                >
                  <PhoneCall size={22} />
                </button>
              </>
            )}

            {state === 'in-call' && (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    muted ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                    showKeypad ? 'bg-brand-ink text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Keypad"
                >
                  <Hash size={20} />
                </button>
                <button
                  type="button"
                  onClick={hangup}
                  className="w-16 h-16 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                  title="Hang up"
                >
                  <PhoneOff size={22} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
