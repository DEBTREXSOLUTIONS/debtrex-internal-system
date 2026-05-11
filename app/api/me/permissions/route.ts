import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPermissions } from '@/lib/permissions';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const permissions = await getPermissions(user.role);
  return NextResponse.json({ permissions, role: user.role });
}
