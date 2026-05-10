"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, User, AlertCircle, CheckCircle, RefreshCw, Save, ExternalLink, X } from 'lucide-react';

export default function TwilioNumbersManager({ twilioConfigured, twilioNumbers, users, defaultNumber }: any) {
  const router = useRouter();
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editLabel, setEditLabel] = useState('');

  // Which Twilio numbers are already assigned?
  const assignedNumbers = new Set(
    users.filter((u: any) => u.twilio_phone_number).map((u: any) => u.twilio_phone_number)
  );

  const unassignedTwilioNumbers = twilioNumbers.filter((n: any) => !assignedNumbers.has(n.phoneNumber));

  async function assignNumber(userId: string, phoneNumber: string | null, label: string | null) {
    setAssigning(userId); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/users/${userId}/twilio-number`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twilio_phone_number: phoneNumber, twilio_phone_label: label }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(phoneNumber ? `Assigned ${phoneNumber}` : 'Number unassigned');
      setEditingUser(null);
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setAssigning(null); }
  }

  function startEdit(user: any) {
    setEditingUser(user.id);
    setEditNumber(user.twilio_phone_number || '');
    setEditLabel(user.twilio_phone_label || '');
    setError(''); setSuccess('');
  }

  return (
    <>
      {/* Header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-red-pale rounded-md flex-shrink-0">
            <Phone size={20} className="text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Twilio Number Assignment</h2>
            <p className="text-sm text-gray-500 mt-1">
              Assign which Twilio number each agent uses as caller ID when making outbound calls.
              Unassigned agents fall back to the company default.
            </p>
          </div>
        </div>
      </div>

      {!twilioConfigured && (
        <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-yellow-800 text-sm">Twilio not configured</div>
              <div className="text-xs text-yellow-700 mt-1">
                Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment variables to enable click-to-call. See the Twilio Setup Guide.
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Company default + summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Company Default</div>
          <div className="font-mono text-sm font-bold">{defaultNumber || '—'}</div>
          <div className="text-xs text-gray-400 mt-1">From TWILIO_PHONE_NUMBER env var</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Numbers on Account</div>
          <div className="font-condensed text-2xl font-black">{twilioNumbers.length}</div>
          <div className="text-xs text-gray-400 mt-1">Buy more at twilio.com</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Assigned to Agents</div>
          <div className="font-condensed text-2xl font-black">
            {users.filter((u: any) => u.twilio_phone_number).length} / {users.length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Unassigned use the default</div>
        </div>
      </div>

      {/* Twilio Numbers list */}
      <div className="card overflow-hidden mb-6">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-condensed text-lg font-black uppercase">Numbers on Your Twilio Account</h3>
            <p className="text-xs text-gray-500 mt-1">All numbers below are owned by your Twilio account.</p>
          </div>
          <a
            href="https://console.twilio.com/console/phone-numbers/incoming"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-xs"
          >
            <ExternalLink size={12} /> Buy more on Twilio
          </a>
        </div>
        {twilioNumbers.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            {twilioConfigured
              ? 'No phone numbers found on your Twilio account. Buy one at twilio.com.'
              : 'Configure Twilio env vars to load numbers from your account.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th>Phone Number</Th><Th>Friendly Name</Th><Th>Status</Th><Th>Assigned To</Th>
                </tr>
              </thead>
              <tbody>
                {twilioNumbers.map((n: any) => {
                  const assignedUser = users.find((u: any) => u.twilio_phone_number === n.phoneNumber);
                  return (
                    <tr key={n.sid} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-mono font-bold">{n.phoneNumber}</td>
                      <td className="px-4 py-3 text-gray-600">{n.friendlyName}</td>
                      <td className="px-4 py-3">
                        {assignedUser
                          ? <span className="badge badge-green">Assigned</span>
                          : <span className="badge badge-gray">Available</span>}
                      </td>
                      <td className="px-4 py-3">
                        {assignedUser ? (
                          <div className="text-sm">
                            <div className="font-semibold">{assignedUser.full_name}</div>
                            <div className="text-xs text-gray-500">{assignedUser.role}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agents with their assigned numbers */}
      <div className="card overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h3 className="font-condensed text-lg font-black uppercase">Agents & Caller ID</h3>
          <p className="text-xs text-gray-500 mt-1">
            Click "Edit" next to an agent to change their Twilio number.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Agent</Th><Th>Personal Phone</Th><Th>Caller ID (Twilio Number)</Th><Th>Label</Th><Th></Th>
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
                        <div className="w-8 h-8 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{u.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{u.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {u.phone || <span className="text-gray-400">— not set —</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select value={editNumber} onChange={e => setEditNumber(e.target.value)} className="input text-sm">
                          <option value="">— Use company default —</option>
                          {/* Show numbers that are unassigned OR currently assigned to THIS user */}
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
                          {u.twilio_phone_number || <span className="text-gray-400 font-sans font-normal text-xs italic">— uses default —</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          placeholder="e.g. NYC line"
                          className="input text-sm"
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{u.twilio_phone_label || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => assignNumber(u.id, editNumber || null, editLabel || null)}
                            disabled={assigning === u.id}
                            className="p-1.5 bg-brand-red text-white rounded hover:bg-brand-red-dark disabled:opacity-50"
                            title="Save"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="p-1.5 border border-gray-300 rounded hover:bg-gray-50"
                            title="Cancel"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="text-xs font-bold uppercase tracking-wider text-brand-red hover:underline"
                        >
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
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}
