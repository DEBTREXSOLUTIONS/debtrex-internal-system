"use client";
import { useState } from 'react';
import { Calculator, PieChart, Save, Trash2, AlertCircle, CheckCircle, FileText, History } from 'lucide-react';
import DTICalculator from './DTICalculator';
import BudgetCalculator from './BudgetCalculator';
import { useRouter } from 'next/navigation';

export default function CalculatorsView({ recentCalcs }: any) {
  const router = useRouter();
  const [tab, setTab] = useState<'dti' | 'budget' | 'history'>('dti');

  const fmt = (n: any) => n != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '—';

  async function deleteCalc(id: string) {
    if (!confirm('Delete this saved calculation?')) return;
    await fetch(`/api/calculations/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-brand-red-pale rounded-md flex-shrink-0">
            <Calculator size={20} className="text-brand-red" />
          </div>
          <div>
            <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Client Calculators</h2>
            <p className="text-sm text-gray-500 mt-1">
              Calculate Debt-to-Income ratio and a full budget for any prospective client. Save results to track who's qualified for the relief program.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabButton active={tab === 'dti'} onClick={() => setTab('dti')} icon={PieChart}>DTI Ratio</TabButton>
        <TabButton active={tab === 'budget'} onClick={() => setTab('budget')} icon={Calculator}>Budget Calculator</TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={History}>
          History {recentCalcs.length > 0 && `(${recentCalcs.length})`}
        </TabButton>
      </div>

      {tab === 'dti' && <DTICalculator onSaved={() => router.refresh()} />}
      {tab === 'budget' && <BudgetCalculator onSaved={() => router.refresh()} />}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          {recentCalcs.length === 0 ? (
            <div className="p-8 sm:p-12 text-center">
              <FileText size={32} className="mx-auto text-gray-300 mb-3" />
              <h3 className="font-condensed text-xl font-black uppercase mb-2">No Saved Calculations Yet</h3>
              <p className="text-sm text-gray-500">Use the DTI or Budget calculator and click Save to record a client's numbers here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <Th>Client</Th><Th>Type</Th><Th>DTI</Th><Th>Disposable</Th>
                    <Th>Total Debt</Th><Th>Status</Th><Th>Date</Th><Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {recentCalcs.map((c: any) => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{c.client_name}</div>
                        {c.client_email && <div className="text-xs text-gray-500">{c.client_email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge badge-gray uppercase">{c.calculation_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        {c.dti_ratio != null ? (
                          <span className={`font-bold ${
                            c.dti_ratio < 36 ? 'text-green-700' :
                            c.dti_ratio < 43 ? 'text-yellow-700' :
                            'text-brand-red'
                          }`}>{Number(c.dti_ratio).toFixed(1)}%</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold">{fmt(c.monthly_disposable_income)}</td>
                      <td className="px-4 py-3">{fmt(c.total_debt)}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${
                          c.enrollment_status === 'enrolled' ? 'badge-green' :
                          c.enrollment_status === 'qualified' ? 'badge-blue' :
                          c.enrollment_status === 'declined' ? 'badge-red' :
                          'badge-gray'
                        }`}>
                          {c.enrollment_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteCalc(c.id)}
                          className="p-1.5 hover:bg-red-50 text-brand-red rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
        active ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-brand-ink'
      }`}
    >
      <Icon size={14} /> {children}
    </button>
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}
