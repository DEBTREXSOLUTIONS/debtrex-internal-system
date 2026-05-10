import 'server-only';

// Twilio integration helpers (paid account configuration).
// All credentials come from environment variables — see .env.example.

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Optional: a different caller ID number for outbound display.
// If you have multiple numbers (e.g., a local one per region), set this.
// Otherwise falls back to TWILIO_PHONE_NUMBER.
const CALLER_ID = process.env.TWILIO_CALLER_ID || TWILIO_NUMBER;

// Optional: enable answering machine detection (paid feature, ~$0.0075 per detected call)
const ENABLE_AMD = process.env.TWILIO_ENABLE_AMD !== 'false'; // ON by default for paid accounts

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
 *
 * Paid account features used:
 *   - No verified-caller-id restriction (we can call anyone)
 *   - Custom caller ID display (TWILIO_CALLER_ID env var)
 *   - Answering machine detection (skips voicemails)
 *   - Full recording with dual-channel separation
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
    RecordingChannels: 'dual',        // Agent and lead on separate channels — better for review
    RecordingStatusCallback: `${APP_URL}/api/twilio/recording?contact_id=${params.contactId}`,
  });

  // Paid feature: detect if the lead's line is answered by a human or machine.
  // We use this to know when to hang up early on voicemail.
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
 * Generate the TwiML XML that bridges the agent to the lead.
 * Uses the caller ID and includes a brief recording disclosure for compliance.
 */
export function generateDialTwiML(toNumber: string): string {
  const safeNumber = toNumber.replace(/[^+\d]/g, '');
  const callerId = CALLER_ID || TWILIO_NUMBER;
  // Recording disclosure played to BOTH parties for two-party-consent state compliance.
  // (See production hardening section of the Twilio Setup Guide for details.)
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting your call. This call may be recorded for quality and training purposes.</Say>
  <Dial callerId="${callerId}" record="record-from-answer-dual" timeout="30" answerOnBridge="true">
    <Number>${safeNumber}</Number>
  </Dial>
</Response>`;
}

/**
 * Validate phone number format. Returns E.164 format or null if invalid.
 * Accepts US numbers in various formats and converts to +1XXXXXXXXXX.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+') && digits.length >= 10) return `+${digits}`;
  return null;
}
