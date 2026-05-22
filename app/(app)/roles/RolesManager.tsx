"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, Edit3, Save, X, AlertCircle, CheckCircle, Lock, Shield, UserCheck, Users } from 'lucide-react';

const COLORS = [
  { value: 'red', label: 'Red', class: 'bg-brand-blue' },
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'gray', label: 'Gray', class: 'bg-gray-500' },
];

export default function RolesManager({ roles, userCounts }: any) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState({ role_key: '', label: '', description: '', color: 'blue' });

  function startAdd() {
    setForm({ role_key: '', label: '', description: '', color: 'blue' });
    setShowAdd(true);
    setError(''); setSuccess('');
  }

  function startEdit(role: any) {
    setForm({
      role_key: role.role_key,
      label: role.label,
      description: role.description || '',
      color: role.color || 'blue',
    });
    setEditing(role.role_key);
    setError(''); setSuccess('');
  }

  async function save() {
    setWorking(true); setError(''); setSuccess('');
    try {
      const isNew = !editing;

      // Validate role_key
      if (isNew) {
        const cleanKey = form.role_key.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!cleanKey || cleanKey.length < 2) {
          throw new Error('Role key required (lowercase letters, numbers, hyphens only)');
        }
        if (!form.label.trim()) throw new Error('Label required');

        const res = await fetch('/api/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, role_key: cleanKey }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setSuccess(`Created role "${form.label}"`);
      } else {
        const res = await fetch(`/api/roles/${editing}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: form.label, description: form.description, color: form.color }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        setSuccess('Saved');
      }

      setShowAdd(false);
      setEditing(null);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(false); }
  }

  async function deleteRole(role: any) {
    if (userCounts[role.role_key] > 0) {
      setError(`Cannot delete: ${userCounts[role.role_key]} user(s) still have this role. Change their role first.`);
      return;
    }
    if (!confirm(`Delete role "${role.label}"? This cannot be undone.`)) return;
    setWorking(true); setError('');
    try {
      const res = await fetch(`/api/roles/${role.role_key}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      setSuccess(`Deleted ${role.label}`);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setWorking(false); }
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Roles</h2>
          <p className="text-sm text-gray-500 mt-1">
            Add custom roles for your team. Set their access on the{' '}
            <Link href="/permissions" className="text-brand-blue font-bold">Permissions page</Link>.
          </p>
        </div>
        <button onClick={startAdd} className="btn-primary self-start sm:self-auto">
          <Plus size={14} /> New Custom Role
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

      {/* Add/Edit form */}
      {(showAdd || editing) && (
        <div className="card p-4 sm:p-6 mb-6 border-brand-blue border-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-condensed text-lg font-black uppercase">
              {editing ? `Edit ${form.label}` : 'New Custom Role'}
            </h3>
            <button onClick={() => { setShowAdd(false); setEditing(null); }}>
              <X size={18} className="text-gray-400 hover:text-brand-blue" />
            </button>
          </div>

          <div className="space-y-3">
            {!editing && (
              <div>
                <label className="label">Role Key (Internal Identifier) *</label>
                <input
                  type="text"
                  value={form.role_key}
                  onChange={e => setForm({ ...form, role_key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="senior-agent"
                  className="input font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, hyphens. Cannot be changed later. Example: "senior-agent", "lead-closer", "qa-specialist"
                </p>
              </div>
            )}
            <div>
              <label className="label">Display Label *</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                placeholder="Senior Agent"
                className="input"
              />
            </div>
            <div>
              <label className="label">Description (Optional)</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Experienced agent who can mentor new hires"
                className="input"
              />
            </div>
            <div>
              <label className="label">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={`w-8 h-8 rounded-full ${c.class} transition-all ${
                      form.color === c.value ? 'ring-2 ring-offset-2 ring-brand-ink' : 'opacity-60 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={save} disabled={working} className="btn-primary flex-1 disabled:opacity-50">
                <Save size={14} /> {working ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditing(null); }} className="btn-outline">
                Cancel
              </button>
            </div>
          </div>

          {!editing && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              <strong>What happens next:</strong> after creating the role, go to the{' '}
              <Link href="/permissions" className="font-bold underline">Permissions page</Link>{' '}
              to toggle what this role can do. New roles start with NO permissions.
            </div>
          )}
        </div>
      )}

      {/* Roles list */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Role</Th><Th>Key</Th><Th>Description</Th><Th>Users</Th><Th>Type</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r: any) => {
                const colorMap: any = {
                  red: 'bg-brand-blue', blue: 'bg-blue-500', green: 'bg-green-500',
                  yellow: 'bg-yellow-500', purple: 'bg-purple-500', gray: 'bg-gray-500',
                };
                const count = userCounts[r.role_key] || 0;
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${colorMap[r.color] || colorMap.gray}`} />
                        <span className="font-bold">{r.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{r.role_key}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${count > 0 ? 'badge-blue' : 'badge-gray'}`}>
                        {count} user{count === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.is_built_in
                        ? <span className="badge badge-gray flex items-center gap-1 w-fit"><Lock size={9} /> Built-in</span>
                        : <span className="badge badge-blue">Custom</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {!r.is_built_in && (
                          <>
                            <button
                              onClick={() => startEdit(r)}
                              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded"
                              title="Edit"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => deleteRole(r)}
                              disabled={count > 0}
                              className="p-1.5 hover:bg-red-50 text-brand-blue rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title={count > 0 ? 'Cannot delete — users still assigned' : 'Delete'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                        {r.is_built_in && (
                          <span className="text-xs text-gray-400 italic">Cannot edit</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 card p-4 bg-gray-50 text-xs text-gray-600">
        <div className="font-bold text-brand-ink mb-1 flex items-center gap-1"><Shield size={12} /> How custom roles work</div>
        <ul className="list-disc list-inside space-y-1 ml-1">
          <li>Built-in roles (CEO, Owner, Manager, etc.) cannot be deleted</li>
          <li>Custom roles start with NO permissions — set them on the Permissions page</li>
          <li>Once users are assigned a role, you can't delete it (change them first)</li>
          <li>Role keys cannot be changed after creation — pick carefully</li>
        </ul>
      </div>
    </>
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}
