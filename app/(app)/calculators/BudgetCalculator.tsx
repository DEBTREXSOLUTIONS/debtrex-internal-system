"use client";
import { useState, useMemo } from 'react';
import { Save, AlertCircle, CheckCircle, Plus, X, DollarSign, Wallet } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'Housing (Rent/Mortgage)', 'Utilities', 'Groceries', 'Transportation',
  'Insurance', 'Phone/Internet', 'Subscriptions', 'Childcare',
  'Healthcare', 'Entertainment', 'Other'
];
const DEBT_CATEGORIES = [
  'Credit Cards', 'Personal Loans', 'Auto Loan', 'Student Loans',
  'Medical Debt', 'Tax Debt', 'Other Debt'
];

interface LineItem { id: string; category: string; amount: string; }

export default function BudgetCalculator({ onSaved }: any) {
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState<LineItem[]>([
    { id: '1', category: 'Housing (Rent/Mortgage)', amount: '' },
    { id: '2', category: 'Utilities', amount: '' },
    { id: '3', category: 'Groceries', amount: '' },
  ]);
  const [debts, setDebts] = useState<LineItem[]>([
    { id: '1', category: 'Credit Cards', amount: '' },
  ]);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculations
  const totals = useMemo(() => {
    const incomeNum = parseFloat(income) || 0;
    const expenseTotal = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const debtTotal = debts.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
    const totalOutflow = expenseTotal + debtTotal;
    const disposable = incomeNum - totalOutflow;
    const expenseRatio = incomeNum > 0 ? (expenseTotal / incomeNum) * 100 : 0;
    const debtRatio = incomeNum > 0 ? (debtTotal / incomeNum) * 100 : 0;

    // Recommended program logic
    let program: string | null = null;
    let estPayment: number | null = null;
    let estSavings: number | null = null;

    if (incomeNum > 0 && debtTotal > 0) {
      if (debtRatio >= 50) {
        program = 'Debt Settlement';
        estPayment = Math.max(debtTotal * 0.5 / 36, 100); // 50% over 36 months
        estSavings = debtTotal - estPayment * 36;
      } else if (debtRatio >= 35) {
        program = 'Debt Consolidation';
        estPayment = debtTotal * 0.04; // ~4% per month over 24-36 months
        estSavings = debtTotal * 0.15;
      } else if (debtRatio >= 20) {
        program = 'Debt Management Plan';
        estPayment = debtTotal * 0.03;
        estSavings = debtTotal * 0.08;
      } else {
        program = 'Self-Pay (no program needed)';
      }
    }

    return { incomeNum, expenseTotal, debtTotal, totalOutflow, disposable, expenseRatio, debtRatio, program, estPayment, estSavings };
  }, [income, expenses, debts]);

  function addExpense() {
    setExpenses([...expenses, { id: Date.now().toString(), category: 'Other', amount: '' }]);
  }
  function removeExpense(id: string) {
    setExpenses(expenses.filter(e => e.id !== id));
  }
  function updateExpense(id: string, field: 'category' | 'amount', val: string) {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: val } : e));
  }

  function addDebt() {
    setDebts([...debts, { id: Date.now().toString(), category: 'Other Debt', amount: '' }]);
  }
  function removeDebt(id: string) {
    setDebts(debts.filter(d => d.id !== id));
  }
  function updateDebt(id: string, field: 'category' | 'amount', val: string) {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: val } : d));
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  async function save() {
    if (!clientName.trim()) { setError('Client name required'); return; }
    if (totals.incomeNum <= 0) { setError('Enter monthly income'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const expenseBreakdown: any = {};
      expenses.forEach(e => { if (e.amount) expenseBreakdown[e.category] = parseFloat(e.amount) || 0; });
      const debtBreakdown: any = {};
      debts.forEach(d => { if (d.amount) debtBreakdown[d.category] = parseFloat(d.amount) || 0; });

      const res = await fetch('/api/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculation_type: 'budget',
          client_name: clientName,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          monthly_net_income: totals.incomeNum,
          total_monthly_expenses: totals.expenseTotal,
          monthly_disposable_income: Math.round(totals.disposable * 100) / 100,
          expense_breakdown: expenseBreakdown,
          debt_breakdown: debtBreakdown,
          total_debt: totals.debtTotal,
          recommended_program: totals.program,
          estimated_monthly_payment: totals.estPayment ? Math.round(totals.estPayment * 100) / 100 : null,
          estimated_savings: totals.estSavings ? Math.round(totals.estSavings * 100) / 100 : null,
          notes: notes || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(`Budget saved for ${clientName}`);
      onSaved?.();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inputs */}
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-brand-red-pale border border-brand-red/20 rounded-md text-brand-red text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Income */}
        <div className="card p-4 sm:p-6">
          <h3 className="font-condensed text-lg font-black uppercase mb-3">1. Monthly Income</h3>
          <div>
            <label className="label">Net Monthly Income (After Taxes) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={income}
                onChange={e => setIncome(e.target.value)}
                placeholder="4500"
                className="input pl-7 text-lg"
              />
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-condensed text-lg font-black uppercase">2. Monthly Expenses</h3>
            <button onClick={addExpense} className="btn-ghost">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="flex gap-2">
                <select value={e.category} onChange={ev => updateExpense(e.id, 'category', ev.target.value)} className="input flex-1 min-w-0">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative w-32 flex-shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={e.amount}
                    onChange={ev => updateExpense(e.id, 'amount', ev.target.value)}
                    placeholder="0"
                    className="input pl-6"
                  />
                </div>
                <button onClick={() => removeExpense(e.id)} className="p-2 hover:bg-red-50 text-brand-red rounded transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Total Expenses</span>
            <span className="font-condensed text-xl font-black text-brand-ink">{fmt(totals.expenseTotal)}</span>
          </div>
        </div>

        {/* Debts */}
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-condensed text-lg font-black uppercase">3. Monthly Debt Payments</h3>
            <button onClick={addDebt} className="btn-ghost">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="space-y-2">
            {debts.map(d => (
              <div key={d.id} className="flex gap-2">
                <select value={d.category} onChange={ev => updateDebt(d.id, 'category', ev.target.value)} className="input flex-1 min-w-0">
                  {DEBT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="relative w-32 flex-shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={d.amount}
                    onChange={ev => updateDebt(d.id, 'amount', ev.target.value)}
                    placeholder="0"
                    className="input pl-6"
                  />
                </div>
                <button onClick={() => removeDebt(d.id)} className="p-2 hover:bg-red-50 text-brand-red rounded transition-colors flex-shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">Total Debt Payments</span>
            <span className="font-condensed text-xl font-black text-brand-red">{fmt(totals.debtTotal)}</span>
          </div>
        </div>

        {/* Save */}
        <div className="card p-4 sm:p-6">
          <h3 className="font-condensed text-lg font-black uppercase mb-3">4. Save For Client</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Client Name *</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="John Smith" className="input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" />
            </div>
            <button onClick={save} disabled={saving || !clientName.trim() || totals.incomeNum <= 0} className="btn-primary w-full disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Budget Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Results sidebar */}
      <div className="space-y-4">
        <div className="bg-brand-ink text-white p-5 rounded-lg sticky top-20">
          <div className="text-xs uppercase tracking-widest opacity-70 mb-1">Disposable Income</div>
          <div className={`font-condensed text-4xl font-black ${totals.disposable < 0 ? 'text-brand-red' : 'text-white'}`}>
            {fmt(totals.disposable)}
          </div>
          <div className="text-xs opacity-70 mt-1">per month after expenses & debt</div>

          <div className="mt-5 pt-5 border-t border-white/10 space-y-3">
            <Row label="Income" value={fmt(totals.incomeNum)} />
            <Row label="Expenses" value={`-${fmt(totals.expenseTotal)}`} />
            <Row label="Debt Payments" value={`-${fmt(totals.debtTotal)}`} muted={false} negative />
          </div>

          <div className="mt-5 pt-5 border-t border-white/10">
            <div className="text-xs uppercase tracking-widest opacity-70 mb-2">Debt Ratio</div>
            <div className={`font-condensed text-2xl font-black ${
              totals.debtRatio < 36 ? 'text-green-400' :
              totals.debtRatio < 43 ? 'text-yellow-400' : 'text-brand-red'
            }`}>
              {totals.debtRatio.toFixed(1)}%
            </div>
          </div>

          {totals.program && (
            <div className="mt-5 pt-5 border-t border-white/10">
              <div className="text-xs uppercase tracking-widest text-brand-red font-bold mb-1">Recommended</div>
              <div className="font-bold text-base">{totals.program}</div>
              {totals.estPayment != null && totals.estPayment > 0 && (
                <div className="text-sm opacity-80 mt-2">
                  Est. {fmt(totals.estPayment)}/mo
                  {totals.estSavings && totals.estSavings > 0 && (
                    <span className="text-green-400"> · saves {fmt(totals.estSavings)}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, negative }: any) {
  return (
    <div className="flex justify-between text-sm">
      <span className="opacity-70">{label}</span>
      <span className={`font-bold ${negative ? 'text-red-400' : ''}`}>{value}</span>
    </div>
  );
}
