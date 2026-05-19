"use client";
import { useEffect, useRef, useState } from 'react';
import {
  PhoneCall, PhoneOff, Mic, MicOff, Hash, Loader2, ArrowRightLeft, X,
} from 'lucide-react';

// Shape of the state the main window broadcasts on every call-state change.
// Keep in sync with CallWidget.tsx — see `publishState()` there.
interface CallState {
  state: 'idle' | 'ringing' | 'connecting' | 'in-call' | 'ended';
  direction: 'inbound' | 'outbound' | null;
  callInfo: { phone: string; name?: string } | null;
  duration: number;
  muted: boolean;
  inMerge: boolean;
  activeCallSid: string | null;
  canTransfer: boolean;
  permissionError: string;
}

const CHANNEL = 'debtrex-call-widget';

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function CallPopupClient() {
  const [call, setCall] = useState<CallState | null>(null);
  const [showKeypad, setShowKeypad] = useState(false);
  const [completing, setCompleting] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type === 'state') {
        setCall(msg.payload);
      } else if (msg?.type === 'main-close') {
        // The main window is going away — close the popup too.
        window.close();
      }
    };

    // Announce we're open and ask the main window to send current state.
    channel.postMessage({ type: 'popup-opened' });

    // Tell the main window when the popup is closing so it can restore
    // its in-page UI.
    function onUnload() {
      channel.postMessage({ type: 'popup-closed' });
      channel.close();
    }
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      try { channel.postMessage({ type: 'popup-closed' }); } catch {}
      try { channel.close(); } catch {}
    };
  }, []);

  function send(type: string, payload?: any) {
    channelRef.current?.postMessage({ type, payload });
  }

  async function completeTransfer() {
    if (!call?.activeCallSid) return;
    setCompleting(true);
    try {
      // Hit the API directly from the popup — same cookies, same auth.
      // The main window's call-state subscription will react to Twilio's
      // disconnect event on the agent's leg.
      await fetch('/api/twilio/transfer/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_sid: call.activeCallSid }),
      });
    } catch {}
    setCompleting(false);
  }

  // ─── Render ───
  const s = call?.state || 'idle';
  const inactive = s === 'idle' || s === 'ended';

  return (
    <div className="min-h-screen bg-brand-ink text-white flex flex-col p-5 select-none">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <PhoneCall size={14} className="text-brand-red" />
          <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">Call Widget</span>
        </div>
        <button
          type="button"
          onClick={() => window.close()}
          className="text-white/40 hover:text-white"
          title="Close popup (call continues in main window)"
        >
          <X size={16} />
        </button>
      </div>

      {inactive ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-white/50 text-sm">
          <PhoneCall size={32} className="mb-3 opacity-30" />
          <div>No active call</div>
          <div className="text-[10px] uppercase tracking-widest mt-2 opacity-60">Waiting for the next call…</div>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 mb-4">
            <div className="text-[10px] uppercase tracking-widest text-white/50">
              {s === 'ringing' && (call!.direction === 'inbound' ? 'Incoming Call' : 'Calling...')}
              {s === 'connecting' && 'Connecting...'}
              {s === 'in-call' && (call!.inMerge ? 'Consulting — Customer on Hold' : 'On Call')}
            </div>
            <div className="font-condensed text-3xl font-black mt-1 truncate">
              {call!.callInfo?.name || call!.callInfo?.phone || 'Unknown'}
            </div>
            {call!.callInfo?.name && (
              <div className="text-xs text-white/60 mt-0.5 truncate">{call!.callInfo.phone}</div>
            )}
            {s === 'in-call' && (
              <div className="mt-4 font-condensed text-4xl font-black">{fmtDuration(call!.duration)}</div>
            )}
            {s === 'connecting' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
                <Loader2 size={16} className="animate-spin" /> Connecting...
              </div>
            )}
          </div>

          {call!.permissionError && (
            <div className="mb-3 px-3 py-2 bg-brand-red-pale text-brand-red text-xs rounded">{call!.permissionError}</div>
          )}

          {showKeypad && s === 'in-call' && (
            <div className="mb-4 grid grid-cols-3 gap-2">
              {['1','2','3','4','5','6','7','8','9','*','0','#'].map(d => (
                <button
                  type="button"
                  key={d}
                  onClick={() => send('send-digit', d)}
                  className="aspect-square text-xl font-bold border-2 border-white/15 rounded-md hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center justify-center gap-2 flex-wrap">
            {s === 'ringing' && call!.direction === 'inbound' && (
              <>
                <button
                  type="button"
                  onClick={() => send('reject')}
                  className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark"
                  title="Decline"
                >
                  <PhoneOff size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => send('accept')}
                  className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center hover:bg-green-600 animate-pulse"
                  title="Answer"
                >
                  <PhoneCall size={18} />
                </button>
              </>
            )}

            {s === 'in-call' && (
              <>
                <button
                  type="button"
                  onClick={() => send('toggle-mute')}
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    call!.muted ? 'bg-brand-red text-white' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={call!.muted ? 'Unmute' : 'Mute'}
                >
                  {call!.muted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeypad(k => !k)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    showKeypad ? 'bg-white text-brand-ink' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title="Keypad"
                >
                  <Hash size={18} />
                </button>
                {call!.canTransfer && call!.activeCallSid && !call!.inMerge && (
                  <button
                    type="button"
                    onClick={() => send('open-transfer')}
                    className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
                    title="Transfer / Merge (opens in main window)"
                  >
                    <ArrowRightLeft size={18} />
                  </button>
                )}
                {call!.inMerge ? (
                  <>
                    <button
                      type="button"
                      onClick={completeTransfer}
                      disabled={completing}
                      className="px-4 h-12 rounded-full bg-green-600 text-white flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-60"
                      title="Hand off to the other agent"
                    >
                      {completing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />}
                      <span className="text-xs font-bold uppercase tracking-wider">Transfer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => send('hangup')}
                      className="w-12 h-12 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark"
                      title="Hang up"
                    >
                      <PhoneOff size={18} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => send('hangup')}
                    className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark"
                    title="Hang up"
                  >
                    <PhoneOff size={18} />
                  </button>
                )}
              </>
            )}

            {s === 'connecting' && (
              <button
                type="button"
                onClick={() => send('hangup')}
                className="w-14 h-14 rounded-full bg-brand-red text-white flex items-center justify-center hover:bg-brand-red-dark"
                title="Cancel"
              >
                <PhoneOff size={18} />
              </button>
            )}
          </div>

          <div className="mt-4 text-[9px] uppercase tracking-widest text-white/30 text-center">
            Audio is on the main window — keep it open
          </div>
        </>
      )}
    </div>
  );
}
