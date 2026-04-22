/**
 * CSRF Middleware — Unit Tests
 *
 * Uses a minimal Express mock (httpMocks) to test the CSRF middleware
 * without spinning up a real server or DB.
 *
 * Note: We mock `config` so the HMAC secret is predictable in tests.
 */

// ── Mock config BEFORE importing any module that uses it ────────────────────
jest.mock('../config', () => ({
  __esModule: true,
  default: {
    jwt: { secret: 'test-csrf-secret-at-least-32-characters-xxx' },
    server: { isProduction: false, nodeEnv: 'test', isTest: true },
  },
}));

// Import after mocking
import { csrfToken, csrfProtect } from '../middleware/csrf';

// ── Express mock helpers ────────────────────────────────────────────────────
function buildReq(overrides: Partial<{
  method: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  path: string;
}> = {}) {
  return {
    method: 'GET',
    headers: {},
    cookies: {},
    path: '/api/test',
    ...overrides,
  } as any;
}

function buildRes() {
  const res: any = {
    _cookies: {} as Record<string, unknown>,
    _status: 200,
    _json: null as unknown,
  };
  res.cookie = (name: string, value: string, options: unknown) => {
    res._cookies[name] = { value, options };
    return res;
  };
  res.status = (code: number) => {
    res._status = code;
    return res;
  };
  res.json = (data: unknown) => {
    res._json = data;
    return res;
  };
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('csrfToken middleware (cookie issuer)', () => {
  it('sets XSRF-TOKEN cookie on GET request', () => {
    const req = buildReq({ method: 'GET' });
    const res = buildRes();
    const next = jest.fn();

    csrfToken(req, res, next);

    expect(res._cookies['XSRF-TOKEN']).toBeDefined();
    expect(typeof res._cookies['XSRF-TOKEN'].value).toBe('string');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets a token with 3 dot-separated parts', () => {
    const req = buildReq({ method: 'GET' });
    const res = buildRes();
    csrfToken(req, res, jest.fn());

    const token: string = res._cookies['XSRF-TOKEN'].value;
    expect(token.split('.').length).toBe(3);
  });

  it('issues a new token on every call', () => {
    const res1 = buildRes();
    const res2 = buildRes();
    csrfToken(buildReq(), res1, jest.fn());
    csrfToken(buildReq(), res2, jest.fn());
    expect(res1._cookies['XSRF-TOKEN'].value).not.toBe(res2._cookies['XSRF-TOKEN'].value);
  });
});

describe('csrfProtect middleware (validator)', () => {
  function issueToken(): string {
    const res = buildRes();
    csrfToken(buildReq(), res, jest.fn());
    return res._cookies['XSRF-TOKEN'].value as string;
  }

  it('passes GET requests without a token', () => {
    const req = buildReq({ method: 'GET', cookies: {} });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
  });

  it('passes HEAD requests without a token', () => {
    const req = buildReq({ method: 'HEAD' });
    const res = buildRes();
    const next = jest.fn();
    csrfProtect(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects POST with missing CSRF cookie', () => {
    const req = buildReq({
      method: 'POST',
      cookies: {},
      headers: { 'x-csrf-token': 'anything' },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST with missing header', () => {
    const token = issueToken();
    const req = buildReq({
      method: 'POST',
      cookies: { 'XSRF-TOKEN': token },
      headers: {}, // no x-csrf-token header
    });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(res._status).toBe(403);
  });

  it('accepts POST with valid matching token', () => {
    const token = issueToken();
    const req = buildReq({
      method: 'POST',
      cookies: { 'XSRF-TOKEN': token },
      headers: { 'x-csrf-token': token },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(res._status).toBe(200); // untouched
  });

  it('rejects POST when header token is tampered', () => {
    const token = issueToken();
    const tampered = token.slice(0, -4) + 'xxxx';
    const req = buildReq({
      method: 'POST',
      cookies: { 'XSRF-TOKEN': token },
      headers: { 'x-csrf-token': tampered },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(res._status).toBe(403);
  });

  it('rejects PUT with cookie/header mismatch', () => {
    const token1 = issueToken();
    const token2 = issueToken();
    const req = buildReq({
      method: 'PUT',
      cookies: { 'XSRF-TOKEN': token1 },
      headers: { 'x-csrf-token': token2 },
    });
    const res = buildRes();
    const next = jest.fn();

    csrfProtect(req, res, next);
    expect(res._status).toBe(403);
  });

  it('accepts PATCH and DELETE with valid token', () => {
    for (const method of ['PATCH', 'DELETE']) {
      const token = issueToken();
      const req = buildReq({
        method,
        cookies: { 'XSRF-TOKEN': token },
        headers: { 'x-csrf-token': token },
      });
      const res = buildRes();
      const next = jest.fn();
      csrfProtect(req, res, next);
      expect(next).toHaveBeenCalledWith();
    }
  });
});
