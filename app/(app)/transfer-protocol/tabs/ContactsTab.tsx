"use client";
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  extension: string | null;
  profile_id: string | null;
  department: string | null;
  notes: string | null;
  profile?: { id: string; full_name: string } | null;
}

interface FormState {
  id?: string;
  name: string;
  phone: string;
  extension: string;
  profile_id: string;
  department: string;
  notes: string;
}

const EMPTY: FormState = { name: '', phone: '', extension: '', profile_id: '', department: '', notes: '' };

export default function ContactsTab() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, aRes] = await Promise.all([
        fetch('/api/transfer/contacts', { cache: 'no-store' }),
        fetch('/api/transfer/extensions', { cache: 'no-store' }),
      ]);
      const c = await cRes.json();
      const a = await aRes.json();
      if (!cRes.ok) throw new Error(c.error || 'Failed to load contacts');
      setContacts(c.contacts || []);
      setAgents((a.agents || []).map((x: any) => ({ id: x.id, full_name: x.full_name })));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const url = form.id ? `/api/transfer/contacts/${form.id}` : '/api/transfer/contacts';
      const method = form.id ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || null,
          extension: form.extension || null,
          profile_id: form.profile_id || null,
          department: form.department || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setForm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return;
    try {
      const res = await fetch(`/api/transfer/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setForm({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-red text-white text-xs font-bold uppercase tracking-wider hover:bg-brand-red-dark"
        >
          <Plus size={13} /> Add Contact
        </button>
      </div>

      {error && <div className="mb-3 px-3 py-2 bg-brand-red-pale text-brand-red text-xs rounded">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-widest text-gray-500">
            <tr>
              <th className="text-left px-4 py-2 font-bold">Name</th>
              <th className="text-left px-3 py-2 font-bold">Department</th>
              <th className="text-left px-3 py-2 font-bold">Phone</th>
              <th className="text-left px-3 py-2 font-bold">Ext</th>
              <th className="text-left px-3 py-2 font-bold">Linked Agent</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && contacts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading...
              </td></tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No contacts yet. Click "Add Contact".</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-semibold text-gray-900">{c.name}</td>
                <td className="px-3 py-2.5 text-gray-600">{c.department || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{c.phone || '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{c.extension || '—'}</td>
                <td className="px-3 py-2.5 text-gray-700">{c.profile?.full_name || '—'}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setForm({
                      id: c.id,
                      name: c.name,
                      phone: c.phone || '',
                      extension: c.extension || '',
                      profile_id: c.profile_id || '',
                      department: c.department || '',
                      notes: c.notes || '',
                    })}
                    className="text-gray-500 hover:text-brand-ink p-1"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-gray-500 hover:text-brand-red p-1 ml-1"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-brand-ink text-white p-4 flex items-center justify-between">
              <div className="font-condensed text-lg font-black uppercase tracking-wider">
                {form.id ? 'Edit Contact' : 'New Contact'}
              </div>
              <button type="button" onClick={() => setForm(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <Field label="Name" required>
                <input type="text" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-brand-red" />
              </Field>
              <Field label="Department">
                <input type="text" value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Underwriting, Legal"
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-brand-red" />
              </Field>
              <Field label="Phone (E.164)">
                <input type="tel" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="+15551234567"
                  className="w-full px-3 py-2 font-mono text-sm border border-gray-200 rounded focus:outline-none focus:border-brand-red" />
              </Field>
              <Field label="Extension (optional)">
                <input type="text" value={form.extension}
                  onChange={e => setForm({ ...form, extension: e.target.value.replace(/[^0-9*#]/g, '') })}
                  maxLength={8}
                  className="w-full px-3 py-2 font-mono text-sm border border-gray-200 rounded focus:outline-none focus:border-brand-red" />
              </Field>
              <Field label="Linked agent (optional)">
                <select value={form.profile_id}
                  onChange={e => setForm({ ...form, profile_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-brand-red">
                  <option value="">— External contact —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </Field>
              <Field label="Notes">
                <textarea value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-brand-red text-sm" />
              </Field>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={saving || !form.name.trim()}
                className="px-4 py-1.5 rounded bg-brand-red text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 hover:bg-brand-red-dark inline-flex items-center gap-1.5">
                {saving && <Loader2 size={12} className="animate-spin" />}
                {form.id ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
        {label}{required && <span className="text-brand-red ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
