"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Plus, Download, Trash2, Users, ChevronLeft, ChevronRight,
  Phone, Mail, Globe, Loader2,
} from 'lucide-react';

const PAGE_SIZE = 50;

type LeadType = 'client' | 'business';
type LeadStatus = 'new' | 'contacted' | 'converted' | 'dead';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  lead_type: LeadType;
  status: LeadStatus;
  created_at: string;
}

interface Permissions {
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

const STATUSES: { value: LeadStatus; label: string; cls: string }[] = [
  { value: 'new', label: 'New', cls: 'badge-gray' },
  { value: 'contacted', label: 'Contacted', cls: 'badge-blue' },
  { value: 'converted', label: 'Converted', cls: 'badge-green' },
  { value: 'dead', label: 'Dead', cls: 'badge-red' },
];

export default function LeadsClient({
  initialLeads,
  initialTotal,
  permissions,
}: {
  initialLeads: Lead[];
  initialTotal: number;
  permissions: Permissions;
}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | LeadType>('');
  const [statusFilter, setStatusFilter] = useState<'' | LeadStatus>('');
  const [loading, setLoading] = useState(false);

  const firstRender = useRef(true);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (debounced) params.set('search', debounced);
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLeads(data.leads);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debounced, typeFilter, statusFilter]);

  // Skip the very first run — the server already provided page 1.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    fetchLeads();
  }, [fetchLeads]);

  function changeType(t: '' | LeadType) {
    setTypeFilter(t);
    setPage(1);
  }
  function changeStatus(s: '' | LeadStatus) {
    setStatusFilter(s);
    setPage(1);
  }

  async function updateStatus(id: string, status: LeadStatus) {
    const prev = leads;
    setLeads(leads.map(l => (l.id === id ? { ...l, status } : l)));
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) setLeads(prev);
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead? This cannot be undone.')) return;
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const remaining = leads.filter(l => l.id !== id);
      setTotal(t => Math.max(0, t - 1));
      if (remaining.length === 0 && page > 1) {
        setPage(p => p - 1);
      } else {
        setLeads(remaining);
      }
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (debounced) params.set('search', debounced);
    if (typeFilter) params.set('type', typeFilter);
    if (statusFilter) params.set('status', statusFilter);
    window.location.href = `/api/leads/export?${params.toString()}`;
  }

  return (
    <>
      {/* Header */}
      <div className="card p-4 sm:p-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-condensed text-xl sm:text-2xl font-black uppercase flex items-center gap-2">
            <Users size={22} className="text-brand-red" /> Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {total.toLocaleString()} total lead{total === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {permissions.export && (
            <button type="button" onClick={exportCsv} className="btn-outline">
              <Download size={14} /> Export
            </button>
          )}
          {permissions.create && (
            <Link href="/leads/new" className="btn-primary">
              <Plus size={14} /> Add Lead
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 sm:p-4 mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email, or website..."
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill label="All Types" active={typeFilter === ''} onClick={() => changeType('')} />
          <FilterPill label="Client" active={typeFilter === 'client'} onClick={() => changeType('client')} />
          <FilterPill label="Business" active={typeFilter === 'business'} onClick={() => changeType('business')} />
          <span className="w-px bg-gray-200 mx-1 self-stretch" />
          <FilterPill label="All Status" active={statusFilter === ''} onClick={() => changeStatus('')} />
          {STATUSES.map(s => (
            <FilterPill
              key={s.value}
              label={s.label}
              active={statusFilter === s.value}
              onClick={() => changeStatus(s.value)}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <Loader2 size={22} className="animate-spin text-brand-red" />
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-ink text-white text-[11px] uppercase tracking-wider">
                <th className="text-left font-bold px-3 py-2.5">Name</th>
                <th className="text-left font-bold px-3 py-2.5">Type</th>
                <th className="text-left font-bold px-3 py-2.5">Phone</th>
                <th className="text-left font-bold px-3 py-2.5">Email</th>
                <th className="text-left font-bold px-3 py-2.5">Website</th>
                <th className="text-left font-bold px-3 py-2.5">Status</th>
                <th className="text-left font-bold px-3 py-2.5">Added</th>
                {permissions.delete && <th className="px-3 py-2.5 w-10" />}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                    <Users size={28} className="mx-auto text-gray-300 mb-2" />
                    <div className="font-bold uppercase font-condensed text-lg">No leads found</div>
                    <div className="text-sm">
                      {debounced || typeFilter || statusFilter
                        ? 'Try a different search or filter.'
                        : 'Add your first lead to get started.'}
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{lead.name}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${lead.lead_type === 'business' ? 'badge-gray' : 'badge-red'}`}>
                        {lead.lead_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {lead.phone ? (
                        <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-brand-red">
                          <Phone size={12} className="text-gray-400" /> {lead.phone}
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-gray-700 hover:text-brand-red">
                          <Mail size={12} className="text-gray-400" /> {lead.email}
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap max-w-[220px] truncate">
                      {lead.website ? (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-gray-700 hover:text-brand-red"
                        >
                          <Globe size={12} className="text-gray-400" /> {lead.website}
                        </a>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {permissions.edit ? (
                        <select
                          value={lead.status}
                          onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                          className={`text-xs font-bold uppercase tracking-wide rounded px-1.5 py-1 border cursor-pointer ${statusBadgeCls(lead.status)}`}
                        >
                          {STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`badge ${statusBadgeCls(lead.status)}`}>
                          {STATUSES.find(s => s.value === lead.status)?.label || lead.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    {permissions.delete && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          className="text-gray-300 hover:text-brand-red transition-colors"
                          aria-label="Delete lead"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 text-sm">
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:border-brand-red disabled:hover:border-gray-200"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1.5 rounded border border-gray-200 disabled:opacity-40 hover:border-brand-red disabled:hover:border-gray-200"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function statusBadgeCls(status: string): string {
  return STATUSES.find(s => s.value === status)?.cls || 'badge-gray';
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md whitespace-nowrap transition-colors ${
        active ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
