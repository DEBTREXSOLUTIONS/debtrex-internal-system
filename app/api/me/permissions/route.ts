import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPermissions } from '@/lib/permissions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const permissions = await getPermissions(user.role);
  return NextResponse.json({
    permissions,
    role: user.role,
    user_id: user.id,
    section_visibility: {
      dashboard: permissions['section.dashboard'] === true,
      tasks: permissions['section.tasks'] === true,
      calendar: permissions['section.calendar'] === true,
      files: permissions['section.files'] === true,
      budget: permissions['section.budget'] === true,
      team: permissions['section.team'] === true,
      performance: permissions['section.performance'] === true,
      calculators: permissions['section.calculators'] === true,
      pipeline_management: permissions['section.pipeline_management'] === true,
      pipeline_sales: permissions['section.pipeline_sales'] === true,
      twilio_numbers: permissions['section.twilio_numbers'] === true,
      custom_roles: permissions['section.custom_roles'] === true,
    },
  });
}
