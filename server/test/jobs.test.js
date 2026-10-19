import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { future, past, setupTestApp } from './helpers.js';

let t;
let admin;
before(async () => {
  t = await setupTestApp();
  admin = await t.makeAdmin();
});
after(() => t.teardown());

const jobBody = (over = {}) => ({
  title: 'Platform Engineer',
  company: 'Acme Labs',
  description: 'Build the internal platform.',
  type: 'full-time',
  deadline: future(10).toISOString(),
  ...over,
});

describe('creating jobs', () => {
  it('lets an admin create a job and records who posted it', async () => {
    const res = await t.api('/jobs', {
      method: 'POST',
      token: admin.token,
      body: jobBody({ ctc: 8, eligibility: { minCgpa: 7, branches: ['CSE'], maxBacklogs: 0, batchYear: 2026 } }),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.job.createdBy, admin.user._id);
    assert.equal(res.body.job.status, 'open');
  });

  it('applies eligibility defaults when none are given', async () => {
    const job = await t.makeJob(admin);
    assert.equal(job.eligibility.minCgpa, 0);
    assert.deepEqual(job.eligibility.branches, []);
  });

  it('is forbidden to students and unauthenticated callers', async () => {
    const s = await t.makeStudent();
    assert.equal((await t.api('/jobs', { method: 'POST', token: s.token, body: jobBody() })).status, 403);
    assert.equal((await t.api('/jobs', { method: 'POST', body: jobBody() })).status, 401);
  });

  it('validates input', async () => {
    const post = (body) => t.api('/jobs', { method: 'POST', token: admin.token, body });
    assert.equal((await post(jobBody({ deadline: past(1).toISOString() }))).status, 400, 'past deadline');
    assert.equal((await post(jobBody({ title: 'x' }))).status, 400, 'short title');
    assert.equal((await post(jobBody({ type: 'gig' }))).status, 400, 'unknown type');
    assert.equal((await post(jobBody({ eligibility: { branches: ['MARS'] } }))).status, 400, 'unknown branch');
  });
});

describe('listing', () => {
  let openJob;
  let closedJob;
  let expiredJob;
  before(async () => {
    openJob = await t.makeJob(admin, { title: 'ListOpen Alpha', company: 'ListCo', type: 'internship', ctc: 5 });
    closedJob = await t.makeJob(admin, { title: 'ListClosed Beta', company: 'ListCo' });
    await t.api(`/jobs/${closedJob._id}`, { method: 'PUT', token: admin.token, body: { status: 'closed' } });
    expiredJob = await t.models.Job.create({
      title: 'ListExpired Gamma',
      company: 'ListCo',
      description: 'Deadline already passed.',
      type: 'full-time',
      deadline: past(1),
      createdBy: admin.user._id,
    });
  });

  const titles = async (qs, token = admin.token) =>
    (await t.api(`/jobs?q=List${qs}`, { token })).body.data.map((j) => j.title).sort();

  it('hides closed and expired jobs by default', async () => {
    assert.deepEqual(await titles(''), ['ListOpen Alpha']);
  });

  it('shows closed/expired with status=closed, and everything with status=all', async () => {
    assert.deepEqual(await titles('&status=closed'), ['ListClosed Beta', 'ListExpired Gamma']);
    assert.equal((await titles('&status=all')).length, 3);
  });

  it('filters by type and searches company text', async () => {
    assert.deepEqual(await titles('&type=internship'), ['ListOpen Alpha']);
    assert.deepEqual(await titles('&status=all&type=full-time'), ['ListClosed Beta', 'ListExpired Gamma']);
  });

  it('still serves an expired job by id', async () => {
    const s = await t.makeStudent();
    const res = await t.api(`/jobs/${expiredJob._id}`, { token: s.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.job.eligible, false);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    assert.equal((await t.api(`/jobs/${'a'.repeat(24)}`, { token: admin.token })).status, 404);
    assert.equal((await t.api('/jobs/not-an-id', { token: admin.token })).status, 400);
  });

  it('keeps the open job reachable for the next tests', () => {
    assert.ok(openJob && closedJob);
  });
});

describe('eligibility on the job list', () => {
  let job;
  let matching;
  let mismatched;
  before(async () => {
    job = await t.makeJob(admin, {
      title: 'EligCheck Role',
      eligibility: { minCgpa: 7, branches: ['CSE', 'IT'], maxBacklogs: 0, batchYear: 2026 },
    });
    matching = await t.makeStudentWithProfile({ branch: 'CSE', cgpa: 8.5, batchYear: 2026, backlogs: 0 });
    mismatched = await t.makeStudentWithProfile({ branch: 'ECE', cgpa: 6, batchYear: 2025, backlogs: 2 });
  });

  const view = async (token) =>
    (await t.api('/jobs?q=EligCheck', { token })).body.data.find((j) => j._id === job._id);

  it('marks a matching student eligible', async () => {
    const j = await view(matching.token);
    assert.equal(j.eligible, true);
    assert.deepEqual(j.reasons, []);
  });

  it('lists every reason for a student who does not match', async () => {
    const j = await view(mismatched.token);
    assert.equal(j.eligible, false);
    assert.equal(j.reasons.length, 4);
  });

  it('marks every job ineligible for a student without a profile', async () => {
    const s = await t.makeStudent();
    const j = await view(s.token);
    assert.equal(j.eligible, false);
    assert.match(j.reasons[0], /profile/i);
  });

  it('adds no eligibility fields for admins', async () => {
    const j = await view(admin.token);
    assert.ok(!('eligible' in j) && !('reasons' in j));
  });
});

describe('updating jobs (PUT is a partial update)', () => {
  let job;
  before(async () => {
    job = await t.makeJob(admin, {
      title: 'Patchable Role',
      location: 'Pune',
      ctc: 8,
      eligibility: { minCgpa: 6, branches: ['CSE', 'IT'], maxBacklogs: 0, batchYear: 2026 },
    });
  });
  const put = (body, token = admin.token) => t.api(`/jobs/${job._id}`, { method: 'PUT', token, body });

  it('changes only the fields that are sent', async () => {
    const res = await put({ status: 'closed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.job.status, 'closed');
    assert.equal(res.body.job.title, 'Patchable Role');
    await put({ status: 'open' });
  });

  it('merges eligibility field by field', async () => {
    const res = await put({ eligibility: { minCgpa: 9 } });
    assert.equal(res.body.job.eligibility.minCgpa, 9);
    assert.deepEqual(res.body.job.eligibility.branches, ['CSE', 'IT']);
    assert.equal(res.body.job.eligibility.maxBacklogs, 0);
    assert.equal(res.body.job.eligibility.batchYear, 2026);
  });

  it('clears optional fields when they are sent as null or ""', async () => {
    const res = await put({ eligibility: { maxBacklogs: null, batchYear: '' }, location: null, ctc: null });
    assert.equal(res.status, 200);
    assert.equal(res.body.job.eligibility.maxBacklogs, null);
    assert.equal(res.body.job.eligibility.batchYear, null);
    assert.equal(res.body.job.location, null);
    assert.equal(res.body.job.ctc, null);
    assert.equal(res.body.job.eligibility.minCgpa, 9, 'other rules are untouched');
  });

  it('lets a student through once a cap has been cleared', async () => {
    const s = await t.makeStudentWithProfile({ branch: 'CSE', cgpa: 9.5, batchYear: 2024, backlogs: 4 });
    const res = await t.api(`/jobs/${job._id}`, { token: s.token });
    assert.equal(res.body.job.eligible, true, JSON.stringify(res.body.job.reasons));
  });

  it('rejects an empty body, bad values, and non-admins', async () => {
    assert.equal((await put({})).status, 400);
    assert.equal((await put({ ctc: 'abc' })).status, 400);
    const s = await t.makeStudent();
    assert.equal((await put({ status: 'closed' }, s.token)).status, 403);
    const missing = await t.api(`/jobs/${'a'.repeat(24)}`, { method: 'PUT', token: admin.token, body: { status: 'closed' } });
    assert.equal(missing.status, 404);
  });
});

describe('deleting jobs', () => {
  it('lets an admin delete a job with no applications; students cannot', async () => {
    const job = await t.makeJob(admin);
    const s = await t.makeStudent();
    assert.equal((await t.api(`/jobs/${job._id}`, { method: 'DELETE', token: s.token })).status, 403);
    assert.equal((await t.api(`/jobs/${job._id}`, { method: 'DELETE', token: admin.token })).status, 200);
    assert.equal((await t.api(`/jobs/${job._id}`, { token: admin.token })).status, 404);
  });
});
