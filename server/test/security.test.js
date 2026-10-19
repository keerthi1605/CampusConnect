import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PASSWORD, setupTestApp } from './helpers.js';

let t;
let admin;
let injectVictim;
before(async () => {
  // Small limits just for this file (each test file is its own process)
  t = await setupTestApp({
    env: { AUTH_LOGIN_MAX: '3', AUTH_LOGIN_IP_MAX: '1000', AUTH_REGISTER_MAX: '12', RATE_LIMIT_API_MAX: '120' },
  });
  admin = await t.makeAdmin();
  // Created now: later registrations would hit the (deliberately small) registration limit
  injectVictim = await t.makeStudent('Inject', 'inject@safe.test');
});
after(() => t.teardown());

const login = (email, password) => t.api('/auth/login', { method: 'POST', body: { email, password } });

describe('rate limiting: sign-in', () => {
  let victim;
  before(async () => {
    victim = await t.makeStudent('Victim', 'victim@rate.test');
  });

  it('blocks an account after repeated failures, in the standard error shape with Retry-After', async () => {
    for (let i = 0; i < 3; i++) assert.equal((await login(victim.email, 'WrongPass1')).status, 401);
    const blocked = await login(victim.email, 'WrongPass1');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
    assert.match(blocked.body.message, /Too many failed sign-in attempts/);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0, 'Retry-After header is set');
  });

  it('keeps blocking that account, even with the right password, until the window passes', async () => {
    assert.equal((await login(victim.email, PASSWORD)).status, 429);
  });

  it('does not lock out other accounts from the same IP (shared campus network)', async () => {
    const other = await t.makeStudent('Other', 'other@rate.test');
    assert.equal((await login(other.email, 'WrongPass1')).status, 401);
    assert.equal((await login(other.email, PASSWORD)).status, 200);
  });

  it('does not count successful logins', async () => {
    const busy = await t.makeStudent('Busy', 'busy@rate.test');
    for (let i = 0; i < 6; i++) assert.equal((await login(busy.email, PASSWORD)).status, 200);
  });

  it('counts an email case-insensitively, so changing the letter case does not reset the count', async () => {
    const s = await t.makeStudent('Casey', 'casey@rate.test');
    for (const e of ['casey@rate.test', 'CASEY@rate.test', 'Casey@Rate.test']) {
      assert.equal((await login(e, 'WrongPass1')).status, 401);
    }
    assert.equal((await login('casey@RATE.test', 'WrongPass1')).status, 429);
    assert.ok(s);
  });
});

describe('rate limiting: registration', () => {
  it('limits how many accounts one IP can create per hour', async () => {
    // Some of the 12 allowed registrations were used by earlier tests; keep going until blocked
    const statuses = [];
    for (let i = 0; i < 20 && statuses.at(-1) !== 429; i++) {
      const res = await t.api('/auth/register', {
        method: 'POST',
        body: { name: 'Bulk User', email: `bulk${i}@rate.test`, password: PASSWORD },
      });
      statuses.push(res.status);
    }
    assert.equal(statuses.at(-1), 429, `expected to be blocked within 20 attempts, got ${statuses}`);
    assert.ok(statuses.slice(0, -1).every((c) => c === 201), 'every attempt before the block succeeded');
    assert.ok(statuses.length < 12, 'the limit is 12 in total, so the block comes before that many more');
  });
});

describe('input hardening', () => {
  it('rejects an oversized body with 413 before parsing it', async () => {
    const res = await t.api('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.test', password: 'x'.repeat(30_000) },
    });
    assert.equal(res.status, 413);
    assert.equal(res.body.success, false);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await t.api('/auth/login', { method: 'POST', rawBody: '{"email": ' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Malformed JSON/);
  });

  it('does not accept Mongo operators in a login body (no NoSQL injection)', async () => {
    const victim = injectVictim;
    const attempts = [
      { email: { $gt: '' }, password: PASSWORD },
      { email: victim.email, password: { $ne: null } },
      { email: { $regex: '.*' }, password: { $ne: '' } },
    ];
    for (const body of attempts) {
      const res = await t.api('/auth/login', { method: 'POST', body });
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.token, undefined);
    }
  });

  it('ignores operator-style query keys', async () => {
    const res = await t.api('/students?branch[$ne]=CSE&q[$ne]=x', { token: admin.token });
    assert.equal(res.status, 200);
  });
});

describe('browser protections', () => {
  it('allows listed origins and blocks others with a JSON 403', async () => {
    const ok = await t.api('/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const bad = await t.api('/health', { headers: { Origin: 'http://evil.example' } });
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });

  it('answers preflight for PATCH with the Authorization header', async () => {
    const res = await fetch(`${t.base}/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.match(res.headers.get('access-control-allow-methods'), /PATCH/);
    assert.match(res.headers.get('access-control-allow-headers'), /authorization/i);
  });

  it('sets security headers and does not advertise Express', async () => {
    const res = await t.api('/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('error responses', () => {
  it('hides internals and stack traces in production', async () => {
    const { errorHandler } = await import('../src/middleware/errorHandler.js');
    const run = (env) => {
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = env;
      let sent;
      const res = { status() { return this; }, json(body) { sent = body; } };
      const original = console.error;
      console.error = () => {};
      try {
        errorHandler(new Error('secret database detail'), {}, res, () => {});
      } finally {
        console.error = original;
        process.env.NODE_ENV = previous;
      }
      return sent;
    };
    const prod = run('production');
    assert.equal(prod.message, 'Internal server error');
    assert.ok(!('stack' in prod));
    assert.ok(!JSON.stringify(prod).includes('secret'));
    assert.ok('stack' in run('development'));
  });

  it('answers unknown routes with a JSON 404', async () => {
    const res = await t.api('/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

describe('rate limiting: whole API', () => {
  it('eventually answers 429 to a client that hammers the API', async () => {
    let first429 = null;
    for (let i = 0; i < 200; i++) {
      const res = await t.api('/health');
      if (res.status === 429) {
        first429 = res;
        break;
      }
    }
    assert.ok(first429, 'expected a 429 within 200 requests');
    assert.equal(first429.body.success, false);
    assert.ok(Number(first429.headers.get('retry-after')) > 0);
  });
});
