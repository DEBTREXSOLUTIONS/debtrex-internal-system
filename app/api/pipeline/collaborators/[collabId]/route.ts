import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ collabId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await hasPermission(user.role, 'pipeline.assign_to_anyone')))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { collabId } = await params;
  const { error } = await supabaseAdmin
    .from('pipeline_collaborators')
    .delete()
    .eq('id', collabId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
