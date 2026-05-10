import { NextResponse } from 'next/server';
import { clearSessionCookieOnResponse } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  return clearSessionCookieOnResponse(response);
}
