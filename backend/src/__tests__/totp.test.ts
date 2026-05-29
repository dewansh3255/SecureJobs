/**
 * TOTP Utility — Unit Tests
 * Tests the pure crypto functions without any DB or network dependencies.
 */

import {
  generateTOTPSecret,
  generateTOTP,
  verifyTOTP,
  generateTOTPUri,
} from '../utils/totp';

describe('generateTOTPSecret', () => {
  it('should return a non-empty base32 string', () => {
    const secret = generateTOTPSecret();
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    // Base32 characters only (no padding in our implementation)
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('should generate unique secrets each time', () => {
    const s1 = generateTOTPSecret();
    const s2 = generateTOTPSecret();
    expect(s1).not.toBe(s2);
  });

  it('should be at least 160 bits (20 bytes) = 32 base32 chars', () => {
    const secret = generateTOTPSecret();
    // 20 bytes → 32 base32 chars (unpadded)
    expect(secret.length).toBeGreaterThanOrEqual(32);
  });
});

describe('generateTOTP + verifyTOTP', () => {
  it('should verify a freshly generated TOTP code', () => {
    const secret = generateTOTPSecret();
    const code = generateTOTP(secret);
    expect(verifyTOTP(code, secret)).toBe(true);
  });

  it('should return 6-digit code', () => {
    const secret = generateTOTPSecret();
    const code = generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('should reject a wrong code', () => {
    const secret = generateTOTPSecret();
    expect(verifyTOTP('000000', secret)).toBe(false);
  });

  it('should reject codes with wrong length', () => {
    const secret = generateTOTPSecret();
    expect(verifyTOTP('12345', secret)).toBe(false);
    expect(verifyTOTP('1234567', secret)).toBe(false);
  });

  it('should reject non-numeric input', () => {
    const secret = generateTOTPSecret();
    expect(verifyTOTP('abcdef', secret)).toBe(false);
  });

  it('should accept a code from the previous 30s window (clock drift)', () => {
    const secret = generateTOTPSecret();
    // Code from 30 seconds ago (previous period) — accepted for clock drift
    const pastCode = generateTOTP(secret, Date.now() - 30_000);
    expect(verifyTOTP(pastCode, secret)).toBe(true);
  });

  it('should reject a code from 30s in the future', () => {
    const secret = generateTOTPSecret();
    // Future codes are NOT accepted — prevents pre-use attacks
    const futureCode = generateTOTP(secret, Date.now() + 30_000);
    expect(verifyTOTP(futureCode, secret)).toBe(false);
  });

  it('should reject a code from >30s outside window', () => {
    const secret = generateTOTPSecret();
    const oldCode = generateTOTP(secret, Date.now() - 90_000);
    const futureCode = generateTOTP(secret, Date.now() + 90_000);
    // Both must fail — neither is within the ±1 window
    expect(verifyTOTP(oldCode, secret)).toBe(false);
    expect(verifyTOTP(futureCode, secret)).toBe(false);
  });
});

describe('generateTOTPUri', () => {
  it('should return a valid otpauth URI', () => {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri('user@example.com', secret);
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(secret);
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });

  it('should URL-encode email and issuer', () => {
    const secret = generateTOTPSecret();
    const uri = generateTOTPUri('user+test@example.com', secret, 'My App');
    expect(uri).toContain('My%20App');
    expect(uri).toContain('user%2Btest%40example.com');
  });
});
