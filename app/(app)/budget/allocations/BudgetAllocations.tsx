"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Save, Trash2, ChevronLeft, ChevronRight, Copy, AlertCircle, CheckCircle } from 'lucide-react';

const CATEGORIES = [
  'Marketing', 'Software', 'Salaries', 'Rent', 'Utilities',
  'Office', 'Travel', 'Entertainment', 'Legal', 'Other'
];

interface Allocation {
  id?: string;
  month: string;
  category: string;
  allocated_amount: number | string;
  notes?: string;
  isNew?: boolean;
  isDirty?: boolean;
}

export default function BudgetAllocations({ month, allocations: initial, spentByCategory }: any) {
  const router = useRouter();
  const [rows, setRows] = useState<Allocation[]>(
    initial.length > 0 ? initial : []
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  // Month label
  const monthLabel = new Date(month + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function changeMonth(delta: number) {
    const d = new Date(month + 'T00:00:00');
    d.setMonth(d.getMonth() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    router.push(`/budget/allocations?month=${next}`);
  }

  function addRow() {
    setRows([...rows, {
      month,
      category: CATEGORIES.find(c => !rows.some(r => r.category === c)) || 'Other',
      allocated_amount: '',
      notes: '',
      isNew: true,
      isDirty: true,
    }]);
  }

  function updateRow(idx: number, field: keyof Allocation, value: any) {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value, isDirty: true };
    setRows(next);
  }

  async function saveRow(idx: number) {
    const row = rows[idx];
    if (!row.category || !row.allocated_amount) {
      setError('Category and amount are required');
      return;
    }
    setError('');
    setSaving(`${idx}`);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: row.month,
          category: row.category,
          allocated_amount: parseFloat(String(row.allocated_amount)),
          notes: row.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update row with returned id, mark clean
      const next = [...rows];
      next[idx] = { ...row, id: data.id, isNew: false, isDirty: false };
      setRows(next);
      setSuccess(`${row.category} saved`);
      setTimeout(() => setSuccess(''), 2000);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function deleteRow(idx: number) {
    const row = rows[idx];
    if (!confirm(`Delete the ${row.category} budget for ${monthLabel}?`)) return;

    if (row.isNew) {
      // Just remove from state
      setRows(rows.filter((_, i) => i !== idx));
      return;
    }

    setSaving(`${idx}`);
    try {
      const res = await fetch(`/api/budgets/${row.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setRows(rows.filter((_, i) => i !== idx));
      setSuccess(`${row.category} removed`);
      setTimeout(() => setSuccess(''), 2000);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  async function copyFromLastMonth() {
    if (!confirm('Copy all budget allocations from the previous month? This will skip any categories already set for this month.')) return;
    setError('');
    setSaving('copy');
    try {
      const res = await fetch('/api/budgets/copy-previous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(`Copied ${data.copied} budget allocation(s) from previous month`);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  }

  const totalAllocated = rows.reduce((sum, r) => sum + (parseFloat(String(r.allocated_amount)) || 0), 0);
  const totalSpent = Object.values(spentByCategory).reduce((sum: number, n: any) => sum + n, 0);

  return (
    <>
      {/* Back link */}
      <Link href="/budget" className="btn-ghost mb-4">
        <ArrowLeft size={14} /> Back to Budget Dashboard
      </Link>

      {/* Month selector */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h2 className="font-condensed text-2xl font-black uppercase">{monthLabel}</h2>
              <p className="text-xs text-gray-500">Set how much to allocate per category</p>
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              title="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={copyFromLastMonth} disabled={saving === 'copy'} className="btn-outline text-xs disabled:opacity-50">
              <Copy size={12} /> Copy from Last Month
            </button>
            <button onClick={addRow} className="btn-primary">
              <Plus size={14} /> Add Category
            </button>
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

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Total Allocated</div>
          <div className="font-condensed text-3xl font-black mt-1">{fmt(totalAllocated)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Spent This Month</div>
          <div className="font-condensed text-3xl font-black mt-1">{fmt(totalSpent)}</div>
        </div>
        <div className={`p-5 rounded-lg ${totalSpent > totalAllocated && totalAllocated > 0 ? 'bg-brand-red text-white' : 'card'}`}>
          <div className={`text-xs uppercase tracking-wider font-semibold ${totalSpent > totalAllocated && totalAllocated > 0 ? 'opacity-80' : 'text-gray-500'}`}>
            Remaining
          </div>
          <div className="font-condensed text-3xl font-black mt-1">{fmt(totalAllocated - totalSpent)}</div>
        </div>
      </div>

      {/* Allocations table */}
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="font-condensed text-xl font-black uppercase mb-2">No Budget Set Yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add your first category to start tracking spending against budget for {monthLabel}.
            </p>
            <button onClick={addRow} className="btn-primary">
              <Plus size={14} /> Add First Category
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <Th>Category</Th>
                  <Th>Allocated Amount</Th>
                  <Th>Spent</Th>
                  <Th>Remaining</Th>
                  <Th>Notes</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const spent = spentByCategory[row.category] || 0;
                  const allocated = parseFloat(String(row.allocated_amount)) || 0;
                  const remaining = allocated - spent;
                  const pct = allocated > 0 ? (spent / allocated) * 100 : 0;
                  const over = pct > 100;

                  return (
                    <tr key={row.id || `new-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {row.isNew ? (
                          <select
                            value={row.category}
                            onChange={e => updateRow(idx, 'category', e.target.value)}
                            className="input text-sm py-1 px-2"
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-semibold">{row.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative w-32">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.allocated_amount}
                            onChange={e => updateRow(idx, 'allocated_amount', e.target.value)}
                            className="input pl-6 text-sm py-1"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`font-semibold ${over ? 'text-brand-red' : ''}`}>{fmt(spent)}</div>
                        {allocated > 0 && (
                          <div className="mt-1 w-32 h-1.5 bg-gray-100 rounded overflow-hidden">
                            <div
                              className={`h-full ${over ? 'bg-brand-red' : 'bg-brand-ink'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${remaining < 0 ? 'text-brand-red' : 'text-green-700'}`}>
                          {fmt(remaining)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={row.notes || ''}
                          onChange={e => updateRow(idx, 'notes', e.target.value)}
                          className="input text-sm py-1 max-w-xs"
                          placeholder="Optional"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {row.isDirty && (
                            <button
                              onClick={() => saveRow(idx)}
                              disabled={saving === `${idx}`}
                              className="px-2 py-1 bg-brand-red hover:bg-brand-red-dark text-white rounded text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-1"
                            >
                              <Save size={11} /> Save
                            </button>
                          )}
                          <button
                            onClick={() => deleteRow(idx)}
                            disabled={saving === `${idx}`}
                            className="p-1.5 hover:bg-red-50 text-brand-red rounded transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-6 card p-4 bg-gray-50 text-sm text-gray-600">
        <div className="font-bold text-brand-ink mb-1">How this works</div>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Set an amount for each category to allocate this month's spending against</li>
          <li>The Budget dashboard then shows real-time spend vs allocation per category</li>
          <li>When approved expenses cross 90% of an allocation, alerts can be sent (configure later in cron jobs)</li>
          <li>Use "Copy from Last Month" at the start of each month for fast setup</li>
        </ul>
      </div>
    </>
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}
