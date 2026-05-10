import { generateDialTwiML } from '@/lib/twilio';

// Hit by TWILIO when agent picks up. Bridges to lead using the caller ID
// specified in the URL params (passed by /api/twilio/call).
export async function POST(request: Request) {
  const url = new URL(request.url);
  const toNumber = url.searchParams.get('to') || '';
  const callerId = url.searchParams.get('caller_id') || process.env.TWILIO_PHONE_NUMBER || '';

  const twiml = generateDialTwiML(toNumber, callerId);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}

export async function GET(request: Request) {
  return POST(request);
}
