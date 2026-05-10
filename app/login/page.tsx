"use client";
import { useState } from 'react';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      // Hard navigation forces a full page load that includes the new
      // session cookie in the request — avoids any cookie-not-yet-set races.
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-red relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}/>
        <div className="relative z-10 text-white max-w-md">
          <div className="font-condensed text-5xl font-black leading-none mb-2">
            DEBT<span className="opacity-60">REX</span>
          </div>
          <div className="text-xs font-bold tracking-[0.3em] uppercase opacity-70 mb-12">
            Internal Operations Platform
          </div>
          <h2 className="font-condensed text-4xl font-black uppercase leading-tight mb-4">
            One System.<br/>Total Control.
          </h2>
          <p className="text-white/80 leading-relaxed">
            Tasks, calendar, team files, budget tracking, and email alerts — all in one place. Built for the DEBTREX team.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 text-sm">
            <div className="border-t-2 border-white/30 pt-3">
              <div className="font-condensed text-2xl font-black">7</div>
              <div className="text-xs opacity-70 uppercase tracking-wider">Modules</div>
            </div>
            <div className="border-t-2 border-white/30 pt-3">
              <div className="font-condensed text-2xl font-black">Real-time</div>
              <div className="text-xs opacity-70 uppercase tracking-wider">Updates</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 text-center">
            <div className="font-condensed text-3xl font-black text-brand-ink">
              DEBT<span className="text-brand-red">REX</span>
            </div>
            <div className="text-xs font-bold tracking-widest text-gray-500 uppercase">Solutions</div>
          </div>

          <h1 className="font-condensed text-3xl font-black uppercase mb-2">Welcome Back</h1>
          <p className="text-gray-500 mb-8">Sign in to continue to your dashboard.</p>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-brand-red-pale border border-brand-red/20 rounded-md text-brand-red text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@debtrex.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Need access? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
