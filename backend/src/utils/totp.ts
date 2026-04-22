/**
 * TOTP Utility (RFC 6238)
 * Pure Node.js crypto implementation — no external TOTP library needed.
 * Compatible with Google Authenticator, Authy, and all standard TOTP apps.
 */

import crypto from 'crypto';

// ─── Base32 Encoding/Decoding ────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_MAP: Record<string, number> = {};
for (let i = 0; i < BASE32_CHARS.length; i++) {
  BASE32_MAP[BASE32_CHARS[i]] = i;
}

function base32Decode(input: string): Buffer {
  const s = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of s) {
    const v = BASE32_MAP[char];
    if (v === undefined) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function base32Encode(input: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 0x1f];
  // Pad to multiple of 8
  while (output.length % 8 !== 0) output += '=';
  return output;
}

// ─── TOTP Core ────────────────────────────────────────────────────────────────

const PERIOD = 30; // 30-second windows
const DIGITS = 6;

function hotp(secret: Buffer, counter: bigint): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac('sha1', secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

function timeStep(time = Date.now()): bigint {
  return BigInt(Math.floor(time / 1000 / PERIOD));
}

export function generateTOTP(secretBase32: string, time = Date.now()): string {
  return hotp(base32Decode(secretBase32), timeStep(time));
}

/**
 * Verify a TOTP token — allows ±1 time step (±30s) for clock drift
 */
export function verifyTOTP(token: string, secretBase32: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const now = timeStep();
  for (const delta of [-1n, 0n, 1n]) {
    const expected = hotp(base32Decode(secretBase32), now + delta);
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a cryptographically random base32 secret (20 bytes = 160 bits)
 */
export function generateTOTPSecret(): string {
  return base32Encode(crypto.randomBytes(20)).replace(/=/g, '');
}

/**
 * Build the otpauth:// URI for QR code generation
 */
export function generateTOTPUri(
  email: string,
  secret: string,
  issuer = 'FCS-26 Network'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`;
}
