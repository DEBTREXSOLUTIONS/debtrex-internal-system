"use client";
import { useEffect, useState, useCallback } from 'react';
import {
  PhoneOutgoing, PhoneIncoming, Clock, RefreshCw, Loader2, ShieldAlert, Unlock,
} from 'lucide-react';

interface Row {
  user_id: string;
  full_name: string;
  role: string;
  phone: string | null;
  extension: string | null;
  status: string | null;
  status_locked: boolean;
  ob_count: number;
  in_count: number;
  total_seconds: number;
}

const RANGES: { value: string; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

function fmtDuration(s: number): string {
  if (s <= 0) return '0m';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function statusColor(s: string | null): string {
  switch (s) {
    case 'online': return 'bg-green-500';
    case 'otl': return 'bg-red-500';
    case 'meeting': return 'bg-yellow-500';
    case 'break': return 'bg-orange-500';
    case 'offline':
    default: return 'bg-gray-400';
  }
}

export default function CallsTrackerClient({ canManageStatus }: { canManageStatus: boolean }) {
  const [range, setRange] = useState('7d');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overriding, setOverriding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/calls/stats?range=${range}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setRows(data.rows || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  async function unlockAgent(agentId: string) {
    setOverriding(agentId);
    try {
      const res = await fetch('/api/admin/agent-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, status: 'online', locked: false }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to unlock');
    } finally {
      setOverriding(null);
    }
  }

  const totals = rows.reduce((acc, r) => ({
    ob: acc.ob + r.ob_count,
    in: acc.in + r.in_count,
    sec: acc.sec + r.total_seconds,
  }), { ob: 0, in: 0, sec: 0 });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-condensed text-2xl font-black uppercase">Calls Tracker</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Per-agent call volume and time on the phone
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            {RANGES.map(r => (
              <button
                type="button"
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  range === r.value
                    ? 'bg-brand-ink text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Totals card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={PhoneOutgoing} label="Outbound" value={totals.ob} color="text-green-600" />
        <StatCard icon={PhoneIncoming} label="Inbound" value={totals.in} color="text-blue-600" />
        <StatCard icon={Clock} label="Time on phone" value={fmtDuration(totals.sec)} color="text-brand-red" />
        <StatCard icon={Clock} label="Agents" value={rows.length} color="text-gray-700" />
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-brand-red-pale text-brand-red text-sm rounded">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
              <tr>
                <th className="text-left px-4 py-2 font-bold">Agent</th>
                <th className="text-left px-3 py-2 font-bold">Number</th>
                <th className="text-left px-3 py-2 font-bold">Ext</th>
                <th className="text-right px-3 py-2 font-bold">OB</th>
                <th className="text-right px-3 py-2 font-bold">IN</th>
                <th className="text-right px-3 py-2 font-bold">Time</th>
                <th className="text-left px-3 py-2 font-bold">Status</th>
                {canManageStatus && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && rows.length === 0 && (
                <tr><td colSpan={canManageStatus ? 8 : 7} className="px-4 py-10 text-center text-gray-400">
                  <Loader2 size={14} className="inline animate-spin mr-2" /> Loading...
                </td></tr>
              )}
              {!loading && rows.length === 0 && !error && (
                <tr><td colSpan={canManageStatus ? 8 : 7} className="px-4 py-10 text-center text-gray-400">No agents.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.user_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-gray-900">{r.full_name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">{r.role}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{r.phone || '—'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{r.extension || '—'}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-700">{r.ob_count}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-blue-700">{r.in_count}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtDuration(r.total_seconds)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColor(r.status)} ${r.status_locked ? 'animate-pulse' : ''}`} />
                      <span className="text-xs uppercase tracking-wider">{r.status || '—'}</span>
                      {r.status_locked && (
                        <span className="text-[9px] uppercase tracking-widest text-brand-red font-bold">Locked</span>
                      )}
                    </div>
                  </td>
                  {canManageStatus && (
                    <td className="px-3 py-2.5 text-right">
                      {r.status_locked ? (
                        <button
                          type="button"
                          onClick={() => unlockAgent(r.user_id)}
                          disabled={overriding === r.user_id}
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-red hover:text-brand-red-dark disabled:opacity-50"
                          title="Force-unlock this agent (e.g. their browser crashed mid-call)"
                        >
                          {overriding === r.user_id ? <Loader2 size={11} className="animate-spin" /> : <Unlock size={11} />}
                          Unlock
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-300"><ShieldAlert size={11} className="inline" /></span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3">
      <div className={`${color}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-gray-400">{label}</div>
        <div className="font-condensed text-xl font-black">{value}</div>
      </div>
    </div>
  );
}
