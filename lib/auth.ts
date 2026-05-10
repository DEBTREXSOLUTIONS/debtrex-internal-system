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
    { expiresIn: '8h' }
  );
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
    maxAge: 8 * 60 * 60,
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
