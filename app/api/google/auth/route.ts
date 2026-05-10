import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAuthUrl } from '@/lib/google-drive';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL!));

  const url = getAuthUrl(user.id);
  return NextResponse.redirect(url);
}
