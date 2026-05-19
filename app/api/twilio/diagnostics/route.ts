import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { supabaseAdmin } from '@/lib/supabase';
import { listTwilioNumbers } from '@/lib/twilio';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Permit anyone with call.make to run this — they need to be able to
  // debug their own outbound issues without admin involvement.
  const canDiagnose = (await hasPermission(user.role, 'section.twilio_numbers'))
    || (await hasPermission(user.role, 'call.make'));
  if (!canDiagnose) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const number = process.env.TWILIO_PHONE_NUMBER;
  const callerIdEnv = process.env.TWILIO_CALLER_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // What number would voice-twiml resolve for the CURRENT user?
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('twilio_phone_number')
    .eq('id', user.id)
    .single();

  const assignedRaw = profile?.twilio_phone_number || null;
  const assignedClean = assignedRaw ? assignedRaw.replace(/[^+\d]/g, '') : null;
  const envClean = number ? number.replace(/[^+\d]/g, '') : null;

  let twilioNumbers: { phoneNumber: string; friendlyName: string; sid: string }[] = [];
  let listError: string | null = null;
  try {
    twilioNumbers = await listTwilioNumbers();
  } catch (e: any) {
    listError = e?.message || 'failed to fetch';
  }

  const ownedSet = new Set(twilioNumbers.map(n => n.phoneNumber.replace(/[^+\d]/g, '')));

  // Walk the same resolution voice-twiml uses
  let resolvedCallerId: string | null = null;
  let resolvedSource = 'none';
  if (assignedClean && ownedSet.has(assignedClean)) {
    resolvedCallerId = assignedClean;
    resolvedSource = 'agent-assigned';
  } else if (envClean && ownedSet.has(envClean)) {
    resolvedCallerId = envClean;
    resolvedSource = assignedClean ? 'env-fallback (assigned not on account)' : 'env-default';
  } else if (ownedSet.size > 0) {
    resolvedCallerId = Array.from(ownedSet)[0];
    resolvedSource = 'first-available (env + assigned both invalid)';
  }

  return NextResponse.json({
    you: {
      user_id: user.id,
      role: user.role,
      assigned_twilio_phone_number_raw: assignedRaw,
      assigned_twilio_phone_number_cleaned: assignedClean,
      assigned_is_on_account: assignedClean ? ownedSet.has(assignedClean) : false,
    },
    resolved: {
      caller_id_for_outbound: resolvedCallerId,
      source: resolvedSource,
      will_outbound_work: !!resolvedCallerId,
    },
    env: {
      TWILIO_ACCOUNT_SID: sid ? `${sid.substring(0, 10)}... (${sid.length} chars)` : '❌ MISSING',
      TWILIO_AUTH_TOKEN: token ? `set (${token.length} chars)` : '❌ MISSING',
      TWILIO_PHONE_NUMBER_raw: number || '❌ MISSING',
      TWILIO_PHONE_NUMBER_cleaned: envClean,
      TWILIO_PHONE_NUMBER_is_on_account: envClean ? ownedSet.has(envClean) : false,
      TWILIO_CALLER_ID: callerIdEnv || '(unused; using TWILIO_PHONE_NUMBER)',
      NEXT_PUBLIC_APP_URL: appUrl || '❌ MISSING',
    },
    twilio_account: {
      configured: !!(sid && token),
      list_numbers_error: listError,
      owned_count: twilioNumbers.length,
      owned_numbers: twilioNumbers.map(n => n.phoneNumber),
    },
    webhooks: {
      status_callback: appUrl ? `${appUrl}/api/twilio/status` : '⚠️  APP_URL not set',
      voice_twiml: appUrl ? `${appUrl}/api/twilio/voice-twiml` : '⚠️  APP_URL not set',
    },
  });
}
