import { NextResponse } from 'next/server';
import { getCurrentUser, isLeadership } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTaskAssignedEmail } from '@/lib/email';

/**
 * PATCH /api/task-requests/[id]
 *
 * Body:
 *   action: 'approve' | 'deny' | 'cancel'
 *   denial_reason?: string   (required if action === 'deny')
 *
 * Rules:
 *   - approve / deny → requires task.approve_requests AND scope:
 *       • leadership can approve any request
 *       • manager can only approve requests from their assigned agents (or
 *         themselves, or requests explicitly targeted at them)
 *   - cancel → only the requester themselves (while still pending)
 *
 * Approving creates the actual task row, links it back to the request,
 * and sends the standard assignment notification + email.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = body?.action;
  if (!['approve', 'deny', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve|deny|cancel' }, { status: 400 });
  }

  // Fetch the request
  const { data: req, error: fetchErr } = await supabaseAdmin
    .from('task_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!req)     return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.status !== 'pending') {
    return NextResponse.json({ error: 'Request is not pending' }, { status: 400 });
  }

  // ─── Cancel path: only the requester ───
  if (action === 'cancel') {
    if (req.requested_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from('task_requests')
      .update({ status: 'cancelled', resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }

  // ─── Approve / Deny path: needs permission + scope ───
  if (!(await hasPermission(user.role, 'task.approve_requests'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Manager scope check
  if (!isLeadership(user.role)) {
    // Manager can act if:
    //   (a) the request is targeted at them, OR
    //   (b) the requester is one of their assigned agents, OR
    //   (c) the requester is themselves
    let allowed = req.target_approver === user.id || req.requested_by === user.id;
    if (!allowed) {
      const { data: assign } = await supabaseAdmin
        .from('manager_assignments')
        .select('agent_id')
        .eq('manager_id', user.id)
        .eq('agent_id', req.requested_by)
        .maybeSingle();
      allowed = !!assign;
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Out of your scope' }, { status: 403 });
    }
  }

  if (action === 'deny') {
    const reason = (body.denial_reason || '').toString().trim();
    if (!reason) {
      return NextResponse.json({ error: 'denial_reason is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('task_requests')
      .update({
        status: 'denied',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        denial_reason: reason,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify requester
    await supabaseAdmin.from('notifications').insert({
      user_id: req.requested_by,
      type: 'task_request_denied',
      title: 'Task request denied',
      message: `${user.full_name} denied: ${req.title}`,
      link: `/tasks/requests?status=denied`,
    });

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'task_request_denied',
      resource_type: 'task_request',
      resource_id: id,
      details: { reason },
    });

    return NextResponse.json({ ok: true, status: 'denied' });
  }

  // ─── action === 'approve' ───
  // 1) Create the actual task
  const { data: task, error: taskErr } = await supabaseAdmin
    .from('tasks')
    .insert({
      title: req.title,
      description: req.description,
      created_by: user.id,             // the approver becomes creator-of-record
      assigned_to: req.assigned_to,
      priority: req.priority || 'medium',
      deadline: req.deadline || null,
      estimated_days: req.estimated_days || null,
    })
    .select()
    .single();

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  // 2) Mark the request approved + link the task
  const { error: updErr } = await supabaseAdmin
    .from('task_requests')
    .update({
      status: 'approved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      created_task_id: task.id,
    })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // 3) Initial system update on the task
  await supabaseAdmin.from('task_updates').insert({
    task_id: task.id,
    user_id: user.id,
    update_text: `Task created from request by ${req.requested_by === req.assigned_to ? 'self' : 'a team member'}.`,
    status_change: 'created',
  });

  // 4) Notify the assignee (standard assignment notification)
  if (req.assigned_to !== user.id) {
    const { data: assignee } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, notification_preferences')
      .eq('id', req.assigned_to)
      .single();
    if (assignee && assignee.notification_preferences?.task_assigned !== false) {
      await sendTaskAssignedEmail(assignee.email, assignee.full_name, task, user.full_name);
    }
    await supabaseAdmin.from('notifications').insert({
      user_id: req.assigned_to,
      type: 'task_assigned',
      title: 'New task assigned',
      message: `${user.full_name} assigned you: ${task.title}`,
      link: `/tasks/${task.id}`,
    });
  }

  // 5) Notify the requester (so they see it was approved)
  if (req.requested_by !== user.id) {
    await supabaseAdmin.from('notifications').insert({
      user_id: req.requested_by,
      type: 'task_request_approved',
      title: 'Task request approved',
      message: `${user.full_name} approved: ${task.title}`,
      link: `/tasks/${task.id}`,
    });
  }

  // 6) Audit
  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'task_request_approved',
    resource_type: 'task_request',
    resource_id: id,
    details: { task_id: task.id, title: task.title },
  });

  return NextResponse.json({ ok: true, status: 'approved', task_id: task.id });
}
