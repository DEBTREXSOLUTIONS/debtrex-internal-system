"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Lock, Bell, Cloud, AlertCircle, CheckCircle } from 'lucide-react';

export default function SettingsForm({ profile }: any) {
  const router = useRouter();
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications' | 'integrations'>('profile');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [profileForm, setProfileForm] = useState({
    full_name: profile.full_name || '',
    phone: profile.phone || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '', new: '', confirm: '',
  });
  const [notif, setNotif] = useState(profile.notification_preferences || {});

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(''); setError('');
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setSuccess('Profile updated successfully');
      router.refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(''); setError('');
    if (passwordForm.new !== passwordForm.confirm) {
      setError('New passwords do not match');
      return;
    }
    if (passwordForm.new.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.current,
          new_password: passwordForm.new,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setSuccess('Password changed successfully');
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (e: any) { setError(e.message); }
  }

  async function saveNotifications() {
    setSuccess(''); setError('');
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: notif }),
      });
      setSuccess('Notification preferences saved');
    } catch (e: any) { setError(e.message); }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google Drive? Your files will remain in Drive but you\'ll need to reconnect to access them here.')) return;
    await fetch('/api/users/me/google/disconnect', { method: 'POST' });
    router.refresh();
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Save },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Cloud },
  ];

  return (
    <>
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as any); setSuccess(''); setError(''); }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-brand-ink'
              }`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Status */}
      {success && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-brand-blue-pale border border-brand-blue/20 rounded-md text-brand-blue text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="card p-6">
          <h3 className="font-condensed text-xl font-black uppercase mb-4">Profile Information</h3>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={profile.email} disabled className="input bg-gray-50 text-gray-500" />
              <p className="text-xs text-gray-500 mt-1">Contact your administrator to change your email.</p>
            </div>
            <div>
              <label className="label">Full Name *</label>
              <input
                required
                type="text"
                value={profileForm.full_name}
                onChange={e => setProfileForm({...profileForm, full_name: e.target.value})}
                className="input"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                className="input"
              />
            </div>
            <div>
              <label className="label">Role</label>
              <input type="text" value={profile.role.toUpperCase()} disabled className="input bg-gray-50 text-gray-500" />
            </div>
            <button type="submit" className="btn-primary">
              <Save size={14} /> Save Changes
            </button>
          </form>
        </div>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <div className="card p-6">
          <h3 className="font-condensed text-xl font-black uppercase mb-4">Change Password</h3>
          <form onSubmit={changePassword} className="space-y-4 max-w-md">
            <div>
              <label className="label">Current Password *</label>
              <input
                required
                type="password"
                value={passwordForm.current}
                onChange={e => setPasswordForm({...passwordForm, current: e.target.value})}
                className="input"
              />
            </div>
            <div>
              <label className="label">New Password *</label>
              <input
                required
                type="password"
                minLength={8}
                value={passwordForm.new}
                onChange={e => setPasswordForm({...passwordForm, new: e.target.value})}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
            </div>
            <div>
              <label className="label">Confirm New Password *</label>
              <input
                required
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})}
                className="input"
              />
            </div>
            <button type="submit" className="btn-primary">
              <Lock size={14} /> Change Password
            </button>
          </form>
        </div>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <div className="card p-6">
          <h3 className="font-condensed text-xl font-black uppercase mb-4">Email Notifications</h3>
          <div className="space-y-3">
            {[
              { key: 'task_assigned', label: 'New task assigned to me' },
              { key: 'task_deadline', label: 'Task deadline approaching (24hr before)' },
              { key: 'task_overdue', label: 'My task became overdue' },
              { key: 'calendar_invite', label: 'Calendar event invitations' },
              { key: 'expense_status', label: 'Expense approved or rejected' },
              { key: 'weekly_digest', label: 'Weekly digest of my work' },
            ].map(opt => (
              <label key={opt.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-md cursor-pointer hover:border-brand-blue transition-colors">
                <span className="text-sm font-medium">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={notif[opt.key] !== false}
                  onChange={e => setNotif({ ...notif, [opt.key]: e.target.checked })}
                  className="w-4 h-4 accent-brand-blue"
                />
              </label>
            ))}
          </div>
          <button onClick={saveNotifications} className="btn-primary mt-4">
            <Save size={14} /> Save Preferences
          </button>
        </div>
      )}

      {/* Integrations tab */}
      {tab === 'integrations' && (
        <div className="card p-6">
          <h3 className="font-condensed text-xl font-black uppercase mb-4">Connected Services</h3>
          <div className="border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-blue-pale rounded">
                  <Cloud size={20} className="text-brand-blue" />
                </div>
                <div>
                  <div className="font-bold">Google Drive</div>
                  <div className="text-xs text-gray-500">
                    {profile.google_refresh_token ? '✓ Connected' : 'Not connected'}
                  </div>
                </div>
              </div>
              {profile.google_refresh_token ? (
                <button onClick={disconnectGoogle} className="btn-outline text-xs">Disconnect</button>
              ) : (
                <a href="/api/google/auth" className="btn-primary text-xs">Connect</a>
              )}
            </div>
            {profile.google_drive_folder_id && (
              <div className="mt-3 text-xs text-gray-500">
                Your folder: <code className="bg-gray-100 px-1 py-0.5 rounded">{profile.google_drive_folder_id}</code>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
