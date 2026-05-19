"use client";
import { useEffect, useState } from 'react';
import { X, ArrowRightLeft, Users, Hash as HashIcon, Phone, Loader2, GitMerge } from 'lucide-react';

interface Agent {
  id: string;
  full_name: string;
  extension: string | null;
  status: string | null;
  status_locked: boolean;
}

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  extension: string | null;
  profile_id: string | null;
  department: string | null;
}

type TargetType = 'agent' | 'extension' | 'phone' | 'contact';
type Mode = 'blind' | 'merge';

export default function TransferModal({
  callSid,
  inMerge = false,
  onClose,
  onTransferred,
}: {
  callSid: string;
  inMerge?: boolean;
  onClose: () => void;
  onTransferred: (mode: Mode) => void;
}) {
  const [tab, setTab] = useState<'agents' | 'contacts' | 'dial'>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [dialNumber, setDialNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/transfer/extensions').then(r => r.ok ? r.json() : { agents: [] }),
      fetch('/api/transfer/contacts').then(r => r.ok ? r.json() : { contacts: [] }),
    ]).then(([ext, con]) => {
      setAgents(ext.agents || []);
      setContacts(con.contacts || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function doTransfer(mode: Mode, type: TargetType, value: string) {
    if (!value) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/twilio/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_sid: callSid,
          mode,
          target: { type, value },
          // If we're already in a merge and the agent blinds, the server
          // must tear down the existing conference so the merge target's
          // leg ends too (otherwise their UI is stuck "in call").
          end_conference: inMerge && mode === 'blind',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onTransferred(mode);
    } catch (e: any) {
      setError(e.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  }

  const q = search.toLowerCase();
  const filteredAgents = agents.filter(a =>
    !q || a.full_name.toLowerCase().includes(q) || (a.extension || '').includes(q)
  );
  const filteredContacts = contacts.filter(c =>
    !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.extension || '').includes(q)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-brand-ink text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} />
            <div>
              <div className="font-condensed text-lg font-black uppercase tracking-wider leading-none">
                {inMerge ? 'Redirect Call' : 'Transfer Call'}
              </div>
              {inMerge && (
                <div className="text-[9px] uppercase tracking-widest text-white/50 mt-1">
                  Currently merged — blind will end the conference
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {([
            ['agents', 'Agents', Users],
            ['contacts', 'Contacts', HashIcon],
            ['dial', 'Dial #', Phone],
          ] as const).map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                tab === key ? 'bg-white text-brand-red border-b-2 border-brand-red' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-3 mt-3 px-3 py-2 bg-brand-red-pale text-brand-red text-xs rounded">{error}</div>
        )}

        {tab !== 'dial' && (
          <div className="p-3 flex-shrink-0">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, extension, phone..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-brand-red"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {tab === 'agents' && (
            <ul className="divide-y divide-gray-100">
              {filteredAgents.length === 0 && (
                <li className="px-2 py-6 text-center text-gray-400 text-sm">No agents.</li>
              )}
              {filteredAgents.map(a => (
                <TargetRow
                  key={a.id}
                  title={a.full_name}
                  subtitle={[a.extension ? `x${a.extension}` : null, a.status].filter(Boolean).join(' · ')}
                  unavailable={a.status_locked || a.status !== 'online'}
                  unavailableLabel={a.status_locked ? 'On a call' : a.status === 'online' ? '' : (a.status || 'Offline')}
                  onBlind={() => doTransfer('blind', 'agent', a.id)}
                  onMerge={() => doTransfer('merge', 'agent', a.id)}
                  disabled={submitting}
                />
              ))}
            </ul>
          )}

          {tab === 'contacts' && (
            <ul className="divide-y divide-gray-100">
              {filteredContacts.length === 0 && (
                <li className="px-2 py-6 text-center text-gray-400 text-sm">No contacts. Add some in Transfer Protocol.</li>
              )}
              {filteredContacts.map(c => {
                const sub = [
                  c.department,
                  c.extension ? `x${c.extension}` : null,
                  c.phone,
                ].filter(Boolean).join(' · ');
                return (
                  <TargetRow
                    key={c.id}
                    title={c.name}
                    subtitle={sub}
                    onBlind={() => doTransfer('blind', 'contact', c.id)}
                    onMerge={() => doTransfer('merge', 'contact', c.id)}
                    disabled={submitting}
                  />
                );
              })}
            </ul>
          )}

          {tab === 'dial' && (
            <div className="px-2 pt-2">
              <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-bold">Phone number</label>
              <input
                type="tel"
                value={dialNumber}
                onChange={e => setDialNumber(e.target.value.replace(/[^+\d]/g, ''))}
                placeholder="+1 555 555 1234"
                className="w-full px-3 py-2 text-lg font-condensed border-b-2 border-gray-200 focus:border-brand-red focus:outline-none"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!dialNumber || submitting}
                  onClick={() => doTransfer('blind', 'phone', dialNumber)}
                  className="h-11 rounded-md bg-brand-ink text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-black"
                >
                  <ArrowRightLeft size={14} /> Blind
                </button>
                <button
                  type="button"
                  disabled={!dialNumber || submitting}
                  onClick={() => doTransfer('merge', 'phone', dialNumber)}
                  className="h-11 rounded-md bg-brand-red text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-brand-red-dark"
                >
                  <GitMerge size={14} /> Merge
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-500 leading-relaxed flex-shrink-0">
          <strong className="text-gray-700 uppercase tracking-wider">Blind</strong> — hand off and drop.
          <span className="mx-2">•</span>
          <strong className="text-gray-700 uppercase tracking-wider">Merge</strong> — 3-way conference, you stay on.
        </div>

        {submitting && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-brand-red" />
          </div>
        )}
      </div>
    </div>
  );
}

function TargetRow({
  title, subtitle, unavailable, unavailableLabel, onBlind, onMerge, disabled,
}: {
  title: string;
  subtitle: string;
  unavailable?: boolean;
  unavailableLabel?: string;
  onBlind: () => void;
  onMerge: () => void;
  disabled: boolean;
}) {
  return (
    <li className="px-2 py-2 flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 truncate">{title}</div>
        <div className="text-[11px] text-gray-500 truncate">{subtitle || '—'}</div>
      </div>
      {unavailable && unavailableLabel ? (
        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold pr-1">{unavailableLabel}</span>
      ) : null}
      <button
        type="button"
        onClick={onBlind}
        disabled={disabled}
        className="px-2 py-1 rounded bg-brand-ink text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-50 hover:bg-black"
        title="Blind transfer"
      >
        Blind
      </button>
      <button
        type="button"
        onClick={onMerge}
        disabled={disabled}
        className="px-2 py-1 rounded bg-brand-red text-white text-[10px] uppercase tracking-wider font-bold disabled:opacity-50 hover:bg-brand-red-dark"
        title="3-way merge"
      >
        Merge
      </button>
    </li>
  );
}
