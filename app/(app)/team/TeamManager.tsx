"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, AlertCircle, UserPlus, Power, PowerOff, Shield } from 'lucide-react';

export default function TeamManager({ members, currentUser, roles = [] }: any) {
  const ROLES = roles.length > 0 ? roles : [
    { value: 'ceo', label: 'CEO' },
    { value: 'owner', label: 'Owner' },
    { value: 'co-owner', label: 'Co-Owner' },
    { value: 'manager', label: 'Manager' },
    { value: 'employee', label: 'Employee' },
    { value: 'accountant', label: 'Accountant' },
    { value: 'viewer', label: 'Viewer' },
  ];
  const router = useRouter();
  const [showInvite, setShowInvite] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ password?: string; email?: string } | null>(null);

  const isCEO = ['ceo', 'owner'].includes(currentUser.role);

  async function changeRole(userId: string, newRole: string) {
    setUpdating(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      router.refresh();
    } finally { setUpdating(null); }
  }

  async function toggleActive(userId: string, isActive: boolean) {
    setUpdating(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      });
      router.refresh();
    } finally { setUpdating(null); }
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Team Members</h2>
          <p className="text-sm text-gray-500">{members.length} total · {members.filter((m: any) => m.is_active).length} active</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          <UserPlus size={14} /> Invite Team Member
        </button>
      </div>

      {/* Members table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Last Login</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => {
                const isMe = m.id === currentUser.id;
                const initials = m.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs">{initials}</div>
                        <div>
                          <div className="font-semibold">{m.full_name} {isMe && <span className="text-xs text-gray-500 font-normal">(you)</span>}</div>
                          {m.phone && <div className="text-xs text-gray-500">{m.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={m.role}
                        onChange={e => changeRole(m.id, e.target.value)}
                        disabled={updating === m.id || isMe || (!isCEO && ['ceo', 'owner'].includes(m.role))}
                        className="input text-xs py-1 px-2 w-32"
                      >
                        {ROLES.map((r: any) => (
                          <option key={r.value} value={r.value} disabled={r.value === 'ceo' && !isCEO}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${m.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!isMe && (
                        <button
                          onClick={() => toggleActive(m.id, m.is_active)}
                          disabled={updating === m.id}
                          className="text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-brand-red disabled:opacity-50 flex items-center gap-1"
                        >
                          {m.is_active ? <PowerOff size={12} /> : <Power size={12} />}
                          {m.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && <InviteModal roles={ROLES} onClose={() => { setShowInvite(false); setInviteResult(null); }} onInvited={(result: any) => { setInviteResult(result); router.refresh(); }} />}

      {/* Invite success modal */}
      {inviteResult?.password && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="text-brand-red" size={20} />
              <h3 className="font-condensed text-2xl font-black uppercase">User Invited</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">An email has been sent with login credentials. Save this temp password as a backup:</p>
            <div className="bg-brand-red-pale border border-brand-red/20 rounded p-3 text-center mb-4">
              <div className="text-xs text-gray-500 mb-1">Temporary Password</div>
              <div className="font-mono text-lg font-bold">{inviteResult.password}</div>
            </div>
            <button onClick={() => { setInviteResult(null); setShowInvite(false); }} className="btn-primary w-full">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ children }: any) { return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>; }

function InviteModal({ roles, onClose, onInvited }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', full_name: '', role: 'employee', phone: '' });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onInvited(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-condensed text-2xl font-black uppercase">Invite Team Member</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>
        {error && <div className="mb-3 p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label">Full Name *</label>
            <input required type="text" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="input" /></div>
          <div><label className="label">Email Address *</label>
            <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input" /></div>
          <div><label className="label">Phone</label>
            <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input" /></div>
          <div><label className="label">Role *</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input">
              {(roles || []).filter((r: any) => r.value !== 'ceo' && r.value !== 'owner').map((r: any) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select></div>
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Inviting...' : 'Send Invitation'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
