import 'server-only';
import { supabaseAdmin } from './supabase';

// Twilio integration helpers (paid account, multi-agent number support).
// All credentials come from environment variables — see .env.example.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const DEFAULT_NUMBER = process.env.TWILIO_PHONE_NUMBER; // Fallback / company default
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Optional: enable answering machine detection (paid feature, ~$0.0075 per detected call)
const ENABLE_AMD = process.env.TWILIO_ENABLE_AMD !== 'false';

export function isTwilioConfigured(): boolean {
  return !!(ACCOUNT_SID && AUTH_TOKEN && DEFAULT_NUMBER);
}

/**
 * Determine which Twilio number to use as caller ID for a specific agent.
 * Returns:
 *   - The agent's assigned twilio_phone_number if set
 *   - Falls back to TWILIO_PHONE_NUMBER env var (company default)
 */
export async function getCallerIdForAgent(agentId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('twilio_phone_number')
    .eq('id', agentId)
    .single();

  return data?.twilio_phone_number || DEFAULT_NUMBER || null;
}

interface InitiateCallParams {
  toNumber: string;       // The lead's phone number (E.164: +15551234567)
  agentNumber: string;    // The agent's PERSONAL phone (where Twilio rings them first)
  agentCallerId: string;  // The Twilio number to display to the lead as caller ID
  contactId: string;      // For the call log
}

/**
 * Initiate a "click-to-call" — Twilio calls the agent's personal phone first,
 * then bridges to the lead. The lead sees agentCallerId (a Twilio number) as
 * the caller ID, NOT the agent's personal phone.
 */
export async function initiateCall(params: InitiateCallParams): Promise<{ callSid: string }> {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your env.');
  }

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`;

  // Pass the caller ID into the TwiML URL so the second leg (Dial to lead) uses it.
  const twimlUrl = `${APP_URL}/api/twilio/twiml/dial?to=${encodeURIComponent(params.toNumber)}&caller_id=${encodeURIComponent(params.agentCallerId)}&contact_id=${params.contactId}`;
  const statusUrl = `${APP_URL}/api/twilio/status?contact_id=${params.contactId}`;

  // IMPORTANT: For the FIRST leg (Twilio → agent's personal phone), the "From"
  // must be a number on your Twilio account. We use the agent's assigned
  // Twilio number, OR fall back to the company default.
  const body = new URLSearchParams({
    To: params.agentNumber,
    From: params.agentCallerId,       // Must be a Twilio number you own
    Url: twimlUrl,
    StatusCallback: statusUrl,
    'StatusCallbackEvent': 'initiated ringing answered completed',
    Record: 'true',
    RecordingChannels: 'dual',
    RecordingStatusCallback: `${APP_URL}/api/twilio/recording?contact_id=${params.contactId}`,
  });

  if (ENABLE_AMD) {
    body.append('MachineDetection', 'Enable');
    body.append('AsyncAmd', 'true');
    body.append('AsyncAmdStatusCallback', `${APP_URL}/api/twilio/amd?contact_id=${params.contactId}`);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Twilio API error: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return { callSid: data.sid };
}

/**
 * Generate TwiML XML to bridge agent → lead with a specific caller ID.
 * Called per-call so each agent's outbound calls show their assigned number.
 */
export function generateDialTwiML(toNumber: string, callerId: string): string {
  const safeNumber = toNumber.replace(/[^+\d]/g, '');
  const safeCallerId = callerId.replace(/[^+\d]/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call. This call may be recorded for quality and training purposes.</Say>
  <Dial callerId="${safeCallerId}" record="record-from-answer-dual" timeout="30" answerOnBridge="true">
    <Number>${safeNumber}</Number>
  </Dial>
</Response>`;
}

/**
 * Validate phone number format. Returns E.164 format or null if invalid.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}

/**
 * List ALL phone numbers currently owned in the Twilio account.
 * Used by the admin assignment UI to pick which number to give each agent.
 */
export interface TwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  sid: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean; fax: boolean };
}

export async function listTwilioNumbers(): Promise<TwilioNumber[]> {
  if (!isTwilioConfigured()) return [];

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=200`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.incoming_phone_numbers || []).map((n: any) => ({
    phoneNumber: n.phone_number,
    friendlyName: n.friendly_name || n.phone_number,
    sid: n.sid,
    capabilities: {
      voice: !!n.capabilities?.voice,
      sms: !!n.capabilities?.sms,
      mms: !!n.capabilities?.mms,
      fax: !!n.capabilities?.fax,
    },
  }));
}
