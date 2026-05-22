"use client";
import { useState, useMemo } from 'react';
import { Save, AlertCircle, CheckCircle, TrendingUp, TrendingDown } from 'lucide-react';

export default function DTICalculator({ onSaved }: any) {
  const [income, setIncome] = useState('');
  const [debts, setDebts] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const incomeNum = parseFloat(income) || 0;
  const debtsNum = parseFloat(debts) || 0;
  const dti = useMemo(() => incomeNum > 0 ? (debtsNum / incomeNum) * 100 : 0, [incomeNum, debtsNum]);

  const category = useMemo(() => {
    if (dti === 0) return null;
    if (dti < 20) return { label: 'Excellent', color: 'green', advice: 'Strong financial position. Likely doesn\'t need debt relief.', code: 'excellent' };
    if (dti < 36) return { label: 'Good', color: 'green', advice: 'Manageable debt. Standard lender threshold met.', code: 'good' };
    if (dti < 43) return { label: 'Concerning', color: 'yellow', advice: 'Approaching the limit. Consider proactive debt management.', code: 'concerning' };
    if (dti < 50) return { label: 'High Risk', color: 'red', advice: 'Strong candidate for debt consolidation or settlement.', code: 'high' };
    return { label: 'Critical', color: 'red', advice: 'Immediate intervention recommended. Likely qualifies for hardship programs.', code: 'critical' };
  }, [dti]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  async function save() {
    if (!clientName.trim()) {
      setError('Client name is required to save');
      return;
    }
    if (incomeNum <= 0) {
      setError('Enter a monthly income greater than zero');
      return;
    }
    setSaving(true);
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculation_type: 'dti',
          client_name: clientName,
          client_email: clientEmail || null,
          client_phone: clientPhone || null,
          monthly_gross_income: incomeNum,
          monthly_debt_payments: debtsNum,
          dti_ratio: Math.round(dti * 10) / 10,
          dti_category: category?.code,
          notes: notes || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setSuccess(`Saved DTI calculation for ${clientName}`);
      onSaved?.();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  function reset() {
    setIncome(''); setDebts(''); setClientName(''); setClientEmail(''); setClientPhone(''); setNotes('');
    setSuccess(''); setError('');
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Inputs */}
      <div className="lg:col-span-2 card p-4 sm:p-6">
        <h3 className="font-condensed text-xl font-black uppercase mb-1">Debt-to-Income Calculator</h3>
        <p className="text-sm text-gray-500 mb-5">
          DTI = (Total Monthly Debt Payments ÷ Gross Monthly Income) × 100
        </p>

        {error && (
          <div className="mb-3 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="mb-3 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Gross Monthly Income *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  placeholder="5000"
                  className="input pl-7"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Before taxes</p>
            </div>
            <div>
              <label className="label">Total Monthly Debt Payments *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={debts}
                  onChange={e => setDebts(e.target.value)}
                  placeholder="2200"
                  className="input pl-7"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Mortgage, cards, loans, etc.</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="font-bold text-sm uppercase tracking-wider mb-3 text-gray-700">Save This Calculation</h4>
            <div className="space-y-3">
              <div>
                <label className="label">Client Name *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="John Smith"
                  className="input"
                />
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
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" placeholder="Any context for follow-up..." />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={save} disabled={saving || incomeNum <= 0 || !clientName.trim()} className="btn-primary flex-1 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Calculation'}
            </button>
            <button onClick={reset} className="btn-outline">Reset</button>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-4">
        <div className={`p-5 rounded-lg ${
          category?.color === 'green' ? 'bg-green-600 text-white' :
          category?.color === 'yellow' ? 'bg-yellow-500 text-white' :
          category?.color === 'red' ? 'bg-brand-blue text-white' :
          'bg-gray-100 text-gray-500'
        }`}>
          <div className={`text-xs uppercase tracking-widest font-semibold mb-2 ${category ? 'opacity-80' : ''}`}>
            DTI Ratio
          </div>
          <div className="font-condensed text-5xl font-black leading-none">
            {dti.toFixed(1)}<span className="text-3xl">%</span>
          </div>
          {category && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="font-bold text-sm uppercase tracking-wider mb-1">{category.label}</div>
              <div className="text-xs leading-relaxed opacity-90">{category.advice}</div>
            </div>
          )}
        </div>

        {/* Reference card */}
        <div className="card p-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-3">DTI Reference</h4>
          <div className="space-y-2 text-xs">
            <RefRow color="green" range="< 20%" label="Excellent" />
            <RefRow color="green" range="20–35%" label="Good" />
            <RefRow color="yellow" range="36–42%" label="Concerning" />
            <RefRow color="red" range="43–49%" label="High Risk" />
            <RefRow color="red" range="50%+" label="Critical" />
          </div>
        </div>
      </div>
    </div>
  );
}

function RefRow({ color, range, label }: any) {
  const dotColor = color === 'green' ? 'bg-green-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-brand-blue';
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className="font-bold text-gray-700 w-16">{range}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}
