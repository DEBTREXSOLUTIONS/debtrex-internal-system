"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, AlertCircle, CheckCircle, Save, ExternalLink, X, Settings, ChevronDown, ChevronUp } from 'lucide-react';

export default function TwilioNumbersManager({ twilioConfigured, twilioNumbers, users, defaultNumber, routing, appUrl }: any) {
  const router = useRouter();
  const [tab, setTab] = useState<'assignment' | 'inbound'>('assignment');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  const assignedNumbers = new Set(
    users.filter((u: any) => u.twilio_phone_number).map((u: any) => u.twilio_phone_number)
  );

  async function assignNumber(
    userId: string,
    phoneNumber: string | null,
    label: string | null,
    outboundUseDefault?: boolean,
  ) {
    setAssigning(userId); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users/${userId}/twilio-number`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twilio_phone_number: phoneNumber,
          twilio_phone_label: label,
          ...(typeof outboundUseDefault === 'boolean' ? { outbound_use_default: outboundUseDefault } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(phoneNumber ? `Assigned ${phoneNumber}` : 'Number unassigned');
      setEditingUser(null);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setAssigning(null); }
  }


  function startEdit(u: any) {
    setEditingUser(u.id);
    setEditNumber(u.twilio_phone_number || '');
    setEditLabel(u.twilio_phone_label || '');
    setError(''); setSuccess('');
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-blue-pale rounded-md flex-shrink-0">
            <Phone size={20} className="text-brand-blue" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Twilio Number Configuration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Assign caller IDs for outbound calls, and configure how inbound calls are routed.
            </p>
          </div>
        </div>
      </div>

      {!twilioConfigured && (
        <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <div className="font-bold">Twilio not configured</div>
              Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your env vars.
            </div>
          </div>
        </div>
      )}

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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabBtn active={tab === 'assignment'} onClick={() => setTab('assignment')}>
          Outbound Caller IDs
        </TabBtn>
        <TabBtn active={tab === 'inbound'} onClick={() => setTab('inbound')}>
          Inbound Call Routing
        </TabBtn>
      </div>

      {tab === 'assignment' && (
        <>
          {/* Quick summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SummaryCard label="Company Default" value={defaultNumber || '—'} subtitle="From TWILIO_PHONE_NUMBER env var" mono />
            <SummaryCard label="Numbers on Account" value={twilioNumbers.length.toString()} subtitle="Buy more at twilio.com" />
            <SummaryCard label="Assigned to Agents" value={`${users.filter((u: any) => u.twilio_phone_number).length} / ${users.length}`} subtitle="Unassigned use the default" />
          </div>

          {/* Agents table */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-condensed text-lg font-black uppercase">Agents & Their Caller IDs</h3>
                <p className="text-xs text-gray-500 mt-1">Click Edit to change which Twilio number an agent's outbound calls display.</p>
              </div>
              <a
                href="https://console.twilio.com/console/phone-numbers/incoming"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-xs"
              >
                <ExternalLink size={12} /> Manage on Twilio
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <Th>Agent</Th><Th>Personal Phone</Th><Th>Caller ID</Th><Th>Label</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: any) => {
                    const initials = u.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                    const isEditing = editingUser === u.id;
                    return (
                      <tr key={u.id} className="border-b border-gray-100">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{u.full_name}</div>
                              <div className="text-xs text-gray-500 truncate">{u.role}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{u.phone || <span className="text-gray-400">—</span>}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <select value={editNumber} onChange={e => setEditNumber(e.target.value)} className="input text-sm">
                              <option value="">— Use company default —</option>
                              {twilioNumbers
                                .filter((n: any) => !assignedNumbers.has(n.phoneNumber) || n.phoneNumber === u.twilio_phone_number)
                                .map((n: any) => (
                                  <option key={n.sid} value={n.phoneNumber}>
                                    {n.phoneNumber} {n.friendlyName !== n.phoneNumber ? `· ${n.friendlyName}` : ''}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span className="font-mono font-bold text-sm">
                              {u.twilio_phone_number || <span className="text-gray-400 font-sans font-normal text-xs italic">— default —</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="e.g. NYC line" className="input text-sm" />
                          ) : (
                            <span className="text-xs text-gray-600">{u.twilio_phone_label || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button type="button" onClick={() => assignNumber(u.id, editNumber || null, editLabel || null)} disabled={assigning === u.id} className="p-1.5 bg-brand-blue text-white rounded hover:bg-brand-blue-dark disabled:opacity-50">
                                <Save size={12} />
                              </button>
                              <button type="button" onClick={() => setEditingUser(null)} className="p-1.5 border border-gray-300 rounded hover:bg-gray-50">
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => startEdit(u)} className="text-xs font-bold uppercase tracking-wider text-brand-blue hover:underline">
                              Edit
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
        </>
      )}

      {tab === 'inbound' && (
        <InboundRoutingTab
          twilioNumbers={twilioNumbers}
          users={users}
          routing={routing}
          appUrl={appUrl}
          onSaved={() => router.refresh()}
        />
      )}
    </>
  );
}

function InboundRoutingTab({ twilioNumbers, users, routing, appUrl, onSaved }: any) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function findRouting(number: string) {
    return routing.find((r: any) => r.twilio_phone_number === number) || {
      routing_mode: 'voicemail',
      primary_agent_id: null,
      ring_timeout_seconds: 20,
      voicemail_message: 'Thank you for calling DEBTREX Solutions. Please leave a message and we will return your call.',
    };
  }

  function startEdit(number: string) {
    const r = findRouting(number);
    setEditing(number);
    setForm({
      routing_mode: r.routing_mode,
      primary_agent_id: r.primary_agent_id || '',
      ring_timeout_seconds: r.ring_timeout_seconds,
      voicemail_message: r.voicemail_message,
    });
  }

  async function save(number: string) {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/twilio/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twilio_phone_number: number,
          ...form,
          primary_agent_id: form.primary_agent_id || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setEditing(null);
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (twilioNumbers.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Phone size={28} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No phone numbers on your Twilio account yet.</p>
      </div>
    );
  }

  const inboundWebhook = `${appUrl}/api/twilio/inbound`;

  return (
    <>
      {/* Setup instructions */}
      <div className="card p-4 sm:p-6 mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Settings size={18} className="text-blue-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 leading-relaxed">
            <div className="font-bold text-sm mb-1">One-time Twilio Console setup required</div>
            <p className="mb-2">
              For inbound calls to work, set this URL as the "A call comes in" webhook on each Twilio number you want to receive calls on:
            </p>
            <code className="block bg-white px-3 py-2 rounded font-mono text-[11px] mb-2 border border-blue-200">
              {inboundWebhook}
            </code>
            <p>
              Twilio Console → Phone Numbers → click each number → under "Voice Configuration", set "A call comes in" to Webhook + paste the URL above + method POST → Save Configuration.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="space-y-3">
        {twilioNumbers.map((n: any) => {
          const r = findRouting(n.phoneNumber);
          const isEditing = editing === n.phoneNumber;
          const assignedUser = users.find((u: any) => u.id === r.primary_agent_id);

          return (
            <div key={n.sid} className="card p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <div className="font-mono font-bold text-sm">{n.phoneNumber}</div>
                  <div className="text-xs text-gray-500">{n.friendlyName}</div>
                </div>
                {!isEditing && (
                  <button type="button" onClick={() => startEdit(n.phoneNumber)} className="text-xs font-bold uppercase tracking-wider text-brand-blue hover:underline">
                    Configure
                  </button>
                )}
              </div>

              {!isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-3 border-t border-gray-100">
                  <Info label="Routing">
                    <span className={`badge ${
                      r.routing_mode === 'agent' ? 'badge-blue' :
                      r.routing_mode === 'available' ? 'badge-green' : 'badge-gray'
                    }`}>
                      {r.routing_mode === 'agent' ? 'Specific Agent' :
                        r.routing_mode === 'available' ? 'Any Available' : 'Voicemail Only'}
                    </span>
                  </Info>
                  {r.routing_mode === 'agent' && (
                    <Info label="Rings">{assignedUser?.full_name || '—'}</Info>
                  )}
                  <Info label="Ring Timeout">{r.ring_timeout_seconds || 20}s</Info>
                </div>
              ) : (
                <div className="space-y-3 pt-3 border-t border-gray-100">
                  <div>
                    <label className="label">Routing Mode</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <ModeBtn label="Specific Agent" value="agent" current={form.routing_mode} onClick={() => setForm({ ...form, routing_mode: 'agent' })} desc="One agent gets all calls" />
                      <ModeBtn label="Any Available" value="available" current={form.routing_mode} onClick={() => setForm({ ...form, routing_mode: 'available' })} desc="Rings all online agents" />
                      <ModeBtn label="Voicemail Only" value="voicemail" current={form.routing_mode} onClick={() => setForm({ ...form, routing_mode: 'voicemail' })} desc="Skip ringing, go to VM" />
                    </div>
                  </div>

                  {form.routing_mode === 'agent' && (
                    <div>
                      <label className="label">Primary Agent</label>
                      <select value={form.primary_agent_id} onChange={e => setForm({ ...form, primary_agent_id: e.target.value })} className="input">
                        <option value="">— Select an agent —</option>
                        {users.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Calls only ring if this agent's status is "Online". Otherwise they go to voicemail.
                      </p>
                    </div>
                  )}

                  {(form.routing_mode === 'agent' || form.routing_mode === 'available') && (
                    <div>
                      <label className="label">Ring Timeout (seconds)</label>
                      <input type="number" min="5" max="60" value={form.ring_timeout_seconds} onChange={e => setForm({ ...form, ring_timeout_seconds: parseInt(e.target.value) || 20 })} className="input" />
                      <p className="text-xs text-gray-500 mt-1">If no one picks up in this time, call goes to voicemail.</p>
                    </div>
                  )}

                  <div>
                    <label className="label">Voicemail Greeting</label>
                    <textarea value={form.voicemail_message} onChange={e => setForm({ ...form, voicemail_message: e.target.value })} rows={2} className="input" />
                    <p className="text-xs text-gray-500 mt-1">Played by Twilio's voice synthesis when calls go to voicemail.</p>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <button type="button" onClick={() => save(n.phoneNumber)} disabled={saving} className="btn-primary disabled:opacity-50">
                      <Save size={14} /> {saving ? 'Saving...' : 'Save Routing'}
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button type="button" onClick={onClick} className={`px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
      active ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-brand-ink'
    }`}>
      {children}
    </button>
  );
}

function SummaryCard({ label, value, subtitle, mono }: any) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">{label}</div>
      <div className={`text-sm font-bold ${mono ? 'font-mono' : 'font-condensed text-2xl'}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}

function Info({ label, children }: any) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function ModeBtn({ label, value, current, onClick, desc }: any) {
  const active = current === value;
  return (
    <button type="button" onClick={onClick} className={`p-3 text-left border-2 rounded-md transition-colors ${
      active ? 'border-brand-blue bg-brand-blue-pale' : 'border-gray-200 hover:border-gray-300'
    }`}>
      <div className={`font-bold text-sm ${active ? 'text-brand-blue' : 'text-gray-800'}`}>{label}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{desc}</div>
    </button>
  );
}
