import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTaskAssignedEmail } from '@/lib/email';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, description, assigned_to, priority, deadline, estimated_days } = body;

    if (!title || !assigned_to) {
      return NextResponse.json({ error: 'Title and assignee required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tasks')
      .insert({
        title,
        description,
        created_by: user.id,
        assigned_to,
        priority: priority || 'medium',
        deadline: deadline || null,
        estimated_days: estimated_days || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Initial system update
    await supabaseAdmin.from('task_updates').insert({
      task_id: data.id,
      user_id: user.id,
      update_text: `Task created and assigned${user.id !== assigned_to ? ' to a team member' : ' to themselves'}.`,
      status_change: 'created',
    });

    // Notify assignee if not self-assigned
    if (assigned_to !== user.id) {
      const { data: assignee } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, notification_preferences')
        .eq('id', assigned_to)
        .single();

      if (assignee && assignee.notification_preferences?.task_assigned !== false) {
        await sendTaskAssignedEmail(assignee.email, assignee.full_name, data, user.full_name);
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: assigned_to,
        type: 'task_assigned',
        title: 'New task assigned',
        message: `${user.full_name} assigned you: ${title}`,
        link: `/tasks/${data.id}`,
      });
    }

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'task_created',
      resource_type: 'task',
      resource_id: data.id,
      details: { title, assigned_to },
    });

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
