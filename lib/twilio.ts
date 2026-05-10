import 'server-only';

// Twilio integration helpers.
// All credentials come from environment variables — see .env.example.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export function isTwilioConfigured(): boolean {
  return !!(ACCOUNT_SID && AUTH_TOKEN && TWILIO_NUMBER);
}

interface InitiateCallParams {
  toNumber: string;       // The lead's phone number (E.164: +15551234567)
  agentNumber: string;    // The agent's phone number (where Twilio will call them first)
  contactId: string;      // For the call log
}

/**
 * Initiate a "click-to-call" — Twilio calls the agent first, then bridges
 * to the lead. Returns the Twilio Call SID for tracking.
 *
 * Flow:
 *   1. App calls this function
 *   2. Twilio rings the agent's phone
 *   3. When agent answers, Twilio dials the lead and bridges
 *   4. Twilio calls our webhook with status updates and recording URL
 */
export async function initiateCall(params: InitiateCallParams): Promise<{ callSid: string }> {
  if (!isTwilioConfigured()) {
    throw new Error('Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your env.');
  }

  const auth = Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Calls.json`;

  // TwiML URL — Twilio fetches this when the agent picks up. It tells Twilio
  // to dial the lead's number and bridge the two calls.
  const twimlUrl = `${APP_URL}/api/twilio/twiml/dial?to=${encodeURIComponent(params.toNumber)}&contact_id=${params.contactId}`;
  // Status callback — Twilio posts updates here (ringing, answered, completed, etc.)
  const statusUrl = `${APP_URL}/api/twilio/status?contact_id=${params.contactId}`;

  const body = new URLSearchParams({
    To: params.agentNumber,           // Call the AGENT first
    From: TWILIO_NUMBER!,
    Url: twimlUrl,                    // Then run this TwiML when answered
    StatusCallback: statusUrl,
    'StatusCallbackEvent': 'initiated ringing answered completed',
    Record: 'true',
    RecordingStatusCallback: `${APP_URL}/api/twilio/recording?contact_id=${params.contactId}`,
  });

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
 * Generate the TwiML XML that bridges the agent to the lead.
 */
export function generateDialTwiML(toNumber: string): string {
  // Escape just in case of weird input
  const safeNumber = toNumber.replace(/[^+\d]/g, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call.</Say>
  <Dial callerId="${TWILIO_NUMBER}" record="record-from-answer" timeout="30">
    <Number>${safeNumber}</Number>
  </Dial>
</Response>`;
}

/**
 * Validate phone number format. Returns E.164 format or null if invalid.
 * Accepts US numbers in various formats and converts to +1XXXXXXXXXX
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}
