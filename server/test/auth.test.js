import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { PASSWORD, setupTestApp } from './helpers.js';

let t;
before(async () => {
  t = await setupTestApp();
});
after(() => t.teardown());

describe('registration', () => {
  it('creates a student, returns a token, and never exposes the password hash', async () => {
    const res = await t.api('/auth/register', {
      method: 'POST',
      body: { name: 'Alice', email: 'Alice@Example.test', password: PASSWORD },
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.email, 'alice@example.test');
    assert.ok(!JSON.stringify(res.body).includes('$2'), 'response must not contain a bcrypt hash');
    assert.ok(!('passwordHash' in res.body.user));
  });

  it('stores the password as a bcrypt hash', async () => {
    const stored = await t.models.User.findOne({ email: 'alice@example.test' }).select('+passwordHash');
    assert.match(stored.passwordHash, /^\$2[aby]\$\d{2}\$/); // cost is lowered under test
    assert.notEqual(stored.passwordHash, PASSWORD);
  });

  it('cannot be used to self-register as admin', async () => {
    const res = await t.api('/auth/register', {
      method: 'POST',
      body: { name: 'Mallory', email: 'mallory@example.test', password: PASSWORD, role: 'admin' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'student');
  });

  it('rejects a duplicate email regardless of letter case', async () => {
    const res = await t.api('/auth/register', {
      method: 'POST',
      body: { name: 'Alice 2', email: 'ALICE@example.test', password: PASSWORD },
    });
    assert.equal(res.status, 409);
  });

  it('rejects weak or malformed input with per-field errors', async () => {
    const res = await t.api('/auth/register', {
      method: 'POST',
      body: { name: 'B', email: 'not-an-email', password: 'short' },
    });
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field);
    for (const f of ['body.name', 'body.email', 'body.password']) assert.ok(fields.includes(f), f);
  });
});

describe('login and tokens', () => {
  it('logs in with a case-insensitive email', async () => {
    const res = await t.api('/auth/login', {
      method: 'POST',
      body: { email: 'ALICE@example.test', password: PASSWORD },
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrong = await t.api('/auth/login', { method: 'POST', body: { email: 'alice@example.test', password: 'WrongPass1' } });
    const unknown = await t.api('/auth/login', { method: 'POST', body: { email: 'ghost@example.test', password: 'WrongPass1' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  it('GET /auth/me needs a valid token', async () => {
    const s = await t.makeStudent();
    const ok = await t.api('/auth/me', { token: s.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.email, s.email);
    assert.equal((await t.api('/auth/me')).status, 401);
  });

  it('rejects garbage, expired, wrong-secret, alg:none and non-Bearer tokens', async () => {
    const s = await t.makeStudent();
    const id = s.user._id;
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const cases = {
      garbage: 'garbage.token.value',
      expired: jwt.sign({ role: 'student' }, process.env.JWT_SECRET, { subject: id, expiresIn: -10 }),
      wrongSecret: jwt.sign({ role: 'admin' }, crypto.randomBytes(32).toString('hex'), { subject: id }),
      algNone: `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: id, role: 'admin' })}.`,
    };
    for (const [name, token] of Object.entries(cases)) {
      const res = await t.api('/auth/me', { token });
      assert.equal(res.status, 401, name);
    }
    const basic = await t.api('/auth/me', { headers: { Authorization: `Basic ${s.token}` } });
    assert.equal(basic.status, 401);
  });
});

describe('role-based access', () => {
  it('students get 403 and admins 200 on an admin route; no token gets 401', async () => {
    const student = await t.makeStudent();
    const admin = await t.makeAdmin();
    assert.equal((await t.api('/students', { token: student.token })).status, 403);
    assert.equal((await t.api('/students', { token: admin.token })).status, 200);
    assert.equal((await t.api('/students')).status, 401);
  });

  it('role changes apply to existing tokens immediately', async () => {
    const s = await t.makeStudent();
    assert.equal((await t.api('/students', { token: s.token })).status, 403);
    await t.models.User.updateOne({ _id: s.user._id }, { role: 'admin' });
    assert.equal((await t.api('/students', { token: s.token })).status, 200);
  });

  it('a deleted user loses access at once', async () => {
    const s = await t.makeStudent();
    await t.models.User.deleteOne({ _id: s.user._id });
    const res = await t.api('/auth/me', { token: s.token });
    assert.equal(res.status, 401);
    assert.match(res.body.message, /no longer exists/);
  });
});
