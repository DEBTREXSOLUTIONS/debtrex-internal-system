"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, AlertCircle, CheckCircle, Shield, Lock, AlertTriangle } from 'lucide-react';

export default function PermissionsManager({ matrix: initialMatrix, groups, labels, roles }: any) {
  const router = useRouter();
  const [matrix, setMatrix] = useState<any>(initialMatrix);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function toggle(role: string, key: string) {
    setMatrix((prev: any) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [key]: !prev[role]?.[key] },
    }));
    setDirty(true);
    setSuccess('');
  }

  function toggleGroup(role: string, keys: string[], on: boolean) {
    setMatrix((prev: any) => {
      const next = { ...(prev[role] || {}) };
      keys.forEach(k => { next[k] = on; });
      return { ...prev, [role]: next };
    });
    setDirty(true);
    setSuccess('');
  }

  async function saveAll() {
    setSaving(true); setError(''); setSuccess('');
    try {
      // Flatten matrix into permission rows
      const updates: { role: string; permission_key: string; enabled: boolean }[] = [];
      for (const role of Object.keys(matrix)) {
        for (const key of Object.keys(matrix[role])) {
          updates.push({ role, permission_key: key, enabled: !!matrix[role][key] });
        }
      }
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(`Saved ${updates.length} permission${updates.length === 1 ? '' : 's'}. Reloading...`);
      setDirty(false);
      // Bust the sidebar's sessionStorage permission cache, then hard-reload
      // so the sidebar (and any other in-memory state) reflects the new perms.
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && k.startsWith('perms_')) sessionStorage.removeItem(k);
        }
      } catch {}
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-red-pale rounded-md flex-shrink-0">
            <Shield size={20} className="text-brand-red" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Role Permissions</h2>
            <p className="text-sm text-gray-500 mt-1">
              Toggle what each role can do. Changes take effect immediately after saving.
            </p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-yellow-700 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-800">
            <div className="font-bold mb-1">Be careful with these toggles</div>
            <p className="leading-relaxed">
              Disabling permissions can lock people out of their work. Test with a non-CEO account before saving big changes.
              CEO and Owner roles always have full access — those rows can be edited but it's strongly recommended to keep them ON.
            </p>
          </div>
        </div>
      </div>

      {/* Status messages */}
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

      {/* Save bar (sticky if dirty) */}
      {dirty && (
        <div className="sticky top-16 z-10 mb-4 card p-3 sm:p-4 bg-brand-ink text-white flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            <span className="font-bold">Unsaved changes</span> — click Save to apply.
          </div>
          <button onClick={saveAll} disabled={saving} className="btn-primary disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}

      {/* Permission groups */}
      <div className="space-y-6">
        {groups.map((group: any) => (
          <div key={group.label} className="card overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-condensed text-base font-black uppercase">{group.label}</h3>
              <div className="flex gap-1">
                <span className="text-xs text-gray-500 hidden sm:inline">Quick: </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-600 sticky left-0 bg-gray-50/50">
                      Permission
                    </th>
                    {roles.map((r: any) => (
                      <th key={r.value} className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-gray-600">
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Group header row with quick toggle-all-on / toggle-all-off per role */}
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <td className="px-3 sm:px-4 py-2 sticky left-0 bg-gray-50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Quick set:</span>
                    </td>
                    {roles.map((r: any) => {
                      const allOn = group.keys.every((k: string) => matrix[r.value]?.[k]);
                      const allOff = group.keys.every((k: string) => !matrix[r.value]?.[k]);
                      return (
                        <td key={r.value} className="px-1 py-1 text-center">
                          <div className="flex flex-col gap-0.5 items-center">
                            <button
                              onClick={() => toggleGroup(r.value, group.keys, true)}
                              disabled={allOn}
                              className="text-[9px] uppercase font-bold tracking-wider text-green-700 hover:bg-green-50 disabled:opacity-30 px-1 rounded"
                              title="All on"
                            >
                              all on
                            </button>
                            <button
                              onClick={() => toggleGroup(r.value, group.keys, false)}
                              disabled={allOff}
                              className="text-[9px] uppercase font-bold tracking-wider text-brand-red hover:bg-red-50 disabled:opacity-30 px-1 rounded"
                              title="All off"
                            >
                              all off
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {group.keys.map((key: string) => (
                    <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-2.5 sticky left-0 bg-white">
                        <div className="text-sm font-medium">{labels[key] || key}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{key}</div>
                      </td>
                      {roles.map((r: any) => {
                        const enabled = !!matrix[r.value]?.[key];
                        const isLocked = (r.value === 'ceo' || r.value === 'owner') && key === 'permissions.manage';
                        return (
                          <td key={r.value} className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => !isLocked && toggle(r.value, key)}
                              disabled={isLocked}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                enabled ? 'bg-brand-red' : 'bg-gray-300'
                              }`}
                              title={isLocked ? 'Cannot disable for top roles' : enabled ? 'On' : 'Off'}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  enabled ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                              {isLocked && (
                                <Lock size={9} className="absolute right-0.5 top-0.5 text-white/60" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom save */}
      {dirty && (
        <div className="mt-6 flex justify-end">
          <button onClick={saveAll} disabled={saving} className="btn-primary disabled:opacity-50">
            <Save size={14} /> {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}
    </>
  );
}
