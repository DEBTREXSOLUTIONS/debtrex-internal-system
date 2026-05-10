import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canAssignAgentsToManagers } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAssignAgentsToManagers(user.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { manager_id, agent_ids } = await request.json();
    if (!manager_id || !Array.isArray(agent_ids) || agent_ids.length === 0) {
      return NextResponse.json({ error: 'Manager and at least one agent required' }, { status: 400 });
    }

    // Filter out self-assignment
    const filteredAgents = agent_ids.filter((id: string) => id !== manager_id);

    const rows = filteredAgents.map((agentId: string) => ({
      manager_id,
      agent_id: agentId,
      assigned_by: user.id,
    }));

    // Upsert (skip duplicates due to unique constraint)
    const { data, error } = await supabaseAdmin
      .from('manager_assignments')
      .upsert(rows, { onConflict: 'manager_id,agent_id', ignoreDuplicates: true })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabaseAdmin.from('audit_log').insert({
      user_id: user.id,
      action: 'manager_assignments_created',
      resource_type: 'manager_assignment',
      details: { manager_id, agent_count: filteredAgents.length },
    });

    return NextResponse.json({ created: (data || []).length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
