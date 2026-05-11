"use client";
import { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff, Mic, MicOff, Loader2, AlertCircle, Hash } from 'lucide-react';

interface Props {
  contactId: string;
  contactName: string;
  contactPhone: string;
  onCallEnded?: () => void;
}

type CallState = 'idle' | 'initializing' | 'ready' | 'connecting' | 'in-call' | 'ended' | 'error';

export default function BrowserDialer({ contactId, contactName, contactPhone, onCallEnded }: Props) {
  const [state, setState] = useState<CallState>('idle');
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callLogIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callRef.current) {
        try { callRef.current.disconnect(); } catch {}
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
      }
    };
  }, []);

  async function startCall() {
    setError('');
    setState('initializing');

    try {
      // 1. Fetch access token from server
      const tokenRes = await fetch('/api/twilio/voice-token');
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error);

      // 2. Dynamically import Voice SDK (it's a browser-only package)
      const { Device } = await import('@twilio/voice-sdk');

      // 3. Initialize the device
      const device = new Device(tokenData.token, {
        logLevel: 1, // 0 = silent, 1 = errors, 2 = warnings, 3 = info, 4 = debug
      });

      deviceRef.current = device;

      // Register events
      device.on('error', (err: any) => {
        console.error('Twilio Device error:', err);
        setError(`Device error: ${err.message || err.code}`);
        setState('error');
      });

      // 4. Connect (place the outbound call)
      setState('connecting');
      const call = await device.connect({
        params: {
          To: contactPhone,
          agentId: tokenData.identity,
          contactId,
        },
      });
      callRef.current = call;

      // 5. Register call events
      call.on('accept', async () => {
        setState('in-call');
        // Start duration timer
        const startedAt = Date.now();
        timerRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - startedAt) / 1000));
        }, 1000);

        // Log the call placeholder
        try {
          const callSid = call.parameters?.CallSid || null;
          const logRes = await fetch('/api/twilio/log-browser-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact_id: contactId, call_sid: callSid }),
          });
          const logData = await logRes.json();
          callLogIdRef.current = logData?.id || null;
        } catch (e) {
          console.error('Failed to log call:', e);
        }
      });

      call.on('disconnect', () => {
        cleanup();
        setState('ended');
        if (onCallEnded) onCallEnded();
      });

      call.on('cancel', () => {
        cleanup();
        setState('ended');
      });

      call.on('reject', () => {
        cleanup();
        setError('Call rejected');
        setState('ended');
      });

    } catch (e: any) {
      console.error('Call setup error:', e);
      setError(e.message || 'Failed to start call');
      setState('error');
      cleanup();
    }
  }

  function cleanup() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function hangup() {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch {}
    }
    cleanup();
    setState('ended');
    if (onCallEnded) onCallEnded();
  }

  function toggleMute() {
    if (callRef.current) {
      const newMuted = !muted;
      callRef.current.mute(newMuted);
      setMuted(newMuted);
    }
  }

  function sendDigit(digit: string) {
    if (callRef.current) {
      try { callRef.current.sendDigits(digit); } catch {}
    }
  }

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // Don't render anything for idle state - parent shows "Call Now" button
  if (state === 'idle') {
    return (
      <button type="button"
        onClick={startCall}
        disabled={!contactPhone}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        title={!contactPhone ? 'No phone number on this contact' : 'Call now via browser'}
      >
        <PhoneCall size={14} /> Call Now
      </button>
    );
  }

  // In-call overlay
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 fade-in">
      <div className="bg-white rounded-lg max-w-sm w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-brand-ink text-white p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-2xl mx-auto mb-3">
            {contactName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <h2 className="font-condensed text-2xl font-black uppercase">{contactName}</h2>
          <p className="text-sm text-white/60 mt-1">{contactPhone}</p>

          <div className="mt-4 pt-4 border-t border-white/10">
            {state === 'initializing' && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Initializing...
              </div>
            )}
            {state === 'connecting' && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 size={16} className="animate-spin" /> Ringing...
              </div>
            )}
            {state === 'in-call' && (
              <div>
                <div className="text-xs uppercase tracking-widest opacity-60">In Call</div>
                <div className="font-condensed text-3xl font-black mt-1">{fmtDuration(duration)}</div>
              </div>
            )}
            {state === 'ended' && (
              <div className="text-sm text-white/60">Call Ended {duration > 0 && `· ${fmtDuration(duration)}`}</div>
            )}
            {state === 'error' && (
              <div className="text-sm text-brand-red">Error</div>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="px-6 py-3 bg-brand-red-pale border-b border-brand-red/20 text-brand-red text-xs flex items-start gap-2">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad (toggle) */}
        {showKeypad && state === 'in-call' && (
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                <button type="button"
                  key={d}
                  onClick={() => sendDigit(d)}
                  className="aspect-square text-xl font-bold border-2 border-gray-200 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-6 flex items-center justify-center gap-3">
          {state === 'in-call' && (
            <>
              <button type="button"
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  muted ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button type="button"
                onClick={() => setShowKeypad(!showKeypad)}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                  showKeypad ? 'bg-brand-ink text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Keypad"
              >
                <Hash size={20} />
              </button>
            </>
          )}

          {(state === 'in-call' || state === 'connecting' || state === 'initializing') && (
            <button type="button"
              onClick={hangup}
              className="w-16 h-16 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
              title="Hang up"
            >
              <PhoneOff size={22} />
            </button>
          )}

          {(state === 'ended' || state === 'error') && (
            <button type="button"
              onClick={() => { setState('idle'); setError(''); setDuration(0); setMuted(false); setShowKeypad(false); }}
              className="btn-primary"
            >
              Close
            </button>
          )}
        </div>

        {/* Help text */}
        {(state === 'initializing' || state === 'connecting') && (
          <div className="px-6 pb-4 text-xs text-gray-500 text-center">
            Make sure your microphone is enabled. If prompted, click "Allow".
          </div>
        )}
      </div>
    </div>
  );
}
