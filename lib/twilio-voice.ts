import 'server-only';
import twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const API_KEY = process.env.TWILIO_API_KEY;
const API_SECRET = process.env.TWILIO_API_SECRET;
const TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID;

export function isVoiceSdkConfigured(): boolean {
  return !!(ACCOUNT_SID && API_KEY && API_SECRET && TWIML_APP_SID);
}

/**
 * Generate a short-lived Twilio access token for the browser Voice SDK.
 * The browser uses this to register with Twilio and place calls.
 *
 * Tokens expire after 1 hour. The browser auto-refreshes by calling
 * /api/twilio/voice-token again.
 */
export function generateVoiceToken(agentIdentity: string): string {
  if (!isVoiceSdkConfigured()) {
    throw new Error('Voice SDK not configured. Set TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID.');
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // identity must be URL-safe and unique per agent. We use the agent's UUID.
  const token = new AccessToken(
    ACCOUNT_SID!,
    API_KEY!,
    API_SECRET!,
    { identity: agentIdentity, ttl: 3600 }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: TWIML_APP_SID,
    incomingAllow: false, // We only do outbound; flip to true to accept inbound calls
  });

  token.addGrant(voiceGrant);
  return token.toJwt();
}
