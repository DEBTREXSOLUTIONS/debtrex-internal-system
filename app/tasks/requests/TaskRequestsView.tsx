"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Check, X, AlertCircle, Clock, ArrowRight, Inbox } from 'lucide-react';

interface Person { id: string; full_name: string; role: string; }
interface Row {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deadline: string | null;
  estimated_days: number | null;
  requested_by: string;
  assigned_to: string;
  target_approver: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  denial_reason: string | null;
  created_task_id: string | null;
  created_at: string;
  requester?: { id: string; full_name: string; role: string } | null;
  assignee?:  { id: string; full_name: string; role: string } | null;
  approver?:  { id: string; full_name: string } | null;
}

export default function TaskRequestsView({
  currentUser, rows, people, approvers,
  canRequest, canApprove, pendingCount, currentStatus, forceMine,
}: {
  currentUser: { id: string; full_name: string; role: string };
  rows: Row[];
  people: Person[];
  approvers: Person[];
  canRequest: boolean;
  canApprove: boolean;
  pendingCount: number;
  currentStatus: string;
  forceMine: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [denyingId, setDenyingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [error, setError] = useState('');

  async function approve(id: string) {
    setBusy(id); setError('');
    const r = await fetch(`/api/task-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error || 'Failed'); return; }
    router.refresh();
  }

  async function deny(id: string) {
    if (!denyReason.trim()) return;
    setBusy(id); setError('');
    const r = await fetch(`/api/task-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deny', denial_reason: denyReason.trim() }),
    });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error || 'Failed'); return; }
    setDenyingId(null); setDenyReason('');
    router.refresh();
  }

  async function cancel(id: string) {
    setBusy(id); setError('');
    const r = await fetch(`/api/task-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });
    setBusy(null);
    if (!r.ok) { setError((await r.json()).error || 'Failed'); return; }
    router.refresh();
  }

  function nav(qs: Record<string, string>) {
    const url = new URL(window.location.href);
    Object.entries(qs).forEach(([k, v]) => v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
    router.push(url.pathname + url.search);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/tasks" className="btn-ghost">← Tasks</Link>
          <h1 className="font-condensed text-2xl font-black uppercase">Task Requests</h1>
          {canApprove && pendingCount > 0 && (
            <span className="badge badge-red">{pendingCount} pending</span>
          )}
        </div>
        {canRequest && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus size={14} /> New Request
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6">
        <FilterTab active={currentStatus === 'pending' && !forceMine && canApprove} onClick={() => nav({ status: 'pending', mine: '' })}>
          {canApprove ? 'Pending (Inbox)' : 'My Pending'}
        </FilterTab>
        {canApprove && (
          <FilterTab active={forceMine} onClick={() => nav({ mine: '1', status: 'pending' })}>
            My Requests
          </FilterTab>
        )}
        <FilterTab active={currentStatus === 'approved'} onClick={() => nav({ status: 'approved', mine: '' })}>
          Approved
        </FilterTab>
        <FilterTab active={currentStatus === 'denied'} onClick={() => nav({ status: 'denied', mine: '' })}>
          Denied
        </FilterTab>
        <FilterTab active={currentStatus === 'all'} onClick={() => nav({ status: 'all', mine: '' })}>
          All
        </FilterTab>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox size={32} className="mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-700">No requests here</h3>
          <p className="text-sm text-gray-500 mt-1">
            {currentStatus === 'pending' ? 'You\'re all caught up.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <RequestCard
              key={row.id}
              row={row}
              currentUserId={currentUser.id}
              canApprove={canApprove}
              busy={busy === row.id}
              onApprove={() => approve(row.id)}
              onAskDeny={() => { setDenyingId(row.id); setDenyReason(''); }}
              onCancel={() => cancel(row.id)}
            />
          ))}
        </div>
      )}

      {/* Deny modal */}
      {denyingId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 fade-in">
            <h2 className="font-condensed text-xl font-black uppercase mb-2">Deny request</h2>
            <p className="text-sm text-gray-600 mb-4">Tell the requester why. They'll see your reason.</p>
            <textarea
              value={denyReason}
              onChange={e => setDenyReason(e.target.value)}
              className="input"
              rows={4}
              placeholder="Reason for denial…"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="btn-outline" onClick={() => { setDenyingId(null); setDenyReason(''); }}>Cancel</button>
              <button type="button" className="btn-primary" disabled={!denyReason.trim() || !!busy}
                onClick={() => deny(denyingId)}>
                {busy ? 'Denying…' : 'Deny request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New request modal */}
      {modalOpen && (
        <NewRequestModal
          currentUser={currentUser}
          people={people}
          approvers={approvers}
          onClose={() => setModalOpen(false)}
          onSubmitted={() => { setModalOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function FilterTab({ active, onClick, children }: any) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap flex-shrink-0 ${
        active ? 'bg-brand-blue text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}>
      {children}
    </button>
  );
}

function RequestCard({ row, currentUserId, canApprove, busy, onApprove, onAskDeny, onCancel }: any) {
  const isMine = row.requested_by === currentUserId;
  const priorityClass: any = { urgent: 'badge-red', high: 'badge-yellow', medium: 'badge-gray', low: 'badge-gray' };
  const statusClass: any = {
    pending: 'badge-yellow',
    approved: 'badge-green',
    denied: 'badge-red',
    cancelled: 'badge-gray',
  };

  return (
    <div className="card p-5 fade-in">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge ${priorityClass[row.priority] || 'badge-gray'}`}>{row.priority}</span>
          <span className={`badge ${statusClass[row.status]}`}>{row.status}</span>
          {row.target_approver && (
            <span className="badge badge-blue">→ {row.approver?.full_name || 'approver'}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={11} /> {new Date(row.created_at).toLocaleString()}
        </span>
      </div>

      <h3 className="font-bold text-lg mb-1">{row.title}</h3>
      {row.description && (
        <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{row.description}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 pb-3 border-b border-gray-100">
        <div><span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block">Requested by</span>{row.requester?.full_name} <span className="text-gray-400">({row.requester?.role})</span></div>
        <div><span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block">Would assign to</span>{row.assignee?.full_name} <span className="text-gray-400">({row.assignee?.role})</span></div>
        <div><span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block">Deadline</span>
          {row.deadline ? new Date(row.deadline).toLocaleDateString() : row.estimated_days ? `${row.estimated_days}d` : '—'}
        </div>
      </div>

      {/* Resolution details */}
      {row.status === 'denied' && row.denial_reason && (
        <div className="mt-3 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-sm">
          <span className="font-semibold uppercase text-[10px] tracking-wider text-brand-blue">Denied: </span>
          <span className="text-gray-700">{row.denial_reason}</span>
        </div>
      )}
      {row.status === 'approved' && row.created_task_id && (
        <Link href={`/tasks/${row.created_task_id}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline">
          View created task <ArrowRight size={11} />
        </Link>
      )}

      {/* Actions */}
      {row.status === 'pending' && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {canApprove && (
            <>
              <button type="button" className="btn-primary" disabled={busy} onClick={onApprove}>
                <Check size={14} /> {busy ? 'Working…' : 'Approve'}
              </button>
              <button type="button" className="btn-outline" disabled={busy} onClick={onAskDeny}>
                <X size={14} /> Deny
              </button>
            </>
          )}
          {isMine && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
              Cancel request
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewRequestModal({ currentUser, people, approvers, onClose, onSubmitted }: any) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: currentUser.id,
    priority: 'medium',
    estimated_days: 7,
    deadline: '',
    target_approver: '' as string,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  function calcDeadline(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const deadline = form.deadline || calcDeadline(form.estimated_days);
    const r = await fetch('/api/task-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        assigned_to: form.assigned_to,
        priority: form.priority,
        estimated_days: form.estimated_days,
        deadline: new Date(deadline + 'T23:59:59').toISOString(),
        target_approver: form.target_approver || null,
      }),
    });
    setLoading(false);
    if (!r.ok) { setErr((await r.json()).error || 'Failed'); return; }
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <form onSubmit={submit} className="bg-white rounded-lg max-w-xl w-full p-6 my-8 fade-in space-y-4">
        <h2 className="font-condensed text-2xl font-black uppercase mb-2">Request a task</h2>
        <p className="text-sm text-gray-600">An admin will need to approve before the task is created.</p>

        {err && (
          <div className="flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
            <AlertCircle size={16} /> {err}
          </div>
        )}

        <div>
          <label className="label">Task title *</label>
          <input required className="input" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?" />
        </div>

        <div>
          <label className="label">Why this task?</label>
          <textarea className="input" rows={3} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Context the approver needs to decide." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Assign to</label>
            <select className="input" value={form.assigned_to}
              onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
              {people.map((u: Person) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority}
              onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Timeline (days)</label>
            <input type="number" min={1} max={365} className="input"
              value={form.estimated_days}
              onChange={e => setForm({ ...form, estimated_days: parseInt(e.target.value) || 1, deadline: '' })} />
          </div>
          <div>
            <label className="label">Or set deadline</label>
            <input type="date" className="input" value={form.deadline}
              onChange={e => setForm({ ...form, deadline: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label">Send to (optional)</label>
          <select className="input" value={form.target_approver}
            onChange={e => setForm({ ...form, target_approver: e.target.value })}>
            <option value="">Any eligible admin</option>
            {approvers.map((u: Person) => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Pick a specific admin to review, or leave blank — any CEO / Owner / Manager will see it.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <button type="button" className="btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading || !form.title.trim()}>
            {loading ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </div>
  );
}
