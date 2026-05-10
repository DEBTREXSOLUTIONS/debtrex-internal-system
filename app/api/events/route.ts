import { NextResponse } from 'next/server';
import { getCurrentUser, canCreateEvents } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canCreateEvents(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const { title, description, location, start_time, end_time, all_day, category, visibility, attendees } = body;

    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: event, error } = await supabaseAdmin
      .from('events')
      .insert({
        title,
        description,
        location,
        start_time: new Date(start_time).toISOString(),
        end_time: new Date(end_time).toISOString(),
        all_day: all_day || false,
        category: category || 'meeting',
        visibility: visibility || 'team',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Add attendees
    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      await supabaseAdmin.from('event_attendees').insert(
        attendees.map((uid: string) => ({ event_id: event.id, user_id: uid, status: 'invited' }))
      );
    }

    return NextResponse.json(event);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
