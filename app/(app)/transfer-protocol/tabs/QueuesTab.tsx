"use client";
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';

interface Member {
  profile_id: string;
  priority: number;
  profile?: { id: string; full_name: string; status: string | null; extension: string | null } | null;
}
interface Queue {
  id: string;
  name: string;
  strategy: 'round_robin' | 'all_ring' | 'longest_idle';
  ring_timeout_seconds: number;
  max_wait_seconds: number;
  is_active: boolean;
  hold_music_url: string | null;
  members: Member[];
}

const STRATEGY_LABELS: Record<string, string> = {
  all_ring: 'All ring (first to answer wins)',
  round_robin: 'Round robin (rotate)',
  longest_idle: 'Longest idle',
};

export default function QueuesTab() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [agents, setAgents] = useState<{ id: string; full_name: string; extension: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, aRes] = await Promise.all([
        fetch('/api/transfer/queues', { cache: 'no-store' }),
        fetch('/api/transfer/extensions', { cache: 'no-store' }),
      ]);
      const q = await qRes.json();
      const a = await aRes.json();
      if (!qRes.ok) throw new Error(q.error);
      setQueues(q.queues || []);
      setAgents((a.agents || []).map((x: any) => ({ id: x.id, full_name: x.full_name, extension: x.extension })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createQueue() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/transfer/queues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewName('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function saveQueue(q: Queue) {
    setSavingId(q.id);
    setError('');
    try {
      const res = await fetch(`/api/transfer/queues/${q.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: q.name,
          strategy: q.strategy,
          ring_timeout_seconds: q.ring_timeout_seconds,
          max_wait_seconds: q.max_wait_seconds,
          is_active: q.is_active,
          hold_music_url: q.hold_music_url,
          members: q.members.map((m, i) => ({ profile_id: m.profile_id, priority: i })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  async function removeQueue(id: string) {
    if (!confirm('Delete this queue?')) return;
    try {
      const res = await fetch(`/api/transfer/queues/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function updateLocal(id: string, patch: Partial<Queue>) {
    setQueues(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  }

  function toggleMember(q: Queue, agentId: string) {
    const has = q.members.some(m => m.profile_id === agentId);
    const nextMembers = has
      ? q.members.filter(m => m.profile_id !== agentId)
      : [...q.members, { profile_id: agentId, priority: q.members.length }];
    updateLocal(q.id, { members: nextMembers });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New queue name (e.g. Sales, Support)"
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-200 rounded focus:outline-none focus:border-brand-red text-sm"
        />
        <button
          type="button"
          onClick={createQueue}
          disabled={!newName.trim() || creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-red text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-brand-red-dark"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Create
        </button>
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-brand-red-pale text-brand-red text-xs rounded">{error}</div>}

      <div className="space-y-2">
        {loading && queues.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400 bg-white border border-gray-200 rounded">
            <Loader2 size={14} className="inline animate-spin mr-2" /> Loading...
          </div>
        )}
        {!loading && queues.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400 bg-white border border-gray-200 rounded">
            No queues yet. Create one above.
          </div>
        )}
        {queues.map(q => {
          const isExpanded = expanded.has(q.id);
          return (
            <div key={q.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(prev => {
                  const n = new Set(prev);
                  if (n.has(q.id)) n.delete(q.id); else n.add(q.id);
                  return n;
                })}>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <div className="font-condensed text-lg font-black uppercase">{q.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 hidden sm:inline">
                  {STRATEGY_LABELS[q.strategy]} · {q.members.length} members
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {!q.is_active && <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Disabled</span>}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeQueue(q.id); }}
                    className="text-gray-400 hover:text-brand-red p-1"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Name">
                      <input value={q.name} onChange={e => updateLocal(q.id, { name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-red" />
                    </Field>
                    <Field label="Strategy">
                      <select value={q.strategy} onChange={e => updateLocal(q.id, { strategy: e.target.value as any })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-red">
                        {Object.entries(STRATEGY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Ring timeout (sec)">
                      <input type="number" min={5} max={120} value={q.ring_timeout_seconds}
                        onChange={e => updateLocal(q.id, { ring_timeout_seconds: parseInt(e.target.value) || 20 })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-red" />
                    </Field>
                    <Field label="Max wait (sec)">
                      <input type="number" min={30} max={1800} value={q.max_wait_seconds}
                        onChange={e => updateLocal(q.id, { max_wait_seconds: parseInt(e.target.value) || 300 })}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-brand-red" />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={q.is_active}
                      onChange={e => updateLocal(q.id, { is_active: e.target.checked })} />
                    <span className="uppercase tracking-wider font-bold text-gray-700">Active</span>
                  </label>

                  <div>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1.5">Members ({q.members.length})</div>
                    <div className="border border-gray-200 rounded max-h-56 overflow-y-auto">
                      {agents.map(a => {
                        const checked = q.members.some(m => m.profile_id === a.id);
                        return (
                          <label key={a.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0">
                            <input type="checkbox" checked={checked} onChange={() => toggleMember(q, a.id)} />
                            <span className="flex-1">{a.full_name}</span>
                            {a.extension && <span className="font-mono text-[11px] text-gray-500">x{a.extension}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => saveQueue(q)}
                      disabled={savingId === q.id}
                      className="px-3 py-1.5 rounded bg-brand-red text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-brand-red-dark inline-flex items-center gap-1.5"
                    >
                      {savingId === q.id && <Loader2 size={12} className="animate-spin" />}
                      Save changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
