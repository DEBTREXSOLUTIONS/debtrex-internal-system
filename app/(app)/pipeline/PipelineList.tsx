"use client";
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, Phone, Mail, Building2, User, DollarSign,
  Calendar, Trash2, Edit3, X, AlertCircle, CheckCircle, Filter
} from 'lucide-react';

const MANAGEMENT_STATUSES = [
  { value: 'new', label: 'New', color: 'gray' },
  { value: 'contacted', label: 'Contacted', color: 'blue' },
  { value: 'meeting', label: 'Meeting Scheduled', color: 'yellow' },
  { value: 'negotiating', label: 'Negotiating', color: 'yellow' },
  { value: 'contract_sent', label: 'Contract Sent', color: 'yellow' },
  { value: 'closed_won', label: 'Closed Won', color: 'green' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'red' },
];

const SALES_STATUSES = [
  { value: 'new', label: 'New Lead', color: 'gray' },
  { value: 'contacted', label: 'Contacted', color: 'blue' },
  { value: 'qualified', label: 'Qualified', color: 'yellow' },
  { value: 'proposal_sent', label: 'Proposal Sent', color: 'yellow' },
  { value: 'enrolled', label: 'Enrolled', color: 'green' },
  { value: 'not_interested', label: 'Not Interested', color: 'red' },
  { value: 'unreachable', label: 'Unreachable', color: 'gray' },
];

export default function PipelineList({ type, contacts, currentUser, permissions }: any) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);

  const statuses = type === 'management' ? MANAGEMENT_STATUSES : SALES_STATUSES;

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return contacts.filter((c: any) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!lower) return true;
      return (
        c.full_name?.toLowerCase().includes(lower) ||
        c.company_name?.toLowerCase().includes(lower) ||
        c.email?.toLowerCase().includes(lower) ||
        c.phone?.includes(lower)
      );
    });
  }, [contacts, search, statusFilter]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach((c: any) => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return counts;
  }, [contacts]);

  const fmt = (n: any) => n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
    : '—';

  return (
    <>
      {/* Header */}
      <div className="card p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">
            {type === 'management' ? 'Management Pipeline' : 'Sales Pipeline'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {type === 'management'
              ? 'Companies and partners to call, pitch deals, and sign contracts with.'
              : 'Leads to call and enroll in the debt relief program.'}
          </p>
        </div>
        {permissions.create && (
          <button type="button" onClick={() => setShowAdd(true)} className="btn-primary self-start sm:self-auto">
            <Plus size={14} /> Add Contact
          </button>
        )}
      </div>

      {/* Status counts as pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 pb-2">
        <StatusPill
          label={`All (${contacts.length})`}
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        {statuses.map(s => (
          <StatusPill
            key={s.value}
            label={`${s.label} (${stats[s.value] || 0})`}
            active={statusFilter === s.value}
            onClick={() => setStatusFilter(s.value)}
            color={s.color}
          />
        ))}
      </div>

      {/* Search */}
      <div className="card p-3 sm:p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={type === 'management'
              ? 'Search by company, contact name, email...'
              : 'Search by name, email, phone...'}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Contacts grid */}
      {filtered.length === 0 ? (
        <div className="card p-8 sm:p-12 text-center">
          {type === 'management'
            ? <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
            : <User size={32} className="mx-auto text-gray-300 mb-3" />}
          <h3 className="font-condensed text-xl font-black uppercase mb-2">
            {contacts.length === 0 ? 'No Contacts Yet' : 'No matches'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {contacts.length === 0
              ? `Add your first ${type === 'management' ? 'company' : 'lead'} to get started.`
              : 'Try a different search or filter.'}
          </p>
          {permissions.create && contacts.length === 0 && (
            <button type="button" onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus size={14} /> Add Contact
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <ContactCard key={c.id} contact={c} type={type} statuses={statuses} />
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <AddContactModal
          type={type}
          statuses={statuses}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function StatusPill({ label, active, onClick, color }: any) {
  const colors: any = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-brand-red-pale text-brand-red',
  };
  return (
    <button type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md whitespace-nowrap flex-shrink-0 transition-colors ${
        active ? 'bg-brand-red text-white' : colors[color] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

function ContactCard({ contact, type, statuses }: any) {
  const status = statuses.find((s: any) => s.value === contact.status) || statuses[0];
  const colors: any = {
    gray: 'badge-gray', blue: 'badge-blue', yellow: 'badge-yellow',
    green: 'badge-green', red: 'badge-red',
  };
  const initials = (contact.full_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const fmt = (n: any) => n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
    : null;

  return (
    <Link
      href={`/pipeline/${type}/${contact.id}`}
      className="card p-4 hover:border-brand-red transition-all hover:shadow-md fade-in block"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{contact.full_name || 'Unknown'}</div>
          {contact.company_name && (
            <div className="text-xs text-gray-500 truncate flex items-center gap-1">
              <Building2 size={10} /> {contact.company_name}
            </div>
          )}
        </div>
        <span className={`badge ${colors[status.color]} flex-shrink-0`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-gray-600">
        {contact.phone && (
          <div className="flex items-center gap-2 truncate">
            <Phone size={11} className="text-gray-400 flex-shrink-0" /> {contact.phone}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-2 truncate">
            <Mail size={11} className="text-gray-400 flex-shrink-0" /> {contact.email}
          </div>
        )}
        {type === 'sales' && contact.estimated_debt && (
          <div className="flex items-center gap-2">
            <DollarSign size={11} className="text-gray-400 flex-shrink-0" />
            Debt: <span className="font-bold text-brand-red">{fmt(contact.estimated_debt)}</span>
          </div>
        )}
        {type === 'management' && contact.deal_value && (
          <div className="flex items-center gap-2">
            <DollarSign size={11} className="text-gray-400 flex-shrink-0" />
            Deal: <span className="font-bold text-green-700">{fmt(contact.deal_value)}</span>
          </div>
        )}
        {contact.next_followup_at && (
          <div className="flex items-center gap-2 text-yellow-700">
            <Calendar size={11} className="flex-shrink-0" />
            Follow up {new Date(contact.next_followup_at).toLocaleDateString()}
          </div>
        )}
      </div>

      {contact.assigned_to_profile && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
          Assigned to <span className="font-semibold text-brand-ink">{contact.assigned_to_profile.full_name}</span>
        </div>
      )}
    </Link>
  );
}

function AddContactModal({ type, statuses, onClose, onCreated }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>({
    full_name: '',
    company_name: '',
    email: '',
    phone: '',
    estimated_debt: '',
    monthly_income: '',
    deal_value: '',
    industry: '',
    source: '',
    notes: '',
    status: statuses[0].value,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) { setError('Full name required'); return; }
    setLoading(true); setError('');
    try {
      const payload: any = {
        pipeline_type: type,
        full_name: form.full_name,
        company_name: form.company_name || null,
        email: form.email || null,
        phone: form.phone || null,
        status: form.status,
        source: form.source || null,
        notes: form.notes || null,
      };
      if (type === 'sales') {
        payload.estimated_debt = form.estimated_debt ? parseFloat(form.estimated_debt) : null;
        payload.monthly_income = form.monthly_income ? parseFloat(form.monthly_income) : null;
      } else {
        payload.deal_value = form.deal_value ? parseFloat(form.deal_value) : null;
        payload.industry = form.industry || null;
      }
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h3 className="font-condensed text-xl sm:text-2xl font-black uppercase">
            New {type === 'management' ? 'Company' : 'Lead'}
          </h3>
          <button type="button" onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>

        <form onSubmit={submit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="label">{type === 'management' ? 'Contact Person' : 'Full Name'} *</label>
            <input
              required
              type="text"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">{type === 'management' ? 'Company Name *' : 'Company (Optional)'}</label>
            <input
              required={type === 'management'}
              type="text"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" placeholder="+1 555 123 4567" />
            </div>
          </div>

          {type === 'sales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Estimated Debt</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" inputMode="decimal" value={form.estimated_debt} onChange={e => setForm({ ...form, estimated_debt: e.target.value })} className="input pl-7" />
                </div>
              </div>
              <div>
                <label className="label">Monthly Income</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" inputMode="decimal" value={form.monthly_income} onChange={e => setForm({ ...form, monthly_income: e.target.value })} className="input pl-7" />
                </div>
              </div>
            </div>
          )}

          {type === 'management' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Industry</label>
                <input type="text" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Estimated Deal Value</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input type="number" inputMode="decimal" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} className="input pl-7" />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="input">
                {statuses.map((s: any) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Source</label>
              <input type="text" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="input" placeholder="Website / Referral / Cold call" />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input" />
          </div>
        </form>

        <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button type="button" onClick={submit} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Contact'}
          </button>
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
