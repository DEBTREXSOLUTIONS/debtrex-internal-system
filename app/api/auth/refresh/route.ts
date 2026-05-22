import { NextResponse } from 'next/server';
import { getCurrentUser, createSessionToken, attachSessionCookie } from '@/lib/auth';

// Slides the 60-minute session window forward. SessionGuard calls this while
// the user is active so an active user is never logged out mid-work; an idle
// user gets no refresh and the session simply expires.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  return attachSessionCookie(response, createSessionToken(user));
}
