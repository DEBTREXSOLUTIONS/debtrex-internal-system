"use client";
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Save, Check } from 'lucide-react';

interface Agent {
  id: string;
  full_name: string;
  role: string;
  extension: string | null;
  status: string | null;
  status_locked: boolean;
  twilio_phone_number: string | null;
}

export default function ExtensionsTab() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Buffered edits keyed by agent id
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/transfer/extensions', { cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(agentId: string) {
    const value = (edits[agentId] ?? '').trim();
    setSaving(agentId);
    setError('');
    try {
      const res = await fetch('/api/transfer/extensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, extension: value || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, extension: data.extension } : a));
      setEdits(prev => { const n = { ...prev }; delete n[agentId]; return n; });
      setSavedId(agentId);
      setTimeout(() => setSavedId(p => p === agentId ? null : p), 1500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {error && <div className="px-4 py-2 bg-brand-red-pale text-brand-red text-xs">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
          <tr>
            <th className="text-left px-4 py-2 font-bold">Agent</th>
            <th className="text-left px-3 py-2 font-bold">Role</th>
            <th className="text-left px-3 py-2 font-bold">Caller ID</th>
            <th className="text-left px-3 py-2 font-bold">Extension</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading && agents.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
              <Loader2 size={14} className="inline animate-spin mr-2" /> Loading...
            </td></tr>
          )}
          {agents.map(a => {
            const editVal = edits[a.id] ?? (a.extension || '');
            const dirty = (edits[a.id] ?? null) !== null && (edits[a.id] ?? '') !== (a.extension || '');
            return (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold text-gray-900">{a.full_name}</td>
                <td className="px-3 py-2.5 text-xs uppercase tracking-wider text-gray-500">{a.role}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{a.twilio_phone_number || '—'}</td>
                <td className="px-3 py-2.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editVal}
                    onChange={e => setEdits(prev => ({ ...prev, [a.id]: e.target.value.replace(/[^0-9*#]/g, '') }))}
                    placeholder="—"
                    maxLength={8}
                    className="w-24 px-2 py-1 font-mono text-sm border border-gray-200 rounded focus:outline-none focus:border-brand-red"
                  />
                </td>
                <td className="px-3 py-2.5 text-right">
                  {savedId === a.id ? (
                    <span className="text-green-600 inline-flex items-center gap-1 text-xs"><Check size={13} /> Saved</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => save(a.id)}
                      disabled={!dirty || saving === a.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-red text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-red-dark"
                    >
                      {saving === a.id ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      Save
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
