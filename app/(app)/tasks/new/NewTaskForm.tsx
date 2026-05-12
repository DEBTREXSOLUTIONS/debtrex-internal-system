"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewTaskForm({ users, currentUser }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    assigned_to: currentUser.id,
    priority: 'medium',
    estimated_days: 7,
    deadline: '',
  });

  function calcDeadline(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const deadline = form.deadline || calcDeadline(form.estimated_days);

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          deadline: new Date(deadline + 'T23:59:59').toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      router.push(`/tasks/${data.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/tasks" className="btn-ghost mb-6">
        <ArrowLeft size={14} /> Back to Tasks
      </Link>

      <div className="card p-8">
        <h2 className="font-condensed text-2xl font-black uppercase mb-6">New Task</h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-brand-red-pale border border-brand-red/20 rounded-md text-brand-red text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">Task Title *</label>
            <input
              required
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Set up the workflow for new client onboarding"
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what needs to be done..."
              rows={4}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Assigned To *</label>
              <select
                required
                value={form.assigned_to}
                onChange={e => setForm({ ...form, assigned_to: e.target.value })}
                className="input"
              >
                {users.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                className="input"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Timeline (Days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={form.estimated_days}
                onChange={e => setForm({
                  ...form,
                  estimated_days: parseInt(e.target.value) || 1,
                  deadline: ''
                })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Auto-calculates deadline as {calcDeadline(form.estimated_days)}
              </p>
            </div>

            <div>
              <label className="label">Or Set Deadline</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Task →'}
            </button>
            <Link href="/tasks" className="btn-outline">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
