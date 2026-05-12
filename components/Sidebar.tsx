"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, CheckSquare, Calendar, FolderOpen, DollarSign,
  Users, Settings, LogOut, Menu, X, Trophy, Calculator, UserCheck,
  Building2, Phone, Shield, ChevronDown, ChevronRight
} from 'lucide-react';
import { useState, useEffect, memo } from 'react';
import InboundCallListener from './InboundCallListener';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface SidebarPermissions {
  [key: string]: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  show: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function Sidebar({ user, permissions: initialPermissions }: { user: User; permissions?: SidebarPermissions }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Initialize collapsed state from localStorage
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Initialize permissions from sessionStorage cache to avoid flicker on navigation
  const [permissions, setPermissions] = useState<SidebarPermissions>(() => {
    if (initialPermissions && Object.keys(initialPermissions).length > 0) return initialPermissions;
    if (typeof window === 'undefined') return {};
    try {
      const cached = sessionStorage.getItem(`perms_${user.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.savedAt < 300_000) { // 5-minute cache
          return parsed.permissions;
        }
      }
    } catch {}
    return {};
  });
  const [permsLoaded, setPermsLoaded] = useState(() => {
    if (initialPermissions && Object.keys(initialPermissions).length > 0) return true;
    if (typeof window === 'undefined') return false;
    try {
      const cached = sessionStorage.getItem(`perms_${user.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        return Date.now() - parsed.savedAt < 300_000;
      }
    } catch {}
    return false;
  });

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Save collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('sidebar_collapsed', JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  // Fetch permissions only if not already cached
  useEffect(() => {
    if (permsLoaded) return; // Already have them
    let active = true;
    fetch('/api/me/permissions')
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        if (data.permissions) {
          setPermissions(data.permissions);
          setPermsLoaded(true);
          try {
            sessionStorage.setItem(`perms_${user.id}`, JSON.stringify({
              permissions: data.permissions,
              savedAt: Date.now(),
            }));
          } catch {}
        }
      })
      .catch(() => { if (active) setPermsLoaded(true); });
    return () => { active = false; };
  }, [permsLoaded, user.id]);

  const can = (key: string, fallback: boolean) =>
    permsLoaded ? !!permissions[key] : fallback;

  const isLeadership = ['ceo', 'owner', 'co-owner'].includes(user.role);
  const isManager = user.role === 'manager';
  const canEditBudget = ['ceo', 'owner', 'co-owner', 'accountant'].includes(user.role);

  // ─── Grouped Navigation ───
  const groups: NavGroup[] = [
    {
      label: 'Home',
      items: [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard, show: can('section.dashboard', true) },
        { href: '/tasks', label: 'Tasks', icon: CheckSquare, show: can('section.tasks', true) },
        { href: '/calendar', label: 'Calendar', icon: Calendar, show: can('section.calendar', true) },
        { href: '/files', label: 'Files', icon: FolderOpen, show: can('section.files', true) },
      ],
    },
    {
      label: 'Pipeline',
      items: [
        { href: '/pipeline/sales', label: 'Sales', icon: Phone, show: can('section.pipeline_sales', user.role !== 'viewer' && user.role !== 'accountant') },
        { href: '/pipeline/management', label: 'Management', icon: Building2, show: can('section.pipeline_management', isLeadership) },
      ],
    },
    {
      label: 'Tools',
      items: [
        { href: '/calculators', label: 'Calculators', icon: Calculator, show: can('section.calculators', user.role !== 'viewer') },
      ],
    },
    {
      label: 'Team',
      items: [
        { href: '/performance', label: 'Performance', icon: Trophy, show: can('section.performance', isLeadership || isManager) },
        { href: '/performance/assignments', label: 'Manager Assignments', icon: UserCheck, show: can('performance.assign_managers', isLeadership) },
        { href: '/team', label: 'Team Members', icon: Users, show: can('section.team', isLeadership) },
        { href: '/twilio-numbers', label: 'Twilio Numbers', icon: Phone, show: can('section.twilio_numbers', isLeadership) },
      ],
    },
    {
      label: 'Financial',
      items: [
        { href: '/budget', label: 'Budget', icon: DollarSign, show: can('section.budget', canEditBudget) },
      ],
    },
    {
      label: 'Admin',
      items: [
        { href: '/permissions', label: 'Permissions', icon: Shield, show: can('permissions.manage', isLeadership) },
        { href: '/roles', label: 'Custom Roles', icon: UserCheck, show: can('roles.manage', isLeadership) },
      ],
    },
  ];

  // Filter out groups with no visible items
  const visibleGroups = groups
    .map(g => ({ ...g, items: g.items.filter(i => i.show) }))
    .filter(g => g.items.length > 0);

  function toggleGroup(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <Link href="/" prefetch={false} className="block">
          <div className="font-condensed text-2xl font-black text-white tracking-tight leading-none">
            DEBT<span className="text-brand-red">REX</span>
          </div>
          <div className="text-[9px] font-bold tracking-[0.25em] uppercase text-white/40 mt-1">
            Internal System
          </div>
        </Link>
        <button type="button" onClick={() => setMobileOpen(false)} className="lg:hidden text-white/60 hover:text-white p-1">
          <X size={22} />
        </button>
      </div>

      {/* Grouped nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleGroups.map(group => {
          const isCollapsed = !!collapsed[group.label];
          return (
            <div key={group.label} className="mb-1">
              <button type="button"
                onClick={() => toggleGroup(group.label)}
                className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-white/40 hover:text-white/70 transition-colors"
              >
                {group.label}
                {isCollapsed
                  ? <ChevronRight size={12} className="opacity-60" />
                  : <ChevronDown size={12} className="opacity-60" />}
              </button>
              {!isCollapsed && (
                <div className="px-2 space-y-0.5">
                  {group.items.map(item => {
                    // Exact match OR starts-with — but only if no MORE specific sibling matches.
                    // e.g. /performance shouldn't be "active" when on /performance/assignments
                    const moreSpecificMatch = group.items.some(other =>
                      other.href !== item.href &&
                      other.href.startsWith(item.href + '/') &&
                      (pathname === other.href || pathname.startsWith(other.href + '/'))
                    );
                    const active = !moreSpecificMatch && (
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href + '/'))
                    );
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          active
                            ? 'bg-brand-red text-white shadow-red'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Icon size={16} className="flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 flex-shrink-0">
        <Link
          href="/settings"
          prefetch={false}
          className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Settings size={15} /> Settings
        </Link>
      </div>

      <div className="p-3 border-t border-white/10 bg-black/20 flex-shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-brand-red text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
            <div className="text-[10px] uppercase tracking-wider text-brand-red font-bold">{user.role}</div>
          </div>
        </div>
        <button type="button"
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
      <button type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2 bg-brand-ink text-white rounded-md shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="lg:hidden fixed inset-0 bg-black/60 z-40 fade-in" />
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

      {/* Global inbound call listener — receives Twilio Voice calls anywhere in the app */}
      <InboundCallListener user={user} />
    </>
  );
}

export default memo(Sidebar);
