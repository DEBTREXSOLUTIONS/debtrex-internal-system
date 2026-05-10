"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, Calendar, FolderOpen, DollarSign,
  Users, Settings, LogOut, Menu, X, Trophy, Calculator, UserCheck
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export default function Sidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isLeadership = ['ceo', 'owner', 'co-owner'].includes(user.role);
  const isManager = user.role === 'manager';
  const canEditBudget = ['ceo', 'owner', 'co-owner', 'accountant'].includes(user.role);
  const canUseCalculators = ['ceo', 'owner', 'co-owner', 'manager', 'employee', 'accountant'].includes(user.role);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/tasks', label: 'Tasks', icon: CheckSquare, show: true },
    { href: '/calendar', label: 'Calendar', icon: Calendar, show: true },
    { href: '/files', label: 'Files', icon: FolderOpen, show: true },
    { href: '/calculators', label: 'Calculators', icon: Calculator, show: canUseCalculators },
    { href: '/performance', label: 'Performance', icon: Trophy, show: isLeadership || isManager },
    { href: '/budget', label: 'Budget', icon: DollarSign, show: canEditBudget },
    { href: '/team', label: 'Team', icon: Users, show: isLeadership },
  ];

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const sidebarContent = (
    <>
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <Link href="/" className="block">
          <div className="font-condensed text-2xl font-black text-white tracking-tight">
            DEBT<span className="text-brand-red">REX</span>
          </div>
          <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/40">
            Internal System
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-white/60 hover:text-white p-1"
          aria-label="Close menu"
        >
          <X size={22} />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.filter(i => i.show).map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-red text-white shadow-red'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}

        {/* Sub-link for leadership: Manager Assignments under Performance */}
        {isLeadership && pathname.startsWith('/performance') && (
          <Link
            href="/performance/assignments"
            className={`flex items-center gap-3 px-3 py-2.5 ml-3 rounded-md text-xs font-medium transition-colors border-l-2 ${
              pathname === '/performance/assignments'
                ? 'border-brand-red text-white bg-white/5'
                : 'border-white/10 text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck size={13} />
            Manager Assignments
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings size={16} /> Settings
        </Link>
      </div>

      <div className="p-3 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-[10px] uppercase tracking-wider text-brand-red font-bold">{user.role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-brand-red transition-colors"
        >
          <LogOut size={13} />
          {loggingOut ? 'Logging out...' : 'Sign Out'}
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2 bg-brand-ink text-white rounded-md shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40 fade-in"
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          bg-brand-ink min-h-screen flex flex-col flex-shrink-0
          fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50
          w-72 lg:w-64
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
