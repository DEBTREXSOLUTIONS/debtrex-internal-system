"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Calendar, User, Flag, Send, MessageSquare, FileText, CheckCircle, Trash2 } from 'lucide-react';

export default function TaskWorkTracker({ task, initialUpdates, initialNotes, currentUser, canDelete = false }: any) {
  const router = useRouter();
  const [updateText, setUpdateText] = useState('');
  const [hoursWorked, setHoursWorked] = useState('');
  const [noteText, setNoteText] = useState('');
  const [posting, setPosting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const isAssignee = task.assigned_to === currentUser.id;
  const isCreator = task.created_by === currentUser.id;
  const canUpdate = isAssignee || isCreator || ['ceo', 'owner', 'co-owner', 'manager'].includes(currentUser.role);

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed';

  const statusColors: any = {
    not_started: 'badge-gray',
    in_progress: 'badge-blue',
    submitted: 'badge-yellow',
    completed: 'badge-green',
    overdue: 'badge-red',
    cancelled: 'badge-gray',
  };

  async function postUpdate() {
    if (!updateText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_text: updateText,
          hours_worked: hoursWorked ? parseFloat(hoursWorked) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to post update');
      setUpdateText('');
      setHoursWorked('');
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPosting(false);
    }
  }

  async function postNote() {
    if (!noteText.trim()) return;
    try {
      await fetch(`/api/tasks/${task.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText }),
      });
      setNoteText('');
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  }

  async function changeStatus(newStatus: string) {
    setStatusUpdating(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setStatusUpdating(false);
    }
  }

  async function deleteTask() {
    if (!confirm(`Permanently delete this task? This cannot be undone.`)) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Failed to delete task');
      return;
    }
    router.push('/tasks');
  }

  return (
    <>
      {/* Task Header */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="font-condensed text-2xl sm:text-3xl font-black uppercase mb-2 break-words">{task.title}</h1>
            {task.description && (
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{task.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className={`badge ${isOverdue ? 'badge-red' : statusColors[task.status]}`}>
              {isOverdue ? '⚠ Overdue' : task.status.replace('_', ' ')}
            </span>
            <span className={`badge badge-${task.priority === 'urgent' ? 'red' : 'gray'}`}>
              <Flag size={10} /> {task.priority}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100 text-sm">
          <Detail icon={User} label="Assigned to" value={task.assigned_to_profile?.full_name} />
          <Detail icon={User} label="Created by" value={task.created_by_profile?.full_name} />
          <Detail
            icon={Clock}
            label="Deadline"
            value={task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No deadline'}
            highlight={isOverdue}
          />
          <Detail
            icon={Calendar}
            label="Created"
            value={new Date(task.created_at).toLocaleDateString()}
          />
        </div>

        {/* Status Actions */}
        {(canUpdate || canDelete) && (
          <div className="flex gap-2 mt-5 pt-5 border-t border-gray-100">
            {canUpdate && task.status !== 'completed' && task.status === 'not_started' && (
              <button onClick={() => changeStatus('in_progress')} disabled={statusUpdating} className="btn-outline text-xs">
                Start Working
              </button>
            )}
            {canUpdate && task.status === 'in_progress' && (
              <button onClick={() => changeStatus('submitted')} disabled={statusUpdating} className="btn-outline text-xs">
                Mark as Submitted
              </button>
            )}
            {canUpdate && (task.status === 'submitted' || task.status === 'in_progress') && (isCreator || ['ceo', 'owner', 'co-owner', 'manager'].includes(currentUser.role)) && (
              <button onClick={() => changeStatus('completed')} disabled={statusUpdating} className="btn-primary text-xs">
                <CheckCircle size={12} /> Mark Complete
              </button>
            )}
            {canDelete && (
              <button onClick={deleteTask} className="btn-outline text-xs ml-auto text-gray-500 hover:text-red-700">
                <Trash2 size={12} /> Delete Task
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity & Updates */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Update */}
          {canUpdate && task.status !== 'completed' && (
            <div className="card p-6">
              <h3 className="font-condensed text-lg font-black uppercase mb-3 flex items-center gap-2">
                <Send size={14} className="text-brand-blue" /> Post Work Update
              </h3>
              <textarea
                value={updateText}
                onChange={e => setUpdateText(e.target.value)}
                placeholder="What did you work on? e.g., 'Completed the initial workflow plan and outlined the 5 main steps.'"
                rows={3}
                className="input mb-3"
              />
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={hoursWorked}
                  onChange={e => setHoursWorked(e.target.value)}
                  placeholder="Hours"
                  className="input w-24"
                />
                <button
                  onClick={postUpdate}
                  disabled={posting || !updateText.trim()}
                  className="btn-primary disabled:opacity-50"
                >
                  {posting ? 'Posting...' : 'Post Update'}
                </button>
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="card p-6">
            <h3 className="font-condensed text-lg font-black uppercase mb-4">Activity Timeline</h3>
            {initialUpdates.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No updates yet. Post the first one!</p>
            ) : (
              <div className="space-y-4">
                {initialUpdates.map((update: any) => (
                  <div key={update.id} className="flex gap-3 fade-in">
                    <div className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {update.user?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-md p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{update.user?.full_name}</span>
                            <span className="badge badge-gray text-[10px]">{update.user?.role}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(update.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{update.update_text}</p>
                        {update.hours_worked && (
                          <div className="mt-2 text-xs text-brand-blue font-semibold">
                            <Clock size={10} className="inline mr-1" />
                            {update.hours_worked} hrs
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Notes Sidebar */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-condensed text-lg font-black uppercase mb-3 flex items-center gap-2">
              <FileText size={14} className="text-brand-blue" /> Notes
            </h3>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="input mb-2 text-sm"
            />
            <button
              onClick={postNote}
              disabled={!noteText.trim()}
              className="btn-outline w-full text-xs disabled:opacity-50"
            >
              Add Note
            </button>

            {initialNotes.length > 0 && (
              <div className="mt-4 space-y-3">
                {initialNotes.map((note: any) => (
                  <div key={note.id} className="text-sm border-l-2 border-brand-blue pl-3 py-1">
                    <div className="text-gray-700">{note.note}</div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {note.user?.full_name} • {new Date(note.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Total Hours */}
          {initialUpdates.length > 0 && (
            <div className="card p-6 bg-brand-blue text-white">
              <div className="text-xs uppercase tracking-widest font-semibold opacity-80">Total Hours Logged</div>
              <div className="font-condensed text-4xl font-black mt-1">
                {initialUpdates.reduce((sum: number, u: any) => sum + (parseFloat(u.hours_worked) || 0), 0).toFixed(2)}
              </div>
              <div className="text-xs mt-2 opacity-70">{initialUpdates.length} updates posted</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ icon: Icon, label, value, highlight }: any) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className={`text-sm font-semibold ${highlight ? 'text-brand-blue' : 'text-brand-ink'}`}>
        {value || '—'}
      </div>
    </div>
  );
}
