"use client";
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

// The four continental US time zones.
const ZONES = [
  { label: 'ET', tz: 'America/New_York' },
  { label: 'CT', tz: 'America/Chicago' },
  { label: 'MT', tz: 'America/Denver' },
  { label: 'PT', tz: 'America/Los_Angeles' },
];

export default function UsaClocks() {
  // null until mounted — keeps server and first client render identical
  // (the time is client-only data and would otherwise mismatch on hydration).
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Reserve nothing visible until mounted.
    return <div className="hidden xl:block" aria-hidden />;
  }

  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(now);

  return (
    <div
      className="hidden xl:flex items-center gap-3 px-3 py-1 rounded-md border border-gray-200 bg-gray-50"
      title="Current time across US time zones"
    >
      <Clock size={14} className="text-gray-400 flex-shrink-0" />
      {ZONES.map(z => (
        <div key={z.label} className="text-center leading-tight">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            {z.label}
          </div>
          <div className="text-xs font-bold text-brand-ink tabular-nums whitespace-nowrap">
            {fmt(z.tz)}
          </div>
        </div>
      ))}
    </div>
  );
}
