"use client";
import { Bell, Search } from 'lucide-react';
import Link from 'next/link';

interface User {
  id: string;
  full_name: string;
  role: string;
}

export default function TopBar({ user, title }: { user: User; title?: string }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
      {/* Left side - extra left padding on mobile to clear the hamburger */}
      <div className="pl-12 lg:pl-0 min-w-0 flex-1">
        <h1 className="font-condensed text-xl sm:text-2xl font-black uppercase truncate">{title || 'Dashboard'}</h1>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          Welcome back, <span className="font-semibold text-brand-ink">{user.full_name.split(' ')[0]}</span>
        </p>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Search - hidden on mobile and tablet */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-brand-red w-56"
          />
        </div>
        <Link
          href="/notifications"
          className="relative p-2 text-gray-600 hover:text-brand-red transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </Link>
      </div>
    </header>
  );
}
