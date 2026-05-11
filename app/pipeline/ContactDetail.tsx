"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, PhoneCall, Mail, Building2, MapPin, DollarSign,
  Calendar, Clock, Edit3, Trash2, Save, X, AlertCircle, CheckCircle,
  Pin, MessageSquare, FileText, User, PhoneOff, History, ExternalLink
} from 'lucide-react';
import BrowserDialer from '@/components/BrowserDialer';

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

const CALL_OUTCOMES = [
  { value: 'connected', label: 'Connected — talked' },
  { value: 'voicemail', label: 'Left voicemail' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Line busy' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'scheduled_callback', label: 'Scheduled a callback' },
  { value: 'follow_up', label: 'Will follow up' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'sale_closed', label: 'Sale closed!' },
];

export default function ContactDetail({
  contact: initialContact, type, callLogs, notes, users, collaborators: initialCollabs, currentUser, permissions, twilioConfigured,
}: any) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [collaborators, setCollaborators] = useState(initialCollabs || []);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...initialContact });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'calls' | 'notes' | 'info' | 'team'>('calls');
  const [callingNow, setCallingNow] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);

  const statuses = type === 'management' ? MANAGEMENT_STATUSES : SALES_STATUSES;
  const status = statuses.find(s => s.value === contact.status) || statuses[0];
  const initials = (contact.full_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const fmt = (n: any) => n != null
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n)
    : '—';

  const colors: any = {
    gray: 'badge-gray', blue: 'badge-blue', yellow: 'badge-yellow',
    green: 'badge-green', red: 'badge-red',
  };

  async function saveEdit() {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/pipeline/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editForm.full_name,
          company_name: editForm.company_name || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          alternative_phone: editForm.alternative_phone || null,
          address: editForm.address || null,
          city: editForm.city || null,
          state: editForm.state || null,
          zip: editForm.zip || null,
          industry: editForm.industry || null,
          deal_value: editForm.deal_value ? parseFloat(editForm.deal_value) : null,
          estimated_debt: editForm.estimated_debt ? parseFloat(editForm.estimated_debt) : null,
          monthly_income: editForm.monthly_income ? parseFloat(editForm.monthly_income) : null,
          source: editForm.source || null,
          notes: editForm.notes || null,
          status: editForm.status,
          assigned_to: editForm.assigned_to || null,
          next_followup_at: editForm.next_followup_at || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContact(d);
      setEditing(false);
      setSuccess('Saved');
      setTimeout(() => setSuccess(''), 2000);
      router.refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function changeStatus(newStatus: string) {
    setError('');
    try {
      const res = await fetch(`/api/pipeline/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setContact({ ...contact, status: newStatus });
      router.refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function deleteContact() {
    if (!confirm('Permanently delete this contact and all associated call logs and notes?')) return;
    try {
      const res = await fetch(`/api/pipeline/${contact.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      router.push(`/pipeline/${type}`);
    } catch (e: any) { setError(e.message); }
  }

  async function startCall() {
    if (!contact.phone) { setError('No phone number on file'); return; }
    setCallingNow(true); setError('');
    try {
      const res = await fetch(`/api/twilio/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contact.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess('Call initiated! Twilio is calling your phone first — pick up to connect to the lead.');
      setTimeout(() => setSuccess(''), 8000);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setCallingNow(false); }
  }

  return (
    <>
      <Link href={`/pipeline/${type}`} className="btn-ghost mb-4">
        <ArrowLeft size={14} /> Back to {type === 'management' ? 'Companies' : 'Leads'}
      </Link>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-brand-red-pale border border-brand-red/20 rounded-md text-brand-red text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Twilio status banner — only shows when user has call permission but Twilio isn't ready */}
      {permissions.call && !twilioConfigured && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Twilio click-to-call is disabled</div>
            <div className="text-xs mt-1">
              The TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER environment variable is missing on the server.
              Add them to Vercel → Settings → Environment Variables, then redeploy. You can still log calls manually.
            </div>
          </div>
        </div>
      )}
      {permissions.call && twilioConfigured && !contact.phone && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
          <AlertCircle size={16} /> No phone number on this contact — click Edit to add one before calling.
        </div>
      )}

      {/* Header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={editForm.full_name}
                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                className="input text-lg font-bold"
              />
            ) : (
              <h1 className="font-condensed text-2xl sm:text-3xl font-black uppercase break-words">{contact.full_name}</h1>
            )}
            {(contact.company_name || editing) && (
              editing ? (
                <input
                  type="text"
                  value={editForm.company_name || ''}
                  onChange={e => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="input text-sm mt-2"
                  placeholder="Company name"
                />
              ) : (
                <p className="text-gray-600 flex items-center gap-1 mt-1">
                  <Building2 size={14} /> {contact.company_name}
                </p>
              )
            )}
          </div>
          <span className={`badge ${colors[status.color]} flex-shrink-0`}>
            {status.label}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
          {/* Browser-based Call Now button */}
          {permissions.call && contact.phone && (
            <BrowserDialer
              contactId={contact.id}
              contactName={contact.full_name}
              contactPhone={contact.phone}
              onCallEnded={() => router.refresh()}
            />
          )}
          {permissions.call && !contact.phone && (
            <button type="button"
              disabled
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add a phone number to this contact first"
            >
              <PhoneCall size={14} /> Call Now
            </button>
          )}
          {permissions.log_call && (
            <button type="button" onClick={() => setShowLogCall(true)} className="btn-outline">
              <Phone size={14} /> Log Call
            </button>
          )}
          {!editing && permissions.edit && (
            <button type="button" onClick={() => { setEditing(true); setEditForm({ ...contact }); }} className="btn-outline">
              <Edit3 size={14} /> Edit
            </button>
          )}
          {editing && (
            <>
              <button type="button" onClick={saveEdit} className="btn-primary">
                <Save size={14} /> Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="btn-outline">Cancel</button>
            </>
          )}
          {!editing && permissions.delete && (
            <button type="button" onClick={deleteContact} className="btn-ghost text-brand-red ml-auto">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>

        {/* Quick contact info */}
        {!editing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-brand-red truncate">
                <Phone size={14} className="text-gray-400 flex-shrink-0" /> {contact.phone}
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-gray-700 hover:text-brand-red truncate">
                <Mail size={14} className="text-gray-400 flex-shrink-0" /> {contact.email}
              </a>
            )}
            {contact.assigned_to_profile && (
              <div className="flex items-center gap-2 text-gray-700 truncate">
                <User size={14} className="text-gray-400 flex-shrink-0" />
                Assigned to <span className="font-semibold">{contact.assigned_to_profile.full_name}</span>
              </div>
            )}
          </div>
        )}

        {/* Status changer (always visible if user can edit) */}
        {!editing && permissions.edit && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-wider font-bold text-gray-500">Move to:</span>
            {statuses.filter(s => s.value !== contact.status).map(s => (
              <button type="button"
                key={s.value}
                onClick={() => changeStatus(s.value)}
                className={`badge hover:opacity-80 cursor-pointer ${colors[s.color]}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Edit form (when editing) */}
      {editing && (
        <div className="card p-4 sm:p-6 mb-6 space-y-3">
          <h3 className="font-condensed text-lg font-black uppercase">Edit Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Email</label>
              <input type="email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="input" /></div>
            <div><label className="label">Phone</label>
              <input type="tel" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="input" placeholder="+1 555 123 4567" /></div>
            <div><label className="label">Alternative Phone</label>
              <input type="tel" value={editForm.alternative_phone || ''} onChange={e => setEditForm({ ...editForm, alternative_phone: e.target.value })} className="input" /></div>
            <div><label className="label">Source</label>
              <input type="text" value={editForm.source || ''} onChange={e => setEditForm({ ...editForm, source: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="label">City</label>
              <input type="text" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} className="input" /></div>
            <div><label className="label">State</label>
              <input type="text" value={editForm.state || ''} onChange={e => setEditForm({ ...editForm, state: e.target.value })} className="input" /></div>
            <div><label className="label">ZIP</label>
              <input type="text" value={editForm.zip || ''} onChange={e => setEditForm({ ...editForm, zip: e.target.value })} className="input" /></div>
            <div><label className="label">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="input">
                {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select></div>
          </div>

          {type === 'sales' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Estimated Debt</label>
                <input type="number" inputMode="decimal" value={editForm.estimated_debt || ''} onChange={e => setEditForm({ ...editForm, estimated_debt: e.target.value })} className="input" /></div>
              <div><label className="label">Monthly Income</label>
                <input type="number" inputMode="decimal" value={editForm.monthly_income || ''} onChange={e => setEditForm({ ...editForm, monthly_income: e.target.value })} className="input" /></div>
            </div>
          )}

          {type === 'management' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Industry</label>
                <input type="text" value={editForm.industry || ''} onChange={e => setEditForm({ ...editForm, industry: e.target.value })} className="input" /></div>
              <div><label className="label">Estimated Deal Value</label>
                <input type="number" inputMode="decimal" value={editForm.deal_value || ''} onChange={e => setEditForm({ ...editForm, deal_value: e.target.value })} className="input" /></div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Next Follow-up</label>
              <input type="datetime-local" value={editForm.next_followup_at?.slice(0, 16) || ''} onChange={e => setEditForm({ ...editForm, next_followup_at: e.target.value })} className="input" /></div>
            {permissions.assign && (
              <div><label className="label">Assign To</label>
                <select value={editForm.assigned_to || ''} onChange={e => setEditForm({ ...editForm, assigned_to: e.target.value })} className="input">
                  <option value="">Unassigned</option>
                  {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
                </select></div>
            )}
          </div>

          <div><label className="label">General Notes</label>
            <textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3} className="input" /></div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <Tab active={activeTab === 'calls'} onClick={() => setActiveTab('calls')} icon={History}>
          Call Log {callLogs.length > 0 && `(${callLogs.length})`}
        </Tab>
        <Tab active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={MessageSquare}>
          Notes {notes.length > 0 && `(${notes.length})`}
        </Tab>
        <Tab active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon={User}>
          Team {collaborators.length > 0 && `(${collaborators.length})`}
        </Tab>
        <Tab active={activeTab === 'info'} onClick={() => setActiveTab('info')} icon={FileText}>
          Info
        </Tab>
      </div>

      {/* Tab content */}
      {activeTab === 'calls' && (
        <CallLogPanel
          callLogs={callLogs}
          contact={contact}
          permissions={permissions}
          twilioConfigured={twilioConfigured}
          onLogCall={() => setShowLogCall(true)}
        />
      )}
      {activeTab === 'notes' && (
        <NotesPanel contactId={contact.id} notes={notes} currentUser={currentUser} />
      )}
      {activeTab === 'team' && (
        <TeamPanel
          contact={contact}
          collaborators={collaborators}
          users={users}
          permissions={permissions}
          onAdd={() => setShowCollabModal(true)}
          onRemoved={() => router.refresh()}
        />
      )}
      {activeTab === 'info' && (
        <InfoPanel contact={contact} type={type} fmt={fmt} />
      )}

      {/* Collaborators modal */}
      {showCollabModal && (
        <AddCollaboratorsModal
          contactId={contact.id}
          users={users}
          existingCollabIds={new Set([
            contact.assigned_to,
            contact.created_by,
            ...collaborators.map((c: any) => c.user?.id),
          ].filter(Boolean))}
          onClose={() => setShowCollabModal(false)}
          onAdded={() => { setShowCollabModal(false); router.refresh(); }}
        />
      )}

      {/* Log Call modal */}
      {showLogCall && (
        <LogCallModal
          contactId={contact.id}
          onClose={() => setShowLogCall(false)}
          onLogged={() => { setShowLogCall(false); router.refresh(); }}
        />
      )}
    </>
  );
}

function Tab({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-ink'
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function CallLogPanel({ callLogs, permissions, twilioConfigured, onLogCall }: any) {
  if (callLogs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Phone size={28} className="mx-auto text-gray-300 mb-3" />
        <h3 className="font-condensed text-lg font-black uppercase mb-2">No Calls Yet</h3>
        <p className="text-sm text-gray-500 mb-4">Make your first call or log a manual one to get started.</p>
        {permissions.log_call && (
          <button type="button" onClick={onLogCall} className="btn-outline">
            <Phone size={14} /> Log a Call
          </button>
        )}
      </div>
    );
  }

  function fmtDuration(s: number) {
    if (!s) return '—';
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  const outcomeColors: any = {
    connected: 'badge-green',
    voicemail: 'badge-yellow',
    no_answer: 'badge-gray',
    busy: 'badge-gray',
    wrong_number: 'badge-red',
    scheduled_callback: 'badge-blue',
    follow_up: 'badge-blue',
    not_interested: 'badge-red',
    sale_closed: 'badge-green',
  };

  return (
    <div className="space-y-3">
      {callLogs.map((c: any) => {
        const outcomeLabel = CALL_OUTCOMES.find(o => o.value === c.outcome)?.label || c.outcome;
        return (
          <div key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${outcomeColors[c.outcome] || 'badge-gray'}`}>
                  {outcomeLabel}
                </span>
                <span className="badge badge-gray">
                  {c.direction === 'outbound' ? '↗ Outbound' : '↙ Inbound'}
                </span>
                {c.duration_seconds && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={11} /> {fmtDuration(c.duration_seconds)}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(c.called_at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-2">
              by <span className="font-semibold">{c.user?.full_name}</span>
            </div>
            {c.notes && <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.notes}</p>}
            {c.twilio_recording_url && (
              <audio controls className="mt-2 w-full max-w-md" src={`/api/twilio/recordings/${c.id}`}>
                Your browser does not support audio playback.
              </audio>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotesPanel({ contactId, notes, currentUser }: any) {
  const router = useRouter();
  const [newNote, setNewNote] = useState('');
  const [posting, setPosting] = useState(false);

  async function postNote() {
    if (!newNote.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/pipeline/${contactId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });
      setNewNote('');
      router.refresh();
    } finally { setPosting(false); }
  }

  async function togglePin(id: string, currentPinned: boolean) {
    await fetch(`/api/pipeline/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned: !currentPinned }),
    });
    router.refresh();
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await fetch(`/api/pipeline/notes/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <>
      <div className="card p-4 mb-4">
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          rows={2}
          placeholder="Add a note about this contact..."
          className="input mb-2"
        />
        <button type="button"
          onClick={postNote}
          disabled={posting || !newNote.trim()}
          className="btn-primary disabled:opacity-50"
        >
          <MessageSquare size={14} /> {posting ? 'Posting...' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="card p-8 text-center">
          <MessageSquare size={28} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No notes yet. Add the first one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((n: any) => (
            <div key={n.id} className={`card p-4 ${n.is_pinned ? 'border-brand-red' : ''}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm whitespace-pre-wrap">{n.note}</p>
                  <div className="text-xs text-gray-500 mt-2">
                    <span className="font-semibold">{n.user?.full_name}</span>
                    {' · '}{new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button type="button"
                    onClick={() => togglePin(n.id, n.is_pinned)}
                    className={`p-1.5 rounded transition-colors ${
                      n.is_pinned ? 'text-brand-red' : 'text-gray-400 hover:text-brand-red'
                    }`}
                    title={n.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={12} />
                  </button>
                  {n.user_id === currentUser.id && (
                    <button type="button"
                      onClick={() => deleteNote(n.id)}
                      className="p-1.5 hover:bg-red-50 text-brand-red rounded"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function InfoPanel({ contact, type, fmt }: any) {
  return (
    <div className="card p-4 sm:p-6 space-y-4">
      <Section title="Contact Information">
        <Row label="Full Name" value={contact.full_name} />
        <Row label="Company" value={contact.company_name} />
        <Row label="Email" value={contact.email} />
        <Row label="Phone" value={contact.phone} />
        <Row label="Alt Phone" value={contact.alternative_phone} />
        <Row label="Address" value={[contact.address, contact.city, contact.state, contact.zip].filter(Boolean).join(', ')} />
      </Section>

      {type === 'sales' && (
        <Section title="Financial">
          <Row label="Estimated Debt" value={fmt(contact.estimated_debt)} />
          <Row label="Monthly Income" value={fmt(contact.monthly_income)} />
          <Row label="DTI Ratio" value={contact.dti_ratio ? `${contact.dti_ratio}%` : '—'} />
        </Section>
      )}

      {type === 'management' && (
        <Section title="Deal Details">
          <Row label="Industry" value={contact.industry} />
          <Row label="Company Size" value={contact.company_size} />
          <Row label="Deal Value" value={fmt(contact.deal_value)} />
        </Section>
      )}

      <Section title="Tracking">
        <Row label="Source" value={contact.source} />
        <Row label="Created By" value={contact.created_by_profile?.full_name} />
        <Row label="Created On" value={new Date(contact.created_at).toLocaleDateString()} />
        <Row label="Last Contacted" value={contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleString() : '—'} />
        <Row label="Next Follow-up" value={contact.next_followup_at ? new Date(contact.next_followup_at).toLocaleString() : '—'} />
      </Section>

      {contact.notes && (
        <Section title="General Notes">
          <p className="text-sm whitespace-pre-wrap text-gray-700">{contact.notes}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div>
      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2 pb-2 border-b border-gray-100">{title}</h4>
      <div className="space-y-1.5 text-sm">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: any) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-right break-words">{value || '—'}</span>
    </div>
  );
}

function LogCallModal({ contactId, onClose, onLogged }: any) {
  const [outcome, setOutcome] = useState('connected');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [direction, setDirection] = useState('outbound');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/pipeline/${contactId}/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          outcome,
          duration_seconds: duration ? parseInt(duration) * 60 : null,
          notes: notes || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onLogged();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-condensed text-xl font-black uppercase">Log Call</h3>
          <button type="button" onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>

        {err && (
          <div className="mb-3 p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2">
            <AlertCircle size={14} /> {err}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('outbound')}
              className={`px-3 py-2 text-sm font-bold uppercase tracking-wider rounded ${
                direction === 'outbound' ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              ↗ Outbound
            </button>
            <button
              type="button"
              onClick={() => setDirection('inbound')}
              className={`px-3 py-2 text-sm font-bold uppercase tracking-wider rounded ${
                direction === 'inbound' ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              ↙ Inbound
            </button>
          </div>

          <div>
            <label className="label">Outcome *</label>
            <select value={outcome} onChange={e => setOutcome(e.target.value)} className="input">
              {CALL_OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Duration (minutes)</label>
            <input type="number" inputMode="numeric" min="0" value={duration} onChange={e => setDuration(e.target.value)} className="input" placeholder="0" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input" placeholder="What was discussed?" />
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Call Log'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TeamPanel({ contact, collaborators, users, permissions, onAdd, onRemoved }: any) {
  const router = useRouter();
  const owner = users.find((u: any) => u.id === contact.assigned_to);
  const creator = users.find((u: any) => u.id === contact.created_by);

  async function removeCollaborator(collabId: string, name: string) {
    if (!confirm(`Remove ${name} from this contact's team?`)) return;
    await fetch(`/api/pipeline/collaborators/${collabId}`, { method: 'DELETE' });
    onRemoved?.();
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-condensed text-lg font-black uppercase">Team on This Contact</h3>
          <p className="text-xs text-gray-500 mt-1">
            Everyone here can view, edit, and call this contact.
          </p>
        </div>
        {permissions.assign && (
          <button type="button" onClick={onAdd} className="btn-primary self-start sm:self-auto">
            <Plus size={14} /> Add Team Member
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Owner / Assigned */}
        {owner && (
          <TeamMemberRow
            user={owner}
            badge="Owner"
            badgeColor="badge-red"
            note="Primary contact owner"
            removable={false}
          />
        )}
        {/* Creator (if different from owner) */}
        {creator && creator.id !== contact.assigned_to && (
          <TeamMemberRow
            user={creator}
            badge="Created by"
            badgeColor="badge-blue"
            note="Originally added this contact"
            removable={false}
          />
        )}
        {/* Collaborators */}
        {collaborators.map((c: any) => (
          <TeamMemberRow
            key={c.id}
            user={c.user}
            badge={c.collaboration_role === 'observer' ? 'Observer' : 'Collaborator'}
            badgeColor={c.collaboration_role === 'observer' ? 'badge-gray' : 'badge-green'}
            removable={permissions.assign}
            onRemove={() => removeCollaborator(c.id, c.user?.full_name)}
          />
        ))}
        {collaborators.length === 0 && !creator && !owner && (
          <div className="card p-8 text-center">
            <User size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No team members yet.</p>
          </div>
        )}
      </div>
    </>
  );
}

function TeamMemberRow({ user, badge, badgeColor, note, removable, onRemove }: any) {
  if (!user) return null;
  const initials = (user.full_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="card p-3 sm:p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{user.full_name}</span>
          <span className={`badge ${badgeColor}`}>{badge}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {user.email} · {user.role}
          {note && ` · ${note}`}
        </div>
      </div>
      {removable && (
        <button type="button"
          onClick={onRemove}
          className="p-2 hover:bg-red-50 text-brand-red rounded transition-colors flex-shrink-0"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function AddCollaboratorsModal({ contactId, users, existingCollabIds, onClose, onAdded }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [role, setRole] = useState<'collaborator' | 'observer'>('collaborator');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const available = users.filter((u: any) =>
    !existingCollabIds.has(u.id) &&
    (search === '' ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()))
  );

  function toggle(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.length === 0) { setErr('Select at least one team member'); return; }
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/pipeline/${contactId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: selectedIds, collaboration_role: role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onAdded();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h3 className="font-condensed text-xl font-black uppercase">Add Team Members</h3>
          <button type="button" onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {err && (
            <div className="mb-3 p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2">
              <AlertCircle size={14} /> {err}
            </div>
          )}

          <div className="mb-3">
            <label className="label">Access Level</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('collaborator')}
                className={`px-3 py-2 text-sm font-bold uppercase tracking-wider rounded border-2 ${
                  role === 'collaborator' ? 'border-brand-red bg-brand-red-pale text-brand-red' : 'border-gray-200 text-gray-600'
                }`}
              >
                Collaborator
              </button>
              <button
                type="button"
                onClick={() => setRole('observer')}
                className={`px-3 py-2 text-sm font-bold uppercase tracking-wider rounded border-2 ${
                  role === 'observer' ? 'border-brand-red bg-brand-red-pale text-brand-red' : 'border-gray-200 text-gray-600'
                }`}
              >
                Observer
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {role === 'collaborator' ? 'Can view, edit, call, and add notes' : 'Read-only access'}
            </p>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, role..."
            className="input mb-3"
          />

          <div className="border border-gray-200 rounded-md max-h-72 overflow-y-auto">
            {available.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-500">
                {search ? 'No matches' : 'No more team members to add'}
              </p>
            ) : (
              available.map((u: any) => {
                const checked = selectedIds.includes(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 p-2.5 border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                      checked ? 'bg-brand-red-pale' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(u.id)}
                      className="w-4 h-4 accent-brand-red flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{u.full_name}</div>
                      <div className="text-xs text-gray-500 truncate">{u.email} · {u.role}</div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{selectedIds.length} selected</p>
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button type="button" onClick={submit} disabled={loading || selectedIds.length === 0} className="btn-primary flex-1 disabled:opacity-50">
            {loading ? 'Adding...' : `Add ${selectedIds.length} member${selectedIds.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
        </div>
      </div>
    </div>
  );
}
