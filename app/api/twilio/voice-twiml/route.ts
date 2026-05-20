import { supabaseAdmin } from '@/lib/supabase';
import { listTwilioNumbers } from '@/lib/twilio';

// Twilio hits this URL when a browser-based call is placed.
// The browser passes a "To" parameter — we return TwiML telling Twilio to dial it.

// Cache the set of owned Twilio numbers in-memory so we don't hit the API
// on every outbound call. 60-second TTL is fine — numbers change rarely.
//
// NOTE: We deliberately do NOT filter by `capabilities.voice`. That field
// indicates whether the number can RECEIVE inbound voice calls — not
// whether it's usable as an outbound caller ID. Any number you own can be
// a caller ID; filtering by capability locks people out of working setups.
let numbersCache: { value: Set<string>; expiresAt: number } | null = null;

async function getValidTwilioNumbers(): Promise<Set<string>> {
  if (numbersCache && Date.now() < numbersCache.expiresAt) {
    return numbersCache.value;
  }
  const list = await listTwilioNumbers();
  const set = new Set(list.map(n => n.phoneNumber.replace(/[^+\d]/g, '')));
  numbersCache = { value: set, expiresAt: Date.now() + 60_000 };
  return set;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const to = formData.get('To')?.toString() || '';
  const agentId = formData.get('agentId')?.toString();
  const contactId = formData.get('contactId')?.toString();

  // Determine caller ID. The "From" on an outbound <Dial> MUST be a number
  // owned by this Twilio account. If the agent's assigned number isn't,
  // Twilio rejects the call with "your call could not be completed".
  //
  // Resolution order:
  //   1. The agent's assigned twilio_phone_number — IF it's actually on the
  //      account.
  //   2. TWILIO_PHONE_NUMBER env var (the company default).
  //   3. Any valid Twilio number (last resort, prevents total failure).
  const envDefault = (process.env.TWILIO_PHONE_NUMBER || '').replace(/[^+\d]/g, '');
  let assigned = '';

  if (agentId) {
    const { data: agent } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number')
      .eq('id', agentId)
      .single();
    if (agent?.twilio_phone_number) {
      assigned = agent.twilio_phone_number.replace(/[^+\d]/g, '');
    }
  }

  let callerId = '';
  let callerIdSource = 'none';

  try {
    const validNumbers = await getValidTwilioNumbers();

    if (assigned && validNumbers.has(assigned)) {
      callerId = assigned;
      callerIdSource = 'agent-assigned';
    } else if (envDefault && validNumbers.has(envDefault)) {
      callerId = envDefault;
      callerIdSource = assigned ? 'env-fallback (assigned invalid)' : 'env-default';
    } else if (validNumbers.size > 0) {
      // Truly the last resort: pick any owned number so the call can complete.
      callerId = Array.from(validNumbers)[0];
      callerIdSource = 'first-available (env + assigned both invalid)';
    }
  } catch (e) {
    // Couldn't reach Twilio to fetch numbers — trust whatever we have rather
    // than blocking the call. Twilio will still reject if it's bogus.
    console.error('voice-twiml: failed to fetch Twilio numbers, using best guess', e);
    callerId = assigned || envDefault;
    callerIdSource = 'unvalidated-fallback';
  }

  if (!callerId) {
    console.error('voice-twiml: NO valid caller ID available', { agentId, assigned, envDefault });
    // Returning a hangup is friendlier than an Internal Application Error.
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">No outbound caller ID is configured for your account. Please contact your administrator.</Say><Hangup/></Response>`,
      { headers: { 'Content-Type': 'text/xml' } },
    );
  }

  // Always log the resolved TwiML inputs so we can correlate with Twilio
  // Console call logs when something goes wrong.
  console.log('voice-twiml: outbound', {
    agentId, to: to.replace(/[^+\d]/g, ''), callerId, source: callerIdSource,
  });

  let safeTo = to.replace(/[^+\d]/g, '');
  // Normalize to E.164 if no country code provided (assume US)
  if (!safeTo.startsWith('+')) {
    const d = safeTo.replace(/\D/g, '');
    if (d.length === 10) safeTo = `+1${d}`;
    else if (d.length === 11 && d.startsWith('1')) safeTo = `+${d}`;
    else safeTo = `+${d}`;
  }
  const safeCallerId = callerId;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  const statusCallback = appUrl
    ? `${appUrl}/api/twilio/status${contactId ? `?contact_id=${contactId}` : ''}`
    : '';
  const recordingCallback = contactId
    ? `${appUrl}/api/twilio/recording?contact_id=${contactId}`
    : '';

  // NOTE on TwiML attributes:
  //   - `statusCallback*` are NOT valid on <Dial> — they live on the noun
  //     (<Number> / <Client>). Putting them on <Dial> triggers Twilio
  //     XML validation warning 12200 and the callbacks never fire.
  //   - Recording (record / recordingStatusCallback) DOES belong on <Dial>.
  //   - We only enable recording when there's a contact_id to file it
  //     against. Recording dialer-only calls just generates orphan files,
  //     and on some Twilio configurations enabling record on international
  //     calls without a callback URL produces validation noise.
  const statusAttrs = statusCallback
    ? ` statusCallback="${statusCallback}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST"`
    : '';
  const recordAttr = contactId ? ' record="record-from-answer-dual"' : '';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${safeCallerId}"${recordAttr} answerOnBridge="true" timeout="30"${recordingCallback ? ` recordingStatusCallback="${recordingCallback}"` : ''}>
    <Number${statusAttrs}>${safeTo}</Number>
  </Dial>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function GET(request: Request) {
  return POST(request);
}
