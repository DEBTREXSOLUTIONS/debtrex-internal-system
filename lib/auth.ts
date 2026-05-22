// SERVER-ONLY auth utilities.
// This file imports next/headers and Node-only libraries — never import it
// from a client component. Client components should import from lib/roles.ts.

import 'server-only';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { cache } from 'react';
import { supabaseAdmin } from './supabase';

// Re-export shared role helpers/constants so existing server imports keep working
export {
  ROLES,
  canManageUsers,
  canEditBudget,
  canApproveExpenses,
  canViewAllTasks,
  canCreateEvents,
  canDeleteUsers,
  isLeadership,
} from './roles';
export type { RoleValue } from './roles';

const JWT_SECRET = process.env.JWT_SECRET!;
export const COOKIE_NAME = 'debtrex_session';

// Name of the "this device passed 2FA recently" cookie. Its presence (when
// valid) lets a device skip the authenticator code for 24h — see DEVICE_TRUST_TTL.
export const DEVICE_COOKIE_NAME = 'debtrex_2fa';

// Session lifetime. Kept short so an idle user is logged out server-side:
// the client refreshes the cookie on activity (see /api/auth/refresh and
// SessionGuard), so an active user is never interrupted.
export const SESSION_TTL_SECONDS = 60 * 60; // 60 minutes

// How long a device stays "trusted" before the authenticator code is required
// again — i.e. the user uses their authenticator roughly once per day.
const DEVICE_TRUST_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'ceo' | 'owner' | 'co-owner' | 'manager' | 'employee' | 'accountant' | 'viewer';
  google_drive_folder_id?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: SESSION_TTL_SECONDS }
  );
}

// ─── Pre-auth token ───
// Issued after a correct password but before the 2FA step. It proves "the
// password was verified for this user" so the 2FA endpoints can trust the
// caller without re-checking the password. Short-lived — the user must finish
// 2FA within this window.
export function createPreAuthToken(userId: string): string {
  return jwt.sign({ sub: userId, scope: 'pre-2fa' }, JWT_SECRET, { expiresIn: '10m' });
}

export function verifyPreAuthToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; scope?: string };
    if (decoded.scope !== 'pre-2fa' || !decoded.sub) return null;
    return decoded.sub;
  } catch {
    return null;
  }
}

// ─── Device-trust token ───
// Set as a cookie after a successful authenticator code. While valid, this
// device skips the 2FA code at login (the "once per 24h" rule).
export function createDeviceTrustToken(userId: string): string {
  return jwt.sign({ sub: userId, scope: '2fa-device' }, JWT_SECRET, {
    expiresIn: DEVICE_TRUST_TTL_SECONDS,
  });
}

export function attachDeviceTrustCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: DEVICE_TRUST_TTL_SECONDS,
    path: '/',
  });
  return response;
}

// True if the current request's device-trust cookie is valid AND belongs to
// this user — meaning this device passed 2FA within the last 24h.
export async function isDeviceTrusted(userId: string): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
    if (!token) return false;
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; scope?: string };
    return decoded.scope === '2fa-device' && decoded.sub === userId;
  } catch {
    return false;
  }
}

export function verifySessionToken(token: string): User | null {
  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch {
    return null;
  }
}

export function attachSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  });
  return response;
}

export function clearSessionCookieOnResponse(response: NextResponse): NextResponse {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

// Completes a login once all auth factors have passed: records last_login +
// audit, issues the 60-minute session cookie, and — when the user just cleared
// 2FA — the 24h device-trust cookie. Returns a `{ stage: 'done', user }` JSON
// response the client redirects on.
export async function buildLoggedInResponse(
  user: { id: string; email: string; full_name: string; role: string; google_drive_folder_id?: string },
  opts: { trustDevice: boolean; method: string },
): Promise<NextResponse> {
  await supabaseAdmin
    .from('profiles')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  await supabaseAdmin.from('audit_log').insert({
    user_id: user.id,
    action: 'login',
    details: { email: user.email, method: opts.method },
  });

  let response: NextResponse = NextResponse.json({
    stage: 'done',
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
  response = attachSessionCookie(response, createSessionToken(user as User));
  if (opts.trustDevice) {
    response = attachDeviceTrustCookie(response, createDeviceTrustToken(user.id));
  }
  return response;
}

// Wrapped in React cache() so multiple calls within the same request
// share the result. Speeds up page renders significantly.
export const getCurrentUser = cache(async function getCurrentUserUncached(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const decoded = verifySessionToken(token);
    if (!decoded) return null;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, google_drive_folder_id, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !data || !data.is_active) return null;
    return data as User;
  } catch {
    return null;
  }
});
