import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { setupTestApp } from './helpers.js';

let t;
let admin;
before(async () => {
  t = await setupTestApp();
  admin = await t.makeAdmin();
});
after(() => t.teardown());

const base = { rollNo: '21cs001', branch: 'CSE', cgpa: 8.5, batchYear: 2026, backlogs: 0 };
const putProfile = (token, body) => t.api('/students/me', { method: 'PUT', token, body });

describe('own profile', () => {
  it('is null before it is created, then created by PUT with normalised values', async () => {
    const s = await t.makeStudent();
    const before = await t.api('/students/me', { token: s.token });
    assert.equal(before.status, 200);
    assert.equal(before.body.profile, null);

    const res = await putProfile(s.token, {
      ...base,
      rollNo: `x${Math.random().toString(36).slice(2, 8)}`,
      skills: ['React', 'react', ' Node ', ''],
      phone: '9876543210',
      resumeUrl: 'https://example.com/cv.pdf',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.profile.rollNo, /^[A-Z0-9]+$/, 'roll number is uppercased');
    assert.deepEqual(res.body.profile.skills, ['React', 'Node'], 'skills trimmed, de-duplicated, blanks dropped');
  });

  it('updates the same document on a second PUT, and PUT is a full replace', async () => {
    const s = await t.makeStudent();
    const first = await putProfile(s.token, { ...base, rollNo: 'FULL001', phone: '9876543210', skills: ['Go'] });
    const second = await putProfile(s.token, { ...base, rollNo: 'FULL001', cgpa: 9 });
    assert.equal(second.body.profile._id, first.body.profile._id);
    assert.equal(second.body.profile.cgpa, 9);
    assert.equal(second.body.profile.phone, undefined, 'omitted optional fields are cleared');
    assert.deepEqual(second.body.profile.skills, []);
    assert.equal(await t.models.StudentProfile.countDocuments({ user: s.user._id }), 1);
  });

  it('treats empty strings for optional fields as not provided', async () => {
    const s = await t.makeStudent();
    const res = await putProfile(s.token, { ...base, rollNo: 'EMPTY01', phone: '', resumeUrl: '' });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.phone, undefined);
  });

  it('validates every field and reports them all', async () => {
    const s = await t.makeStudent();
    const res = await putProfile(s.token, {
      rollNo: '!',
      branch: 'XYZ',
      cgpa: 11,
      batchYear: '2026',
      backlogs: -1,
      phone: '123',
      resumeUrl: 'javascript:alert(1)',
      skills: Array.from({ length: 21 }, (_, i) => `s${i}`),
    });
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field);
    for (const f of ['rollNo', 'branch', 'cgpa', 'batchYear', 'backlogs', 'phone', 'resumeUrl', 'skills']) {
      assert.ok(fields.some((x) => x.endsWith(f)), `expected an error for ${f}`);
    }
  });

  it('accepts only http(s) resume links', async () => {
    const s = await t.makeStudent();
    assert.equal((await putProfile(s.token, { ...base, rollNo: 'URL0001', resumeUrl: 'ftp://x.com/cv' })).status, 400);
    assert.equal((await putProfile(s.token, { ...base, rollNo: 'URL0001', resumeUrl: 'https://x.com/cv' })).status, 200);
  });

  it('ignores user / _id / role in the body (no mass assignment)', async () => {
    const s = await t.makeStudent();
    const other = await t.makeStudent();
    const res = await putProfile(s.token, { ...base, rollNo: 'MASS001', user: other.user._id, _id: '0'.repeat(24), role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.user, s.user._id);
    assert.notEqual(res.body.profile._id, '0'.repeat(24));
  });

  it('rejects a roll number already used by another student with 409', async () => {
    const a = await t.makeStudent();
    const b = await t.makeStudent();
    await putProfile(a.token, { ...base, rollNo: 'DUP0001' });
    const res = await putProfile(b.token, { ...base, rollNo: 'dup0001' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /rollNo/);
  });
});

describe('access control', () => {
  it('blocks students from admin routes and admins from /me', async () => {
    const s = await t.makeStudent();
    const p = await t.makeStudentWithProfile();
    assert.equal((await t.api('/students', { token: s.token })).status, 403);
    assert.equal((await t.api(`/students/${p.profile._id}`, { token: s.token })).status, 403);
    assert.equal((await t.api('/students/me', { token: admin.token })).status, 403);
    assert.equal((await t.api('/students')).status, 401);
  });
});

describe('admin directory', () => {
  const ids = {};
  before(async () => {
    // Distinct values so filters, sorting and search are unambiguous
    const rows = [
      ['Dir Anna', 'anna@dir-a.test', { rollNo: 'DIRA001', branch: 'CSE', cgpa: 9.4, batchYear: 2026, backlogs: 0 }],
      ['Dir Ben', 'ben@dir-a.test', { rollNo: 'DIRB002', branch: 'IT', cgpa: 7.3, batchYear: 2026, backlogs: 1 }],
      ['Dir Cara', 'cara@dir-b.test', { rollNo: 'DIRC003', branch: 'CSE', cgpa: 8.1, batchYear: 2025, backlogs: 0 }],
      ['Dir Dev', 'dev@dir-b.test', { rollNo: 'DIRD004', branch: 'ECE', cgpa: 6.2, batchYear: 2026, backlogs: 3 }],
    ];
    for (const [name, email, profile] of rows) ids[name] = await t.makeStudentWithProfile(profile, name, email);
  });

  const list = async (qs) => (await t.api(`/students?${qs}`, { token: admin.token })).body;
  const names = (body) => body.data.map((s) => s.user.name).sort();

  it('filters by branch, batch, CGPA range and backlogs', async () => {
    assert.deepEqual(names(await list('q=Dir&branch=CSE')), ['Dir Anna', 'Dir Cara']);
    assert.deepEqual(names(await list('q=Dir&batchYear=2025')), ['Dir Cara']);
    assert.deepEqual(names(await list('q=Dir&minCgpa=7&maxCgpa=9')), ['Dir Ben', 'Dir Cara']);
    assert.deepEqual(names(await list('q=Dir&maxBacklogs=0')), ['Dir Anna', 'Dir Cara']);
  });

  it('searches name, email and roll number, case-insensitively', async () => {
    assert.deepEqual(names(await list('q=cara')), ['Dir Cara']);
    assert.deepEqual(names(await list('q=dir-b.test')), ['Dir Cara', 'Dir Dev']);
    assert.deepEqual(names(await list('q=dird004')), ['Dir Dev']);
  });

  it('treats regex characters in the search as literal text', async () => {
    assert.equal((await list('q=.*')).data.length, 0);
    assert.equal((await t.api('/students?q=(', { token: admin.token })).status, 200);
  });

  it('sorts and paginates', async () => {
    const sorted = await list('q=Dir&sort=-cgpa');
    assert.deepEqual(sorted.data.map((s) => s.cgpa), [9.4, 8.1, 7.3, 6.2]);
    const page2 = await list('q=Dir&sort=cgpa&limit=2&page=2');
    assert.deepEqual(page2.data.map((s) => s.cgpa), [8.1, 9.4]);
    assert.equal(page2.pagination.pages, 2);
    assert.equal(page2.pagination.total, 4);
  });

  it('populates only name and email, never the password hash', async () => {
    const body = await list('q=Dir');
    assert.ok(body.data.every((s) => s.user.name && s.user.email && !('passwordHash' in s.user)));
    assert.ok(!JSON.stringify(body).includes('$2'));
  });

  it('ignores blank filters and rejects out-of-range or non-whitelisted ones', async () => {
    assert.ok((await list('q=Dir&branch=&minCgpa=')).data.length === 4);
    for (const bad of ['limit=1000', 'page=0', 'minCgpa=11', 'sort=passwordHash', 'branch=$ne']) {
      assert.equal((await t.api(`/students?${bad}`, { token: admin.token })).status, 400, bad);
    }
  });

  it('never turns operator-style query keys into Mongo operators', async () => {
    const res = await t.api('/students?branch[$ne]=CSE&q=Dir', { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 4, 'the operator key is ignored, so the filter does not apply');
  });

  it('fetches one profile by id, with 400 for a malformed id and 404 for an unknown one', async () => {
    const p = ids['Dir Anna'].profile;
    const ok = await t.api(`/students/${p._id}`, { token: admin.token });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.profile.user.email, 'anna@dir-a.test');
    assert.equal((await t.api('/students/not-an-id', { token: admin.token })).status, 400);
    assert.equal((await t.api(`/students/${'a'.repeat(24)}`, { token: admin.token })).status, 404);
  });
});
