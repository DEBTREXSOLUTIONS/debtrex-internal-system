"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  PhoneCall, PhoneOff, Mic, MicOff, Hash, Loader2, Phone,
  X, Delete, Minimize2, ArrowRightLeft,
} from 'lucide-react';
import TransferModal from './TransferModal';

interface User {
  id: string;
  role: string;
  status?: string;
}

// Permissions piped down so we can show/hide the Transfer button.
interface WidgetProps {
  user: User;
  canTransfer?: boolean;
}

type CallState = 'idle' | 'ringing' | 'connecting' | 'in-call' | 'ended';

// Custom event used by other components (e.g. ContactDetail "Call Now")
// to trigger an outbound call through this widget.
//
//   window.dispatchEvent(new CustomEvent('debtrex:call', {
//     detail: { phone: '+15551234567', name: 'Jane Doe', contactId: '...' }
//   }));
interface CallRequestDetail {
  phone: string;
  name?: string;
  contactId?: string;
}

const STATUS_KEY = 'me_status';

// Global call widget. Mounted once via the Sidebar so it's available on every
// authenticated page. Handles BOTH inbound and outbound calls on a single
// Twilio Voice SDK Device. Non-modal — agents keep working during calls.
export default function CallWidget({ user, canTransfer = false }: WidgetProps) {
  const [state, setState] = useState<CallState>('idle');
  const [direction, setDirection] = useState<'inbound' | 'outbound' | null>(null);
  const [callInfo, setCallInfo] = useState<{ phone: string; name?: string; contactId?: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [deviceReady, setDeviceReady] = useState(false);

  // Floating dialer panel (idle state)
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');

  // Whether the in-call widget is minimized to a pill in the corner
  const [minimized, setMinimized] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  // Current call's SID — populated by Twilio once the call begins. Needed
  // for the transfer modal so the backend can target the right call.
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  // Tracks whether this call is currently in a merge (3-way conference).
  // When true, the hangup button doubles as "Complete Transfer" and
  // blind/redirect operations must also end the conference so the other
  // participants get cleaned up.
  const [inMerge, setInMerge] = useState(false);
  const [completing, setCompleting] = useState(false);

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  // Tracks the call_logs row for the in-progress outbound call so we can
  // PATCH it with the final duration/outcome on disconnect.
  const logIdRef = useRef<string | null>(null);
  const acceptedRef = useRef<boolean>(false);
  const startedAtRef = useRef<number | null>(null);

  // ─── Status auto-sync: bump to OTL during call, restore after ───
  const broadcastStatus = (s: string) => {
    try { window.dispatchEvent(new CustomEvent('debtrex:status', { detail: s })); } catch {}
  };

  const setOtlStatus = useCallback(() => {
    try {
      const cur = sessionStorage.getItem(STATUS_KEY) || 'online';
      if (cur !== 'otl') prevStatusRef.current = cur;
    } catch {}
    try { sessionStorage.setItem(STATUS_KEY, 'otl'); } catch {}
    broadcastStatus('otl');
    // Lock=true is enforced server-side so the agent can't manually switch
    // away from OTL while on a call.
    fetch('/api/me/status/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock: true }),
    }).catch(() => {});
  }, []);

  const restoreStatus = useCallback(() => {
    const restoreTo = prevStatusRef.current || 'online';
    prevStatusRef.current = null;
    try { sessionStorage.setItem(STATUS_KEY, restoreTo); } catch {}
    broadcastStatus(restoreTo);
    fetch('/api/me/status/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lock: false, restore_to: restoreTo }),
    }).catch(() => {});
  }, []);

  // ─── Device lifecycle ───
  useEffect(() => {
    let mounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;

    async function initDevice() {
      try {
        const tokenRes = await fetch('/api/twilio/voice-token');
        if (!tokenRes.ok) return; // Not configured or no permission
        const tokenData = await tokenRes.json();
        if (!mounted || !tokenData.token) return;

        const { Device } = await import('@twilio/voice-sdk');
        const device = new Device(tokenData.token, { logLevel: 1 });
        deviceRef.current = device;

        device.on('registered', () => { if (mounted) setDeviceReady(true); });

        device.on('error', (err: any) => {
          console.error('Twilio Device error:', err);
          if (err.message?.toLowerCase().includes('mic') || err.code === 31402) {
            setPermissionError('Microphone access denied. Allow it to receive or place calls.');
          }
        });

        device.on('incoming', (call: any) => {
          callRef.current = call;
          const info = { phone: call.parameters?.From || 'Unknown' };
          setDirection('inbound');
          setCallInfo(info);
          setState('ringing');
          setMinimized(false);
          try {
            if (audioRef.current) {
              audioRef.current.loop = true;
              audioRef.current.play().catch(() => {});
            }
          } catch {}
          wireCallEvents(call, 'inbound', info);
        });

        await device.register();
      } catch (e) {
        console.error('Failed to init Voice Device:', e);
      }
    }

    initDevice();

    // Refresh token every 50 minutes (expires at 60)
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
      stopTimer();
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Listen for outbound call requests from other components ───
  useEffect(() => {
    function onCallRequest(e: Event) {
      const detail = (e as CustomEvent<CallRequestDetail>).detail;
      if (!detail?.phone) return;
      placeOutboundCall(detail.phone, detail.name, detail.contactId);
    }
    window.addEventListener('debtrex:call', onCallRequest as EventListener);
    return () => window.removeEventListener('debtrex:call', onCallRequest as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceReady]);

  // ─── Call event wiring (shared by inbound + outbound) ───
  // Takes direction + info as args (not from state) to avoid stale-closure
  // bugs — this function is called from event handlers registered at mount,
  // so React state captured here would be stale.
  function wireCallEvents(
    call: any,
    callDirection: 'inbound' | 'outbound',
    info: { phone: string; name?: string; contactId?: string },
  ) {
    call.on('accept', async () => {
      stopRingtone();
      setState('in-call');
      setOtlStatus();
      acceptedRef.current = true;
      const startedAt = Date.now();
      startedAtRef.current = startedAt;
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startedAt) / 1000));
      }, 1000);

      const sid = call.parameters?.CallSid;
      if (sid) setActiveCallSid(sid);

      // CallSid is reliably populated by the time `accept` fires. Backfill it
      // on the log row so the Twilio status webhook can match this call later.
      if (logIdRef.current && sid) {
        fetch('/api/twilio/log-browser-call', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: logIdRef.current, call_sid: sid }),
        }).catch(() => {});
      }
    });

    call.on('disconnect', () => {
      stopRingtone();
      stopTimer();
      setState('ended');
      restoreStatus();
      finalizeLog();
      setTimeout(() => resetCall(), 1500);
    });

    call.on('cancel', () => { stopRingtone(); stopTimer(); restoreStatus(); finalizeLog(); resetCall(); });
    call.on('reject', () => { stopRingtone(); stopTimer(); restoreStatus(); finalizeLog(); resetCall(); });
  }

  // Write the final duration/outcome to call_logs from the browser. We can't
  // rely on the Twilio status webhook in dev because Twilio can't reach
  // localhost; this fills the row in regardless of environment.
  function finalizeLog() {
    const id = logIdRef.current;
    if (!id) return;
    const startedAt = startedAtRef.current;
    const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    const accepted = acceptedRef.current;
    fetch('/api/twilio/log-browser-call', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        duration_seconds: accepted ? elapsed : 0,
        outcome: accepted ? 'connected' : 'no_answer',
      }),
    }).catch(() => {});
    logIdRef.current = null;
    acceptedRef.current = false;
    startedAtRef.current = null;
  }

  function stopRingtone() {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function resetCall() {
    callRef.current = null;
    setState('idle');
    setDirection(null);
    setCallInfo(null);
    setDuration(0);
    setMuted(false);
    setShowKeypad(false);
    setTransferOpen(false);
    setActiveCallSid(null);
    setInMerge(false);
    setCompleting(false);
  }

  // Drop out of a merge — completes the warm transfer. Customer + merge
  // target stay connected; our leg is hung up server-side so the local
  // disconnect handler runs naturally.
  async function completeTransfer() {
    if (!activeCallSid) return;
    setCompleting(true);
    try {
      await fetch('/api/twilio/transfer/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_sid: activeCallSid }),
      });
    } catch (e) {
      console.error('Complete transfer failed', e);
    } finally {
      setCompleting(false);
    }
    // Server already hung us up — let the disconnect event do cleanup,
    // but force a local hangup as a safety net.
    try { callRef.current?.disconnect?.(); } catch {}
  }

  // ─── Outbound calling ───
  async function placeOutboundCall(phone: string, name?: string, contactId?: string) {
    if (!deviceRef.current) {
      setPermissionError('Voice device not ready. Make sure mic permissions are granted.');
      return;
    }
    // callRef.current is a more reliable in-call check than `state` here:
    // the event listener that calls this function may close over stale state.
    if (callRef.current) return;

    const safePhone = phone.replace(/[^+\d]/g, '');
    if (!safePhone) return;

    setDirection('outbound');
    setCallInfo({ phone: safePhone, name, contactId });
    setState('connecting');
    setDialerOpen(false);
    setMinimized(false);

    try {
      const call = await deviceRef.current.connect({
        params: {
          To: safePhone,
          agentId: user.id,
          contactId: contactId || '',
        },
      });
      callRef.current = call;
      acceptedRef.current = false;
      startedAtRef.current = null;
      logIdRef.current = null;

      // Log immediately so even unanswered/cancelled calls show in history.
      // The PATCH on disconnect fills in final duration/outcome.
      fetch('/api/twilio/log-browser-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contactId || null,
          to_number: safePhone,
          call_sid: call.parameters?.CallSid || null,
        }),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            console.error('Failed to create call log row:', body.error || r.status);
            return;
          }
          if (body?.id) logIdRef.current = body.id;
        })
        .catch((e) => console.error('Call log POST errored:', e));

      wireCallEvents(call, 'outbound', { phone: safePhone, name, contactId });
    } catch (e: any) {
      console.error('Failed to place call:', e);
      setPermissionError(e.message || 'Failed to start call');
      restoreStatus();
      resetCall();
    }
  }

  function hangup() {
    if (callRef.current) {
      try { callRef.current.disconnect(); } catch {}
    }
  }

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
    stopRingtone();
    restoreStatus();
    resetCall();
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

  function pressDialerDigit(d: string) {
    setDialNumber(prev => prev + d);
  }

  function dialerBackspace() {
    setDialNumber(prev => prev.slice(0, -1));
  }

  function dialerCall() {
    if (!dialNumber) return;
    const formatted = dialNumber.startsWith('+') ? dialNumber : dialNumber;
    placeOutboundCall(formatted);
    setDialNumber('');
  }

  // ─── RENDER ───

  // Mini ringtone audio (silent base64 — replace with a real bell if you want)
  const audioEl = (
    <audio ref={audioRef} preload="auto" src="data:audio/wav;base64,UklGRrYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YZIAAAAA" />
  );

  // ── In-call / ringing UI (non-modal floating panel) ──
  if (state !== 'idle') {
    if (minimized) {
      return (
        <>
          {audioEl}
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="fixed bottom-4 right-4 z-50 bg-brand-ink text-white px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 hover:bg-black transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${state === 'in-call' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`} />
            <PhoneCall size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {state === 'in-call' ? fmtDuration(duration) : state === 'ringing' ? 'Incoming' : '…'}
            </span>
          </button>
        </>
      );
    }
    return (
      <>
        {audioEl}
        <div className="fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 fade-in">
          {/* Header with minimize */}
          <div className="bg-brand-ink text-white p-4 relative">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="absolute top-3 right-3 text-white/60 hover:text-white"
              title="Minimize"
            >
              <Minimize2 size={14} />
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                state === 'ringing' ? 'bg-green-500 animate-pulse' : 'bg-brand-red'
              }`}>
                {state === 'ringing' ? <PhoneCall size={20} /> : (
                  (callInfo?.name || callInfo?.phone || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-widest opacity-60">
                  {state === 'ringing' && (direction === 'inbound' ? 'Incoming Call' : 'Calling...')}
                  {state === 'connecting' && 'Connecting...'}
                  {state === 'in-call' && (inMerge ? 'Consulting — Customer on Hold' : 'On Call')}
                  {state === 'ended' && 'Call Ended'}
                </div>
                <div className="font-condensed text-lg font-black truncate">
                  {callInfo?.name || callInfo?.phone || 'Unknown'}
                </div>
                {callInfo?.name && (
                  <div className="text-[11px] text-white/60 truncate">{callInfo.phone}</div>
                )}
              </div>
            </div>
            {state === 'in-call' && (
              <div className="mt-3 pt-3 border-t border-white/10 text-center font-condensed text-2xl font-black">
                {fmtDuration(duration)}
              </div>
            )}
            {state === 'connecting' && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2 text-xs">
                <Loader2 size={14} className="animate-spin" /> Connecting...
              </div>
            )}
          </div>

          {permissionError && (
            <div className="px-4 py-2 bg-brand-red-pale text-brand-red text-xs">{permissionError}</div>
          )}

          {/* Keypad (toggle) */}
          {showKeypad && state === 'in-call' && (
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                  <button
                    type="button"
                    key={d}
                    onClick={() => sendDigit(d)}
                    className="aspect-square text-lg font-bold border-2 border-gray-200 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="p-4 flex items-center justify-center gap-2">
            {state === 'ringing' && direction === 'inbound' && (
              <>
                <button
                  type="button"
                  onClick={reject}
                  className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                  title="Decline"
                >
                  <PhoneOff size={18} />
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors animate-pulse"
                  title="Answer"
                >
                  <PhoneCall size={18} />
                </button>
              </>
            )}

            {state === 'in-call' && (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    muted ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                    showKeypad ? 'bg-brand-ink text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Keypad"
                >
                  <Hash size={18} />
                </button>
                {canTransfer && activeCallSid && (
                  <button
                    type="button"
                    onClick={() => setTransferOpen(true)}
                    className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    title={inMerge ? 'Redirect / Transfer' : 'Transfer / Merge'}
                  >
                    <ArrowRightLeft size={18} />
                  </button>
                )}
                {inMerge ? (
                  <>
                    <button
                      type="button"
                      onClick={completeTransfer}
                      disabled={completing}
                      className="px-4 h-12 rounded-full bg-green-600 text-white flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-60"
                      title="Hand the customer off to the other agent and drop your leg"
                    >
                      {completing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                      <span className="text-xs font-bold uppercase tracking-wider">Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={hangup}
                      className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                      title="Hang up — drops you AND the consult; customer stays on hold until they hang up"
                    >
                      <PhoneOff size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={hangup}
                    className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                    title="Hang up"
                  >
                    <PhoneOff size={18} />
                  </button>
                )}
              </>
            )}

            {(state === 'connecting') && (
              <button
                type="button"
                onClick={hangup}
                className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark transition-colors"
                title="Cancel"
              >
                <PhoneOff size={18} />
              </button>
            )}
          </div>
        </div>

        {transferOpen && activeCallSid && (
          <TransferModal
            callSid={activeCallSid}
            inMerge={inMerge}
            onClose={() => setTransferOpen(false)}
            onTransferred={(mode) => {
              setTransferOpen(false);
              if (mode === 'merge') {
                setInMerge(true);
              } else if (mode === 'blind') {
                // The agent's leg will be dropped by Twilio once redirected
                // (and if we were in a merge, the conference is ended by
                // the server). Proactively disconnect locally as a backup.
                setTimeout(() => { try { callRef.current?.disconnect?.(); } catch {} }, 500);
              }
            }}
          />
        )}
      </>
    );
  }

  // ── Idle: floating launcher + dialer panel ──
  return (
    <>
      {audioEl}

      {/* Floating launcher button (always visible when device ready) */}
      {!dialerOpen && (
        <button
          type="button"
          onClick={() => setDialerOpen(true)}
          className="fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center shadow-2xl hover:bg-brand-red-dark transition-all hover:scale-105"
          title="Open dialer"
          aria-label="Open dialer"
        >
          <Phone size={22} />
        </button>
      )}

      {/* Dialer panel */}
      {dialerOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 fade-in">
          <div className="bg-brand-ink text-white p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={16} />
              <span className="font-condensed text-base font-black uppercase tracking-wider">Dialer</span>
            </div>
            <button
              type="button"
              onClick={() => { setDialerOpen(false); setDialNumber(''); }}
              className="text-white/60 hover:text-white"
              aria-label="Close dialer"
            >
              <X size={16} />
            </button>
          </div>

          {!deviceReady && (
            <div className="px-4 py-2 bg-yellow-50 text-yellow-800 text-xs flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> Initializing phone…
            </div>
          )}
          {permissionError && (
            <div className="px-4 py-2 bg-brand-red-pale text-brand-red text-xs">{permissionError}</div>
          )}

          {/* Number display */}
          <div className="px-4 pt-4 pb-2">
            <input
              type="tel"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value.replace(/[^+\d]/g, ''))}
              placeholder="+1 555 555 1234"
              className="w-full text-center text-2xl font-condensed font-black tracking-wider border-b-2 border-gray-200 focus:border-brand-red focus:outline-none py-2 bg-transparent"
              inputMode="tel"
            />
          </div>

          {/* Keypad */}
          <div className="p-4 pt-2">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
                ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
                ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
                ['*', ''], ['0', '+'], ['#', ''],
              ].map(([digit, letters]) => (
                <button
                  type="button"
                  key={digit}
                  onClick={() => {
                    // Long-press 0 → "+"? Skip for now, user can type "+"
                    pressDialerDigit(digit);
                  }}
                  className="aspect-square border-2 border-gray-200 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors flex flex-col items-center justify-center"
                >
                  <span className="text-xl font-bold">{digit}</span>
                  {letters && <span className="text-[9px] text-gray-400 mt-0.5">{letters}</span>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={dialerBackspace}
                disabled={!dialNumber}
                className="w-12 h-12 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Backspace"
                aria-label="Backspace"
              >
                <Delete size={18} />
              </button>
              <button
                type="button"
                onClick={dialerCall}
                disabled={!dialNumber || !deviceReady}
                className="flex-1 h-12 rounded-md bg-green-500 text-white font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <PhoneCall size={16} /> Call
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
