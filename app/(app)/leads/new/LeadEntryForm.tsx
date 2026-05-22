"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  UserPlus, User, Phone, Mail, Globe, MapPin, Home, AlertCircle, Check, List,
} from 'lucide-react';

type LeadType = 'client' | 'business';

interface RecentLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  state: string | null;
  address: string | null;
  lead_type: LeadType;
}

const EMPTY = { name: '', phone: '', email: '', website: '', state: '', address: '' };

export default function LeadEntryForm() {
  const [form, setForm] = useState(EMPTY);
  const [leadType, setLeadType] = useState<LeadType>('client');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<RecentLead[]>([]);
  const [flash, setFlash] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Restore the last-used lead type so consecutive same-type entry is one less click.
  useEffect(() => {
    const saved = localStorage.getItem('lead_entry_type');
    if (saved === 'client' || saved === 'business') setLeadType(saved);
    nameRef.current?.focus();
  }, []);

  const pickType = useCallback((t: LeadType) => {
    setLeadType(t);
    localStorage.setItem('lead_entry_type', t);
    nameRef.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      setError('Name is required');
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, lead_type: leadType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save lead');

      setRecent(prev => [data, ...prev].slice(0, 20));
      setCount(c => c + 1);
      setForm(EMPTY);
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      nameRef.current?.focus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="card p-4 sm:p-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-condensed text-xl sm:text-2xl font-black uppercase flex items-center gap-2">
            <UserPlus size={22} className="text-brand-red" /> Add Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Fast entry — the form clears and refocuses after every save.
          </p>
        </div>
        <Link href="/leads" className="btn-outline self-start sm:self-auto">
          <List size={14} /> View All Leads
        </Link>
      </div>

      {/* Entry form */}
      <div className={`card p-4 sm:p-6 mb-4 transition-colors ${flash ? 'border-green-400' : ''}`}>
        {/* Type toggle */}
        <div className="mb-4">
          <label className="label">Lead Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => pickType('client')}
              className={`py-2.5 rounded-md font-bold uppercase tracking-wide text-sm border-2 transition-colors ${
                leadType === 'client'
                  ? 'bg-brand-red text-white border-brand-red'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-red'
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => pickType('business')}
              className={`py-2.5 rounded-md font-bold uppercase tracking-wide text-sm border-2 transition-colors ${
                leadType === 'business'
                  ? 'bg-brand-ink text-white border-brand-ink'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-ink'
              }`}
            >
              Business
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {error && (
            <div className="p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="label">Name *</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input pl-9"
                placeholder="Full name"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input pl-9"
                  placeholder="+1 555 123 4567"
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input pl-9"
                  placeholder="name@example.com"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Website</label>
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.website}
                  onChange={e => setForm({ ...form, website: e.target.value })}
                  className="input pl-9"
                  placeholder="example.com"
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label className="label">State</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.state}
                  onChange={e => setForm({ ...form, state: e.target.value })}
                  className="input pl-9"
                  placeholder="e.g. California"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Address</label>
            <div className="relative">
              <Home size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="input pl-9"
                placeholder="Street address"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
              <Check size={15} /> {saving ? 'Saving...' : 'Save & Add Next'}
            </button>
            {count > 0 && (
              <span className="text-sm font-bold text-green-700 whitespace-nowrap">
                {count} added
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            Tip: press <kbd className="px-1 py-0.5 bg-gray-100 rounded border border-gray-200 font-mono">Enter</kbd> to save and jump straight to the next lead.
          </p>
        </form>
      </div>

      {/* Recently added this session */}
      {recent.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h2 className="font-condensed text-lg font-black uppercase mb-3">
            Added This Session ({count})
          </h2>
          <div className="space-y-1.5">
            {recent.map(lead => (
              <div
                key={lead.id}
                className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-100 last:border-0 fade-in"
              >
                <Check size={14} className="text-green-600 flex-shrink-0" />
                <span className="font-semibold truncate flex-shrink-0 max-w-[40%]">{lead.name}</span>
                <span
                  className={`badge flex-shrink-0 ${
                    lead.lead_type === 'business' ? 'badge-gray' : 'badge-red'
                  }`}
                >
                  {lead.lead_type}
                </span>
                <span className="text-gray-500 truncate">
                  {[lead.phone, lead.email, lead.website, lead.state, lead.address]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
