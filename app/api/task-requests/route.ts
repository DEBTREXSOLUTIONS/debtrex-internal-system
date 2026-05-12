import { NextResponse } from 'next/server';
import { getCurrentUser, isLeadership } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';

/**
 * GET /api/task-requests
 *
 * Returns task requests visible to the calling user.
 *
 * Approvers (task.approve_requests):
 *   - Leadership (ceo / owner / co-owner) see ALL pending requests.
 *   - Manager sees only requests where the requester is one of their
 *     assigned agents (manager_assignments).
 *
 * Non-approvers see only their own requests (so they can track status).
 *
 * Query params:
 *   - status: 'pending' (default) | 'approved' | 'denied' | 'all'
 *   - mine:   '1' → force "my requests only" view
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const mine   = url.searchParams.get('mine') === '1';

  const canApprove = await hasPermission(user.role, 'task.approve_requests');

  // Base select with joined names
  let q = supabaseAdmin
    .from('task_requests')
    .select(`
      id, title, description, priority, deadline, estimated_days,
      requested_by, assigned_to, target_approver,
      status, resolved_by, resolved_at, denial_reason, created_task_id,
      created_at,
      requester:profiles!task_requests_requested_by_fkey(id, full_name, email, role),
      assignee:profiles!task_requests_assigned_to_fkey(id, full_name, email, role),
      approver:profiles!task_requests_target_approver_fkey(id, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') q = q.eq('status', status);

  if (mine || !canApprove) {
    // Show only my requests
    q = q.eq('requested_by', user.id);
  } else if (!isLeadership(user.role)) {
    // Manager scope — only requests from my agents (plus my own, plus ones
    // explicitly targeted at me)
    const { data: assigns } = await supabaseAdmin
      .from('manager_assignments')
      .select('agent_id')
      .eq('manager_id', user.id);
    const agentIds = (assigns ?? []).map((a: any) => a.agent_id);
    const visibleRequesters = Array.from(new Set([user.id, ...agentIds]));

    // Either: requester is me/my-agent OR target_approver is me
    const inList = visibleRequesters.map(id => `"${id}"`).join(',');
    q = q.or(`requested_by.in.(${inList}),target_approver.eq.${user.id}`);
  }
  // else: leadership sees everything; no extra filter.

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}


/**
 * POST /api/task-requests
 *
 * Body:
 *   title           (required)
 *   description     (optional)
 *   assigned_to     (required — uuid; defaults client-side to self)
 *   priority        ('low'|'medium'|'high'|'urgent') default 'medium'
 *   estimated_days  (optional)
 *   deadline        (optional ISO)
 *   target_approver (optional uuid — specific admin to review; null = any)
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasPermission(user.role, 'task.request'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, description, assigned_to, priority, estimated_days, deadline, target_approver } = body || {};
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (!assigned_to || typeof assigned_to !== 'string') {
    return NextResponse.json({ error: 'assigned_to is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('task_requests')
    .insert({
      title,
      description: description || null,
      assigned_to,
      priority: priority || 'medium',
      estimated_days: estimated_days || null,
      deadline: deadline || null,
      target_approver: target_approver || null,
      requested_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify approvers — either the specific target, or all leadership + the
  // requester's manager (if any).
  const approverIds = new Set<string>();
  if (target_approver) {
    approverIds.add(target_approver);
  } else {
    const { data: leadership } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', ['ceo', 'owner', 'co-owner'])
      .eq('is_active', true);
    (leadership ?? []).forEach((p: any) => approverIds.add(p.id));

    const { data: managers } = await supabaseAdmin
      .from('manager_assignments')
      .select('manager_id')
      .eq('agent_id', user.id);
    (managers ?? []).forEach((m: any) => approverIds.add(m.manager_id));
  }
  approverIds.delete(user.id); // don't notify self

  // In-app notifications
  if (approverIds.size > 0) {
    await supabaseAdmin.from('notifications').insert(
      Array.from(approverIds).map(uid => ({
        user_id: uid,
        type: 'task_request',
        title: 'New task request',
        message: `${user.full_name} requested: ${title}`,
        link: `/tasks/requests`,
      }))
    );
  }

  // Audit log
  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'task_request_created',
    resource_type: 'task_request',
    resource_id: data.id,
    details: { title, assigned_to, target_approver: target_approver || null },
  });

  return NextResponse.json(data);
}
