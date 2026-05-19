"use client";
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, ChevronDown, Circle, Phone, Calendar, Coffee, MinusCircle } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  full_name: string;
  role: string;
}

const STATUSES = [
  { value: 'online', label: 'Online', icon: Circle, color: 'text-green-500', bg: 'bg-green-500', desc: 'Available for calls and tasks' },
  { value: 'otl', label: 'On The Line', icon: Phone, color: 'text-red-500', bg: 'bg-red-500', desc: 'Currently on a call' },
  { value: 'meeting', label: 'In Meeting', icon: Calendar, color: 'text-yellow-500', bg: 'bg-yellow-500', desc: 'In a meeting, do not disturb' },
  { value: 'break', label: 'On Break', icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-500', desc: 'Away for a short while' },
  { value: 'offline', label: 'Offline', icon: MinusCircle, color: 'text-gray-400', bg: 'bg-gray-400', desc: 'Not working' },
];

const STATUS_KEY = 'me_status';
const MARKED_ONLINE_KEY = 'marked_online';

// Map a pathname to the title shown in the top bar.
// First match wins. Use prefix matches for nested routes.
function deriveTitle(pathname: string): string {
  const map: [RegExp | string, string][] = [
    [/^\/pipeline\/management\/[^/]+/, 'Company Detail'],
    [/^\/pipeline\/sales\/[^/]+/, 'Lead Detail'],
    ['/pipeline/management', 'Pipeline · Management'],
    ['/pipeline/sales', 'Pipeline · Sales'],
    [/^\/tasks\/new/, 'New Task'],
    [/^\/tasks\/[^/]+/, 'Task Details'],
    ['/tasks', 'Tasks'],
    ['/calendar', 'Calendar'],
    ['/files', 'Files'],
    ['/budget/allocations', 'Budget Allocations'],
    ['/budget', 'Budget Tracker'],
    ['/team', 'Team Members'],
    ['/performance/assignments', 'Manager Assignments'],
    ['/performance', 'Performance'],
    ['/permissions', 'Permissions'],
    ['/roles', 'Custom Roles'],
    ['/twilio-numbers', 'Twilio Numbers'],
    ['/transfer-protocol', 'Transfer Protocol'],
    ['/calls/tracker', 'Calls Tracker'],
    ['/calculators', 'Calculators'],
    ['/notifications', 'Notifications'],
    ['/settings', 'Settings'],
    ['/', 'Dashboard'],
  ];
  for (const [pattern, title] of map) {
    if (typeof pattern === 'string') {
      if (pathname === pattern) return title;
    } else if (pattern.test(pathname)) {
      return title;
    }
  }
  return 'Dashboard';
}

export default function TopBar({ user, title }: { user: User; title?: string }) {
  const pathname = usePathname();
  const displayTitle = title || deriveTitle(pathname);
  // Default to 'online'. After mount we restore the chosen status from
  // sessionStorage so the user's selection survives page navigations.
  // (We can't read sessionStorage during render because it would cause an
  // SSR/CSR hydration mismatch.)
  const [status, setStatus] = useState<string>('online');
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Mark online once per session, not on every page nav.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STATUS_KEY);
      if (saved) setStatus(saved);
    } catch {}

    const alreadyOnline = sessionStorage.getItem(MARKED_ONLINE_KEY) === '1';
    if (!alreadyOnline) {
      fetch('/api/me/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'online' }),
      }).then(() => {
        try {
          sessionStorage.setItem(MARKED_ONLINE_KEY, '1');
          sessionStorage.setItem(STATUS_KEY, 'online');
        } catch {}
      });
    }

    // Set offline on tab close
    const beforeUnload = () => {
      try {
        sessionStorage.removeItem(MARKED_ONLINE_KEY);
        sessionStorage.removeItem(STATUS_KEY);
      } catch {}
      navigator.sendBeacon?.('/api/me/status', JSON.stringify({ status: 'offline' }));
    };
    window.addEventListener('beforeunload', beforeUnload);

    // Listen for status changes broadcast by the CallWidget (when a call
    // starts → 'otl', when it ends → previous status). The widget broadcasts
    // 'otl' on accept which we also treat as a lock signal.
    const onStatusChange = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      if (typeof next === 'string') {
        setStatus(next);
        setLocked(next === 'otl');
      }
    };
    window.addEventListener('debtrex:status', onStatusChange as EventListener);

    // Initial server reconciliation — if a previous tab left us OTL+locked,
    // the picker should reflect that.
    fetch('/api/me/status').then(r => r.json()).then(d => {
      if (d?.me?.status) setStatus(d.me.status);
      if (d?.me?.status_locked) setLocked(true);
    }).catch(() => {});

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('debtrex:status', onStatusChange as EventListener);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function changeStatus(newStatus: string) {
    if (locked) return;
    setUpdating(true);
    setOpen(false);
    const prev = status;
    setStatus(newStatus); // Optimistic
    try { sessionStorage.setItem(STATUS_KEY, newStatus); } catch {}
    try {
      const res = await fetch('/api/me/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        // 423 = locked (race: someone else accepted a call for us)
        if (res.status === 423) setLocked(true);
        throw new Error();
      }
    } catch {
      setStatus(prev); // Revert on error
      try { sessionStorage.setItem(STATUS_KEY, prev); } catch {}
    } finally { setUpdating(false); }
  }

  const current = STATUSES.find(s => s.value === status) || STATUSES[4];
  const CurrentIcon = current.icon;

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      <div className="pl-12 lg:pl-0 min-w-0 flex-1">
        <h1 className="font-condensed text-xl sm:text-2xl font-black uppercase truncate">{displayTitle}</h1>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          Welcome back, <span className="font-semibold text-brand-ink">{user.full_name.split(' ')[0]}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Status picker */}
        <div className="relative" ref={ref}>
          <button
            type="button"
            onClick={() => { if (!locked) setOpen(o => !o); }}
            disabled={updating || locked}
            className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md border border-gray-200 transition-colors disabled:opacity-60 ${locked ? 'cursor-not-allowed' : 'hover:border-gray-300'}`}
            title={locked ? 'Status locked — on a call. Only an admin can change this.' : current.desc}
          >
            <span className={`w-2 h-2 rounded-full ${current.bg} flex-shrink-0 ${status === 'online' ? 'ring-2 ring-green-200' : ''} ${locked ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{current.label}</span>
            {locked
              ? <span className="text-[9px] uppercase tracking-widest text-brand-red font-bold hidden sm:inline">Locked</span>
              : <ChevronDown size={11} className="text-gray-400" />}
          </button>

          {open && !locked && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-30">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Set Your Status</div>
              </div>
              {STATUSES.map(s => {
                const Icon = s.icon;
                const active = s.value === status;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => changeStatus(s.value)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 transition-colors text-left ${
                      active ? 'bg-brand-red-pale' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${s.bg} mt-1.5 flex-shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-bold ${active ? 'text-brand-red' : 'text-gray-800'}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-gray-500 leading-tight mt-0.5">{s.desc}</div>
                    </div>
                    {active && <span className="text-brand-red text-xs">●</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search - desktop only */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-brand-red w-56"
          />
        </div>

        <Link
          href="/notifications"
          className="relative p-2 text-gray-600 hover:text-brand-red transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </Link>
      </div>
    </header>
  );
}
