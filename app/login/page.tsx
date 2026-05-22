"use client";
import { useState } from 'react';
import { Lock, Mail, User, AlertCircle, ShieldCheck, Smartphone } from 'lucide-react';

type Stage = 'credentials' | 'verify' | 'enroll';

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>('credentials');
  const [mode, setMode] = useState<'email' | 'username'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [preAuth, setPreAuth] = useState('');
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function resetToLogin() {
    setStage('credentials');
    setCode('');
    setError('');
    setPreAuth('');
    setQr('');
    setSecret('');
    setLoading(false);
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      if (data.stage === 'done') {
        window.location.href = '/';
        return;
      }

      setPreAuth(data.preAuth);

      if (data.stage === 'verify') {
        setStage('verify');
        setLoading(false);
        return;
      }

      if (data.stage === 'enroll') {
        const setupRes = await fetch('/api/auth/2fa/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preAuth: data.preAuth }),
        });
        const setupData = await setupRes.json();
        if (!setupRes.ok) throw new Error(setupData.error || 'Could not start 2FA setup');
        setQr(setupData.qr);
        setSecret(setupData.secret);
        setStage('enroll');
        setLoading(false);
        return;
      }

      throw new Error('Unexpected response from server');
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  async function submitCode(endpoint: string) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preAuth, code }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      // Hard navigation so the new session cookie is included in the request.
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-ink via-brand-blue-dark to-brand-blue relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}/>
        <div className="relative z-10 text-white max-w-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/debtrex-icon.svg" alt="" className="w-20 h-20 mb-5 drop-shadow-lg" />
          <div className="font-condensed text-5xl font-black leading-none mb-2">
            DEBT<span className="text-brand-blue-light">REX</span>
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

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/debtrex-icon.svg" alt="" className="w-16 h-16 mb-3" />
            <div className="font-condensed text-3xl font-black text-brand-ink">
              DEBT<span className="text-brand-blue">REX</span>
            </div>
            <div className="text-xs font-bold tracking-widest text-gray-500 uppercase">Solutions</div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {stage === 'credentials' && (
            <>
              <h1 className="font-condensed text-3xl font-black uppercase mb-2">Welcome Back</h1>
              <p className="text-gray-500 mb-8">Sign in to continue to your dashboard.</p>

              <div className="flex gap-1 mb-4 p-1 bg-gray-100 rounded">
                <button
                  type="button"
                  onClick={() => { setMode('email'); setIdentifier(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded ${mode === 'email' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500'}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('username'); setIdentifier(''); }}
                  className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded ${mode === 'username' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500'}`}
                >
                  Username
                </button>
              </div>

              <form onSubmit={handleCredentials} className="space-y-4">
                <div>
                  <label className="label">{mode === 'email' ? 'Email Address' : 'Username'}</label>
                  <div className="relative">
                    {mode === 'email' ? (
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    ) : (
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    )}
                    <input
                      key={mode}
                      type={mode === 'email' ? 'email' : 'text'}
                      required
                      autoComplete={mode === 'email' ? 'email' : 'username'}
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      placeholder={mode === 'email' ? 'you@debtrex.com' : 'username'}
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
            </>
          )}

          {stage === 'verify' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="text-brand-blue" size={26} />
                <h1 className="font-condensed text-3xl font-black uppercase">Verify It's You</h1>
              </div>
              <p className="text-gray-500 mb-8">
                Enter the 6-digit code from your authenticator app.
              </p>

              <form
                onSubmit={e => { e.preventDefault(); submitCode('/api/auth/2fa/verify'); }}
                className="space-y-4"
              >
                <CodeInput value={code} onChange={setCode} />
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In →'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-500">
                Lost your device?{' '}
                <span className="font-semibold text-brand-ink">Contact an administrator to reset 2FA.</span>
              </p>
              <button
                type="button"
                onClick={resetToLogin}
                className="mt-3 w-full text-center text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue"
              >
                ← Back to sign in
              </button>
            </>
          )}

          {stage === 'enroll' && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="text-brand-blue" size={26} />
                <h1 className="font-condensed text-3xl font-black uppercase">Set Up 2FA</h1>
              </div>
              <p className="text-gray-500 mb-5">
                Two-factor authentication is required. Scan the code with an
                authenticator app (Google Authenticator, Authy, etc.).
              </p>

              <div className="flex flex-col items-center mb-4">
                {qr && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qr}
                    alt="Authenticator QR code"
                    className="w-44 h-44 border border-gray-200 rounded-lg"
                  />
                )}
              </div>

              <div className="mb-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Can't scan? Enter this key manually
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded p-2 font-mono text-xs text-center break-all select-all">
                  {secret}
                </div>
              </div>

              <form
                onSubmit={e => { e.preventDefault(); submitCode('/api/auth/2fa/enroll'); }}
                className="space-y-4"
              >
                <div>
                  <label className="label">Enter the 6-digit code to confirm</label>
                  <CodeInput value={code} onChange={setCode} />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : 'Confirm & Sign In →'}
                </button>
              </form>

              <button
                type="button"
                onClick={resetToLogin}
                className="mt-4 w-full text-center text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-brand-blue"
              >
                ← Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      maxLength={6}
      value={value}
      onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      placeholder="000000"
      className="input text-center font-mono text-2xl tracking-[0.5em]"
    />
  );
}
