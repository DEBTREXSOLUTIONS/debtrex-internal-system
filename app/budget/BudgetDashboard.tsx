"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, AlertCircle, DollarSign, TrendingUp, TrendingDown, Wallet, Check, Ban, Settings } from 'lucide-react';

const CATEGORIES = ['Marketing', 'Software', 'Salaries', 'Rent', 'Utilities', 'Office', 'Travel', 'Entertainment', 'Legal', 'Other'];

export default function BudgetDashboard({ user, stats, expenses, income, budgets, byCategory, pendingExpenses }: any) {
  const router = useRouter();
  const [showExpense, setShowExpense] = useState(false);
  const [showIncome, setShowIncome] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  const isOverBudget = stats.monthSpent > stats.monthBudget && stats.monthBudget > 0;
  const percentUsed = stats.monthBudget > 0 ? (stats.monthSpent / stats.monthBudget) * 100 : 0;

  return (
    <>
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPI icon={Wallet} label="Total Balance" value={fmt(stats.balance)} color={stats.balance >= 0 ? 'red' : 'gray'} />
        <KPI icon={DollarSign} label="Monthly Budget" value={fmt(stats.monthBudget)} color="gray" />
        <KPI
          icon={TrendingDown}
          label="Spent This Month"
          value={fmt(stats.monthSpent)}
          color={isOverBudget ? 'red' : 'gray'}
          subtext={`${percentUsed.toFixed(0)}% of budget`}
        />
        <KPI
          icon={TrendingUp}
          label="Remaining"
          value={fmt(stats.monthRemaining)}
          color={stats.monthRemaining < 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button onClick={() => setShowExpense(true)} className="btn-primary">
          <Plus size={14} /> Record Expense
        </button>
        <button onClick={() => setShowIncome(true)} className="btn-outline">
          <Plus size={14} /> Record Income
        </button>
        <Link href="/budget/allocations" className="btn-outline">
          <Settings size={14} /> Set Monthly Budget
        </Link>
      </div>

      {/* Pending approvals + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pending */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-condensed text-xl font-black uppercase">Pending Approvals</h3>
            {pendingExpenses.length > 0 && (
              <span className="badge badge-yellow">{pendingExpenses.length} waiting</span>
            )}
          </div>
          {pendingExpenses.length > 0 ? (
            <div className="space-y-3">
              {pendingExpenses.map((e: any) => (
                <PendingExpenseRow key={e.id} expense={e} onUpdate={() => router.refresh()} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4 text-center">No expenses pending approval.</p>
          )}
        </div>

        {/* Categories */}
        <div className="card p-6">
          <h3 className="font-condensed text-xl font-black uppercase mb-4">By Category (This Month)</h3>
          {Object.keys(byCategory).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(byCategory).map(([cat, amt]: any) => {
                const budget = budgets.find((b: any) => b.category === cat)?.allocated_amount || 0;
                const pct = budget > 0 ? (amt / budget) * 100 : 0;
                const over = pct > 100;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{cat}</span>
                      <span className={over ? 'text-brand-red font-bold' : 'text-gray-700'}>
                        {fmt(amt)}{budget > 0 && ` / ${fmt(budget)}`}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded overflow-hidden">
                      <div
                        className={`h-full ${over ? 'bg-brand-red' : 'bg-brand-ink'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No expenses yet this month.</p>
          )}
        </div>
      </div>

      {/* All transactions */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-condensed text-xl font-black uppercase">All Expenses</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <Th>Date</Th><Th>Description</Th><Th>Category</Th><Th>Paid By</Th>
                <Th>Amount</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e: any) => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <Td>{new Date(e.expense_date).toLocaleDateString()}</Td>
                  <Td>
                    <div className="font-semibold">{e.description}</div>
                    {e.vendor && <div className="text-xs text-gray-500">{e.vendor}</div>}
                  </Td>
                  <Td>{e.category}</Td>
                  <Td>{e.paid_by_profile?.full_name}</Td>
                  <Td><span className="font-bold">{fmt(parseFloat(e.amount))}</span></Td>
                  <Td>
                    <span className={`badge ${
                      e.status === 'approved' ? 'badge-green' :
                      e.status === 'rejected' ? 'badge-red' :
                      e.status === 'reimbursed' ? 'badge-blue' : 'badge-yellow'
                    }`}>
                      {e.status}
                    </span>
                  </Td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No expenses recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showExpense && <ExpenseModal onClose={() => setShowExpense(false)} onSaved={() => { setShowExpense(false); router.refresh(); }} />}
      {showIncome && <IncomeModal onClose={() => setShowIncome(false)} onSaved={() => { setShowIncome(false); router.refresh(); }} />}
    </>
  );
}

function KPI({ icon: Icon, label, value, color, subtext }: any) {
  const colors: any = {
    red: 'bg-brand-red text-white',
    gray: 'bg-white border border-gray-200',
  };
  const iconBg = color === 'red' ? 'bg-white/20 text-white' : 'bg-brand-red-pale text-brand-red';
  return (
    <div className={`p-5 rounded-lg ${colors[color]}`}>
      <div className={`inline-flex p-2 rounded-md ${iconBg} mb-3`}>
        <Icon size={16} />
      </div>
      <div className="font-condensed text-3xl font-black">{value}</div>
      <div className={`text-xs uppercase tracking-wider font-semibold mt-1 ${color === 'red' ? 'opacity-80' : 'text-gray-500'}`}>
        {label}
      </div>
      {subtext && <div className={`text-xs mt-1 ${color === 'red' ? 'opacity-70' : 'text-gray-400'}`}>{subtext}</div>}
    </div>
  );
}

function Th({ children }: any) { return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>; }
function Td({ children }: any) { return <td className="px-4 py-3 text-sm">{children}</td>; }

function PendingExpenseRow({ expense, onUpdate }: any) {
  const [loading, setLoading] = useState(false);
  async function decide(status: 'approved' | 'rejected') {
    setLoading(true);
    try {
      await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onUpdate();
    } finally { setLoading(false); }
  }
  return (
    <div className="flex items-start justify-between gap-3 p-3 border border-gray-200 rounded-md">
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{expense.description}</div>
        <div className="text-xs text-gray-500">
          {expense.paid_by_profile?.full_name} • {expense.category} • {new Date(expense.expense_date).toLocaleDateString()}
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold">${parseFloat(expense.amount).toFixed(2)}</div>
        <div className="flex gap-1 mt-1">
          <button onClick={() => decide('approved')} disabled={loading} className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-bold disabled:opacity-50">
            <Check size={11} className="inline" /> Approve
          </button>
          <button onClick={() => decide('rejected')} disabled={loading} className="px-2 py-1 bg-red-100 hover:bg-red-200 text-brand-red rounded text-xs font-bold disabled:opacity-50">
            <Ban size={11} className="inline" /> Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpenseModal({ onClose, onSaved }: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    amount: '', category: 'Marketing', description: '', vendor: '',
    payment_method: 'card', expense_date: new Date().toISOString().split('T')[0],
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 fade-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-condensed text-2xl font-black uppercase">Record Expense</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>
        {error && <div className="mb-3 p-2 bg-brand-red-pale text-brand-red text-sm rounded flex items-center gap-2"><AlertCircle size={14}/>{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount *</label>
              <input required type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="input" placeholder="0.00" /></div>
            <div><label className="label">Date *</label>
              <input required type="date" value={form.expense_date} onChange={e => setForm({...form, expense_date: e.target.value})} className="input" /></div>
          </div>
          <div><label className="label">Category *</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="label">Description *</label>
            <input required type="text" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input" placeholder="What is this expense for?" /></div>
          <div><label className="label">Vendor</label>
            <input type="text" value={form.vendor} onChange={e => setForm({...form, vendor: e.target.value})} className="input" placeholder="e.g., Adobe, Google Ads" /></div>
          <div><label className="label">Payment Method</label>
            <select value={form.payment_method} onChange={e => setForm({...form, payment_method: e.target.value})} className="input">
              <option value="card">Credit/Debit Card</option><option value="wire">Wire Transfer</option>
              <option value="check">Check</option><option value="cash">Cash</option><option value="other">Other</option>
            </select></div>
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Expense'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IncomeModal({ onClose, onSaved }: any) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    amount: '', source: '', category: 'settlement_fee', received_date: new Date().toISOString().split('T')[0], notes: '',
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSaved();
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-condensed text-2xl font-black uppercase">Record Income</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-brand-red" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Amount *</label>
              <input required type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="input" /></div>
            <div><label className="label">Date *</label>
              <input required type="date" value={form.received_date} onChange={e => setForm({...form, received_date: e.target.value})} className="input" /></div>
          </div>
          <div><label className="label">Source *</label>
            <input required type="text" value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="input" placeholder="Client name or revenue source" /></div>
          <div><label className="label">Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input">
              <option value="settlement_fee">Settlement Fee</option>
              <option value="consultation">Consultation</option>
              <option value="retainer">Retainer</option>
              <option value="other">Other</option>
            </select></div>
          <div><label className="label">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="input" /></div>
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
