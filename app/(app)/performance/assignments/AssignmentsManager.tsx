"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, ArrowLeft, UserCheck, Trash2, AlertCircle, CheckCircle, Users } from 'lucide-react';

export default function AssignmentsManager({ users, assignments }: any) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [working, setWorking] = useState<string | null>(null);

  const managers = users.filter((u: any) => ['ceo', 'owner', 'co-owner', 'manager'].includes(u.role));

  // Group assignments by manager
  const byManager = managers.map((m: any) => {
    const theirAgents = assignments.filter((a: any) => a.manager_id === m.id);
    return { manager: m, agents: theirAgents };
  });

  // Find unassigned agents for the warning
  const assignedAgentIds = new Set(assignments.map((a: any) => a.agent_id));
  const unassigned = users.filter((u: any) =>
    u.role === 'employee' && !assignedAgentIds.has(u.id)
  );

  async function deleteAssignment(id: string, managerName: string, agentName: string) {
    if (!confirm(`Remove ${agentName} from ${managerName}'s team?`)) return;
    setWorking(id);
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/manager-assignments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setSuccess(`${agentName} removed from ${managerName}'s team`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      {/* Back link */}
      <Link href="/performance" className="btn-ghost mb-4">
        <ArrowLeft size={14} /> Back to Performance
      </Link>

      <div className="card p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Manager → Agent Assignments</h2>
          <p className="text-sm text-gray-500 mt-1">
            Choose which agents each manager can track. An agent can be assigned to multiple managers.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary self-start sm:self-auto">
          <Plus size={14} /> New Assignment
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Unassigned warning */}
      {unassigned.length > 0 && (
        <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-yellow-800 text-sm">{unassigned.length} unassigned employee{unassigned.length === 1 ? '' : 's'}</div>
              <div className="text-xs text-yellow-700 mt-1">
                {unassigned.map((u: any) => u.full_name).join(', ')} {unassigned.length === 1 ? "isn't" : "aren't"} tracked by any manager. Assign them so their performance shows up.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {byManager.map(({ manager, agents }: any) => {
          const initials = manager.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
          return (
            <div key={manager.id} className="card p-4 sm:p-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{manager.full_name}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider">{manager.role}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-condensed text-2xl font-black text-brand-blue">{agents.length}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider">Agents</div>
                </div>
              </div>

              {agents.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-3">No agents assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {agents.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-gray-50 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserCheck size={14} className="text-green-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{a.agent.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{a.agent.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAssignment(a.id, manager.full_name, a.agent.full_name)}
                        disabled={working === a.id}
                        className="opacity-0 group-hover:opacity-100 sm:opacity-100 p-1.5 hover:bg-red-50 text-brand-blue rounded transition-all disabled:opacity-50 flex-shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {byManager.length === 0 && (
        <div className="card p-8 sm:p-12 text-center">
          <Users size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-condensed text-xl font-black uppercase mb-2">No Managers Yet</h3>
          <p className="text-sm text-gray-500 mb-4">Promote a team member to Manager from the Team page first.</p>
          <Link href="/team" className="btn-primary">Go to Team Page</Link>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddAssignmentModal
          users={users}
          onClose={() => setShowAdd(false)}
          onSaved={(msg: string) => { setShowAdd(false); setSuccess(msg); router.refresh(); }}
        />
      )}
    </>
  );
}

function AddAssignmentModal({ users, onClose, onSaved }: any) {
  const [managerId, setManagerId] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const managers = users.filter((u: any) => ['ceo', 'owner', 'co-owner', 'manager'].includes(u.role));
  const possibleAgents = users.filter((u: any) => u.id !== managerId);

  function toggleAgent(id: string) {
    setAgentIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!managerId || agentIds.length === 0) {
      setErr('Pick a manager and at least one agent');
      return;
    }
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/manager-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_id: managerId, agent_ids: agentIds }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onSaved(`Created ${d.created} assignment${d.created === 1 ? '' : 's'}`);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h3 className="font-condensed text-xl sm:text-2xl font-black uppercase">New Assignment</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-blue" /></button>
        </div>

        <form onSubmit={submit} className="p-4 sm:p-6 overflow-y-auto flex-1">
          {err && (
            <div className="mb-3 p-2 bg-brand-blue-pale text-brand-blue text-sm rounded flex items-center gap-2">
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <div className="mb-4">
            <label className="label">Manager *</label>
            <select
              required
              value={managerId}
              onChange={e => { setManagerId(e.target.value); setAgentIds([]); }}
              className="input"
            >
              <option value="">— Select a manager —</option>
              {managers.map((m: any) => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.role})</option>
              ))}
            </select>
          </div>

          {managerId && (
            <div className="mb-4">
              <label className="label">Agents to assign *</label>
              <p className="text-xs text-gray-500 mb-2">Tap to select multiple. They will be assigned to this manager.</p>
              <div className="border border-gray-200 rounded-md max-h-64 overflow-y-auto">
                {possibleAgents.map((u: any) => {
                  const checked = agentIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center gap-3 p-2.5 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                        checked ? 'bg-brand-blue-pale' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAgent(u.id)}
                        className="w-4 h-4 accent-brand-blue flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{u.full_name}</div>
                        <div className="text-xs text-gray-500 truncate">{u.email} · {u.role}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">{agentIds.length} selected</p>
            </div>
          )}
        </form>

        <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={submit} disabled={loading || !managerId || agentIds.length === 0} className="btn-primary flex-1 disabled:opacity-50">
            {loading ? 'Saving...' : `Assign ${agentIds.length || ''} ${agentIds.length === 1 ? 'agent' : 'agents'}`}
          </button>
          <button onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
