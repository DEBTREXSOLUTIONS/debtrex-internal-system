// SERVER-ONLY. RFC 6238 TOTP (time-based one-time passwords) implemented on
// Node's crypto — no third-party auth dependency. Compatible with Google
// Authenticator, Authy, Microsoft Authenticator, 1Password, etc.

import 'server-only';
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// 160-bit base32 secret — the standard size for authenticator apps.
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, '0');
}

// Verifies a 6-digit code. `window` allows that many 30s steps of clock drift
// on either side (window=1 → accepts the previous/current/next code).
export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  const code = (token || '').replace(/\D/g, '');
  if (code.length !== DIGITS) return false;
  const secret = base32Decode(secretBase32);
  if (secret.length === 0) return false;

  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -window; drift <= window; drift++) {
    const candidate = hotp(secret, counter + drift);
    const a = Buffer.from(candidate);
    const b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

// otpauth:// URI — encode this as a QR code for the authenticator app to scan.
export function totpAuthUri(secretBase32: string, accountLabel: string, issuer = 'DEBTREX'): string {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
