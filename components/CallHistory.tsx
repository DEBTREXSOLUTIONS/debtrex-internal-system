"use client";
import { useEffect, useState, useCallback } from 'react';
import {
  X, PhoneIncoming, PhoneOutgoing, PhoneMissed, RefreshCw, Loader2, History,
} from 'lucide-react';

interface CallRow {
  id: string;
  direction: 'inbound' | 'outbound';
  outcome: string;
  duration_seconds: number | null;
  called_at: string;
  from_number: string | null;
  to_number: string | null;
  user: { id: string; full_name: string } | null;
  contact: { id: string; full_name: string; phone: string | null; pipeline_type: string } | null;
}

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

function outcomeLabel(o: string): string {
  return o.replace(/_/g, ' ');
}

function isMissed(c: CallRow): boolean {
  return ['no_answer', 'busy', 'inbound_missed', 'voicemail', 'inbound_voicemail'].includes(c.outcome);
}

export default function CallHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [canViewAll, setCanViewAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/call-logs/history?limit=100', { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCalls(data.calls || []);
      setCanViewAll(!!data.canViewAll);
    } catch (e: any) {
      setError(e.message || 'Failed to load call history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div onClick={onClose} className="fixed inset-0 bg-black/40 z-50 fade-in" />
      )}
      <aside
        className={`
          fixed top-0 right-0 z-50 h-screen w-full sm:w-96 max-w-full
          bg-white shadow-2xl border-l border-gray-200 flex flex-col
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-hidden={!open}
      >
        <div className="bg-brand-ink text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <History size={18} />
            <div>
              <div className="font-condensed text-lg font-black uppercase tracking-wider leading-none">Call History</div>
              <div className="text-[10px] uppercase tracking-widest text-white/50 mt-1">
                {canViewAll ? 'All users' : 'Your calls'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 text-white/60 hover:text-white disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/60 hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-3 px-3 py-2 bg-brand-blue-pale text-brand-blue text-xs rounded">{error}</div>
          )}

          {loading && calls.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading...
            </div>
          )}

          {!loading && calls.length === 0 && !error && (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              No calls yet.
            </div>
          )}

          <ul className="divide-y divide-gray-100">
            {calls.map(c => {
              const missed = isMissed(c);
              const Icon = missed
                ? PhoneMissed
                : c.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
              const iconColor = missed
                ? 'text-brand-blue'
                : c.direction === 'inbound' ? 'text-blue-600' : 'text-green-600';
              const otherParty = c.contact?.full_name
                || c.contact?.phone
                || (c.direction === 'inbound' ? c.from_number : c.to_number)
                || 'Unknown';
              const userName = c.user?.full_name || 'Unknown user';
              return (
                <li key={c.id} className="px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="font-semibold text-sm text-gray-900 truncate">
                          {otherParty}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 flex-shrink-0">
                          {fmtWhen(c.called_at)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {c.direction === 'inbound' ? 'In' : 'Out'} · {userName}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 uppercase tracking-wider font-medium">
                          {outcomeLabel(c.outcome)}
                        </span>
                        <span className="font-mono text-gray-600">
                          {fmtDuration(c.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </>
  );
}
