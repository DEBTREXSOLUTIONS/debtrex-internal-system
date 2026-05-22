"use client";
import { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus, X, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CalendarView({ events, users, currentUser }: any) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    start_time: '',
    end_time: '',
    all_day: false,
    category: 'meeting',
    visibility: 'team',
    attendees: [] as string[],
  });

  function handleDateClick(info: any) {
    const start = new Date(info.date);
    const end = new Date(info.date);
    end.setHours(end.getHours() + 1);
    setForm({
      ...form,
      start_time: start.toISOString().slice(0, 16),
      end_time: end.toISOString().slice(0, 16),
    });
    setShowModal(true);
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowModal(false);
      setForm({ ...form, title: '', description: '', location: '' });
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="card p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-condensed text-xl sm:text-2xl font-black uppercase">Team Calendar</h2>
          <p className="text-sm text-gray-500">Click any date to add an event</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary self-start sm:self-auto">
          <Plus size={14} /> New Event
        </button>
      </div>

      <div className="card p-3 sm:p-6 overflow-x-auto">
        <style>{`
          .fc { font-family: 'Barlow', sans-serif; min-width: 320px; }
          .fc .fc-toolbar.fc-header-toolbar { flex-wrap: wrap; gap: 8px; }
          .fc-button-primary { background-color: #E02020 !important; border-color: #E02020 !important; font-weight: 600 !important; text-transform: uppercase !important; font-size: 11px !important; letter-spacing: 0.05em !important; padding: 6px 10px !important; }
          .fc-button-primary:hover { background-color: #B81414 !important; border-color: #B81414 !important; }
          .fc-button-active { background-color: #B81414 !important; }
          .fc-toolbar-title { font-family: 'Barlow Condensed', sans-serif; font-weight: 900 !important; text-transform: uppercase; font-size: 1.25rem !important; }
          @media (min-width: 640px) { .fc-toolbar-title { font-size: 1.5rem !important; } }
          .fc-event { cursor: pointer; border: none !important; padding: 2px 4px; font-size: 11px !important; font-weight: 600; }
          .fc-day-today { background-color: #FFF0F0 !important; }
          .fc-col-header-cell { background: #f8f8f8; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; }
        `}</style>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          dateClick={handleDateClick}
          eventClick={info => {
            info.jsEvent.preventDefault();
            if (info.event.url) router.push(info.event.url);
          }}
          height="auto"
        />
      </div>

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-condensed text-2xl font-black uppercase">New Event</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-brand-blue">
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-3 p-2 bg-brand-blue-pale border border-brand-blue/20 rounded text-brand-blue text-sm flex items-center gap-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <form onSubmit={createEvent} className="space-y-3">
              <div>
                <label className="label">Title *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">End *</label>
                  <input
                    required
                    type="datetime-local"
                    value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                    className="input"
                  >
                    <option value="meeting">Meeting</option>
                    <option value="training">Training</option>
                    <option value="deadline">Deadline</option>
                    <option value="holiday">Holiday</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Visibility</label>
                  <select
                    value={form.visibility}
                    onChange={e => setForm({ ...form, visibility: e.target.value })}
                    className="input"
                  >
                    <option value="team">Team</option>
                    <option value="company">Company</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Room or video link"
                  className="input"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button type="submit" disabled={creating} className="btn-primary flex-1 disabled:opacity-50">
                  {creating ? 'Creating...' : 'Create Event'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
