"use client";
import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

// Inactivity / session management. Mounted once in the authenticated layout.
//
//  - Logs the user out after 55 minutes with no activity (and the logout call
//    flips their presence to offline).
//  - While the user IS active, periodically refreshes the 60-minute session
//    cookie so an active user is never interrupted.
//  - Shows a "you're about to be signed out" warning for the final 2 minutes.
//
// The 60-minute session JWT is the server-side backstop: if this tab is
// closed/asleep and never refreshes, the session simply expires.

const IDLE_LIMIT_MS = 55 * 60 * 1000;   // log out after this much inactivity
const WARNING_AT_MS = 53 * 60 * 1000;   // show the warning 2 minutes before
const REFRESH_EVERY_MS = 5 * 60 * 1000; // re-issue the cookie at most this often
const ACTIVE_WITHIN_MS = 60 * 1000;     // "active" = activity within the last minute

export default function SessionGuard() {
  const lastActivity = useRef(Date.now());
  const lastRefresh = useRef(Date.now());
  const endingSession = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    function markActivity() {
      lastActivity.current = Date.now();
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));

    async function endSession() {
      if (endingSession.current) return;
      endingSession.current = true;
      try {
        // Logout sets presence to offline server-side.
        await fetch('/api/auth/logout', { method: 'POST', keepalive: true });
      } catch {}
      window.location.href = '/login';
    }

    async function refresh() {
      lastRefresh.current = Date.now();
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });
        if (res.status === 401) endSession();
      } catch {}
    }

    function tick() {
      if (endingSession.current) return;
      const idle = Date.now() - lastActivity.current;

      if (idle >= IDLE_LIMIT_MS) {
        endSession();
        return;
      }

      if (idle >= WARNING_AT_MS) {
        setSecondsLeft(Math.max(0, Math.ceil((IDLE_LIMIT_MS - idle) / 1000)));
      } else {
        setSecondsLeft(null);
        if (idle < ACTIVE_WITHIN_MS && Date.now() - lastRefresh.current >= REFRESH_EVERY_MS) {
          refresh();
        }
      }
    }

    const interval = setInterval(tick, 1000);
    // Re-check immediately when the tab regains focus (covers laptop sleep).
    document.addEventListener('visibilitychange', tick);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, markActivity));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  function staySignedIn() {
    lastActivity.current = Date.now();
    lastRefresh.current = 0; // force the next tick to refresh the cookie
    setSecondsLeft(null);
  }

  if (secondsLeft === null) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-sm w-full p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-blue-pale flex items-center justify-center mx-auto mb-3">
          <Clock className="text-brand-blue" size={24} />
        </div>
        <h3 className="font-condensed text-2xl font-black uppercase mb-1">Still There?</h3>
        <p className="text-sm text-gray-600 mb-4">
          You&apos;ll be signed out due to inactivity in{' '}
          <span className="font-mono font-bold text-brand-ink">
            {mm}:{ss.toString().padStart(2, '0')}
          </span>
          .
        </p>
        <button onClick={staySignedIn} className="btn-primary w-full">
          Stay Signed In
        </button>
      </div>
    </div>
  );
}
