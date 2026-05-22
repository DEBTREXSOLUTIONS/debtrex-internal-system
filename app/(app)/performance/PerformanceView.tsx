"use client";
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Trophy, Clock, CheckCircle, AlertCircle, TrendingUp, Users, Search, ArrowUpDown } from 'lucide-react';

type SortKey = 'name' | 'completed' | 'overdue' | 'hours' | 'on_time' | 'last_activity';
type SortDir = 'asc' | 'desc';

export default function PerformanceView({ metrics, isLeadership, currentUserName }: any) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('completed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return metrics.filter((m: any) =>
      m.full_name.toLowerCase().includes(lower) ||
      m.email.toLowerCase().includes(lower) ||
      m.role.toLowerCase().includes(lower)
    );
  }, [metrics, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case 'name': av = a.full_name; bv = b.full_name; break;
        case 'completed': av = a.completed_tasks; bv = b.completed_tasks; break;
        case 'overdue': av = a.overdue_tasks; bv = b.overdue_tasks; break;
        case 'hours': av = a.total_hours_logged; bv = b.total_hours_logged; break;
        case 'on_time': av = a.on_time_completion_rate; bv = b.on_time_completion_rate; break;
        case 'last_activity':
          av = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
          bv = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
          break;
      }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function changeSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // Aggregate stats for the top KPI cards
  const totals = useMemo(() => ({
    teamSize: metrics.length,
    completed: metrics.reduce((s: number, m: any) => s + m.completed_tasks, 0),
    overdue: metrics.reduce((s: number, m: any) => s + m.overdue_tasks, 0),
    inProgress: metrics.reduce((s: number, m: any) => s + m.in_progress_tasks, 0),
    hours: metrics.reduce((s: number, m: any) => s + m.total_hours_logged, 0),
    avgOnTime: metrics.length > 0
      ? Math.round(metrics.reduce((s: number, m: any) => s + m.on_time_completion_rate, 0) / metrics.length)
      : 100,
  }), [metrics]);

  if (metrics.length === 0) {
    return (
      <div className="card p-8 sm:p-12 text-center">
        <Users size={32} className="mx-auto text-gray-300 mb-3" />
        <h2 className="font-condensed text-2xl font-black uppercase mb-2">
          {isLeadership ? 'No Team Members Yet' : 'No Agents Assigned to You'}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {isLeadership
            ? 'Invite team members from the Team page to start tracking performance.'
            : 'Ask CEO or Co-Owner to assign agents to you on the Team Assignments page.'}
        </p>
        {isLeadership && (
          <Link href="/team" className="btn-primary">
            <Users size={14} /> Go to Team Page
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <KPI label={isLeadership ? "Team Size" : "Your Agents"} value={totals.teamSize.toString()} icon={Users} />
        <KPI label="Completed" value={totals.completed.toString()} icon={CheckCircle} color="green" />
        <KPI label="In Progress" value={totals.inProgress.toString()} icon={Clock} color="blue" />
        <KPI label="Overdue" value={totals.overdue.toString()} icon={AlertCircle} color={totals.overdue > 0 ? "red" : "gray"} />
        <KPI label="Total Hours" value={totals.hours.toFixed(1)} icon={Clock} />
        <KPI label="Avg On-Time" value={`${totals.avgOnTime}%`} icon={TrendingUp} color={totals.avgOnTime >= 80 ? "green" : "yellow"} />
      </div>

      {/* Search */}
      <div className="card p-3 sm:p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Performance Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader label="Team Member" sortKey="name" current={sortKey} dir={sortDir} onClick={changeSort} />
                <SortHeader label="Completed" sortKey="completed" current={sortKey} dir={sortDir} onClick={changeSort} />
                <Th>In Progress</Th>
                <SortHeader label="Overdue" sortKey="overdue" current={sortKey} dir={sortDir} onClick={changeSort} />
                <SortHeader label="Hours" sortKey="hours" current={sortKey} dir={sortDir} onClick={changeSort} />
                <SortHeader label="On-Time" sortKey="on_time" current={sortKey} dir={sortDir} onClick={changeSort} />
                <SortHeader label="Last Active" sortKey="last_activity" current={sortKey} dir={sortDir} onClick={changeSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((m: any, i: number) => {
                const initials = m.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                const onTimeColor = m.on_time_completion_rate >= 80 ? 'text-green-700' : m.on_time_completion_rate >= 60 ? 'text-yellow-700' : 'text-brand-blue';
                return (
                  <tr key={m.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {i < 3 && sortKey === 'completed' && sortDir === 'desc' && (
                          <Trophy size={16} className={
                            i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-orange-600'
                          } />
                        )}
                        <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{m.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{m.role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="font-bold text-green-700">{m.completed_tasks}</span></td>
                    <td className="px-4 py-3 text-gray-700">{m.in_progress_tasks}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${m.overdue_tasks > 0 ? 'text-brand-blue' : 'text-gray-400'}`}>
                        {m.overdue_tasks}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.total_hours_logged.toFixed(1)}h</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${onTimeColor}`}>{m.on_time_completion_rate}%</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded overflow-hidden">
                          <div
                            className={`h-full ${
                              m.on_time_completion_rate >= 80 ? 'bg-green-500' :
                              m.on_time_completion_rate >= 60 ? 'bg-yellow-500' : 'bg-brand-blue'
                            }`}
                            style={{ width: `${m.on_time_completion_rate}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {m.last_activity_at
                        ? new Date(m.last_activity_at).toLocaleDateString()
                        : 'No activity'}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No team members match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info box */}
      <div className="mt-4 card p-4 bg-gray-50 text-xs text-gray-600">
        <div className="font-bold text-brand-ink mb-1">How metrics are calculated</div>
        <ul className="list-disc list-inside space-y-1">
          <li><b>Completed</b> — tasks marked as completed</li>
          <li><b>In Progress</b> — tasks actively being worked or submitted for review</li>
          <li><b>Overdue</b> — past deadline and not completed/cancelled</li>
          <li><b>Hours</b> — total time logged on task updates</li>
          <li><b>On-Time</b> — percentage of completed tasks finished by their deadline</li>
          <li><b>Last Active</b> — most recent task update posted</li>
        </ul>
      </div>
    </>
  );
}

function KPI({ label, value, icon: Icon, color = 'gray' }: any) {
  const colors: any = {
    red: 'bg-brand-blue-pale text-brand-blue',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-gray-50 text-gray-700',
  };
  return (
    <div className="card p-3 sm:p-4">
      <div className={`inline-flex p-1.5 rounded-md ${colors[color]} mb-2`}>
        <Icon size={14} />
      </div>
      <div className="font-condensed text-xl sm:text-2xl font-black">{value}</div>
      <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider font-semibold mt-0.5">{label}</div>
    </div>
  );
}

function Th({ children }: any) {
  return <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">{children}</th>;
}

function SortHeader({ label, sortKey, current, dir, onClick }: any) {
  const active = sortKey === current;
  return (
    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-600">
      <button
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 hover:text-brand-blue transition-colors ${active ? 'text-brand-blue' : ''}`}
      >
        {label}
        <ArrowUpDown size={11} className={active ? '' : 'opacity-40'} />
        {active && <span className="text-[10px]">{dir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  );
}
