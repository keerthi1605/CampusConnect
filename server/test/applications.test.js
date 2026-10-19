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

const apply = (jobId, token) => t.api(`/jobs/${jobId}/apply`, { method: 'POST', token });
const setStatus = (id, body) => t.api(`/applications/${id}/status`, { method: 'PATCH', token: admin.token, body });
const withdraw = (id, token) => t.api(`/applications/${id}`, { method: 'DELETE', token });

describe('applying', () => {
  let job;
  before(async () => {
    job = await t.makeJob(admin, { title: 'Apply Role', eligibility: { minCgpa: 7, branches: ['CSE'] } });
  });

  it('creates an application that starts as "applied" with one history entry', async () => {
    const s = await t.makeStudentWithProfile({ branch: 'CSE', cgpa: 8 });
    const res = await apply(job._id, s.token);
    assert.equal(res.status, 201);
    const a = res.body.application;
    assert.equal(a.status, 'applied');
    assert.equal(a.statusHistory.length, 1);
    assert.equal(a.statusHistory[0].changedBy, s.user._id);
    assert.equal(a.student, s.user._id);
    assert.equal(a.job, job._id);
  });

  it('refuses a duplicate with a clear 409', async () => {
    const s = await t.makeStudentWithProfile({ branch: 'CSE', cgpa: 8 });
    await apply(job._id, s.token);
    const res = await apply(job._id, s.token);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already applied/);
  });

  it('refuses an ineligible student with every reason, and creates nothing', async () => {
    const s = await t.makeStudentWithProfile({ branch: 'ECE', cgpa: 6 });
    const res = await apply(job._id, s.token);
    assert.equal(res.status, 403);
    assert.equal(res.body.errors.length, 2);
    assert.equal(await t.models.Application.countDocuments({ student: s.user._id }), 0);
  });

  it('refuses students without a profile, closed jobs and expired jobs', async () => {
    const noProfile = await t.makeStudent();
    assert.equal((await apply(job._id, noProfile.token)).status, 403);

    const s = await t.makeStudentWithProfile();
    const closed = await t.makeJob(admin, { title: 'Closed Role' });
    await t.api(`/jobs/${closed._id}`, { method: 'PUT', token: admin.token, body: { status: 'closed' } });
    assert.equal((await apply(closed._id, s.token)).status, 403);

    const expired = await t.models.Job.create({
      title: 'Expired Role',
      company: 'Gone',
      description: 'Deadline already passed.',
      type: 'full-time',
      deadline: past(1),
      createdBy: admin.user._id,
    });
    assert.equal((await apply(expired._id, s.token)).status, 403);
  });

  it('is student-only, and handles unknown or malformed job ids', async () => {
    const s = await t.makeStudentWithProfile();
    assert.equal((await apply(job._id, admin.token)).status, 403);
    assert.equal((await apply(job._id, undefined)).status, 401);
    assert.equal((await apply('a'.repeat(24), s.token)).status, 404);
    assert.equal((await apply('not-an-id', s.token)).status, 400);
  });

  it('lets exactly one of several simultaneous applies through', async () => {
    const open = await t.makeJob(admin, { title: 'Burst Role' });
    const s = await t.makeStudentWithProfile();
    const results = await Promise.all(Array.from({ length: 6 }, () => apply(open._id, s.token)));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
    assert.equal(await t.models.Application.countDocuments({ student: s.user._id, job: open._id }), 1);
  });
});

describe('viewing applications', () => {
  let job;
  let alice;
  let bob;
  before(async () => {
    job = await t.makeJob(admin, { title: 'View Role' });
    alice = await t.makeStudentWithProfile({ rollNo: 'VIEW0001', cgpa: 8.5 }, 'Alice View', 'alice@view.test');
    bob = await t.makeStudentWithProfile({}, 'Bob View', 'bob@view.test');
    await apply(job._id, alice.token);
    await apply(job._id, bob.token);
  });

  it('shows students only their own applications, with the job populated', async () => {
    const res = await t.api('/applications/me', { token: alice.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].job.title, 'View Role');
    assert.equal(res.body.data[0].student, alice.user._id);
  });

  it('filters by status, validates the filter, and is student-only', async () => {
    const none = await t.api('/applications/me?status=selected', { token: alice.token });
    assert.equal(none.body.data.length, 0);
    assert.equal((await t.api('/applications/me?status=bogus', { token: alice.token })).status, 400);
    assert.equal((await t.api('/applications/me', { token: admin.token })).status, 403);
  });

  it('shows admins the applicants with their academics, and no password hashes', async () => {
    const res = await t.api(`/jobs/${job._id}/applications`, { token: admin.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 2);
    const row = res.body.data.find((a) => a.student.email === 'alice@view.test');
    assert.equal(row.profile.rollNo, 'VIEW0001');
    assert.equal(row.profile.cgpa, 8.5);
    assert.ok(!JSON.stringify(res.body).includes('$2'));
  });

  it('is admin-only and 404s for an unknown job', async () => {
    assert.equal((await t.api(`/jobs/${job._id}/applications`, { token: alice.token })).status, 403);
    assert.equal((await t.api(`/jobs/${'a'.repeat(24)}/applications`, { token: admin.token })).status, 404);
  });
});

describe('status pipeline', () => {
  let job;
  before(async () => {
    job = await t.makeJob(admin, { title: 'Pipeline Role' });
  });
  const fresh = async () => {
    const s = await t.makeStudentWithProfile();
    const a = (await apply(job._id, s.token)).body.application;
    return { s, a };
  };

  it('walks applied -> shortlisted -> interview -> selected, recording who, when and why', async () => {
    const { a } = await fresh();
    const r1 = await setStatus(a._id, { status: 'shortlisted', remark: '  Strong profile  ' });
    assert.equal(r1.status, 200);
    const h = r1.body.application.statusHistory;
    assert.equal(h.length, 2);
    assert.equal(h[1].changedBy, admin.user._id);
    assert.equal(h[1].remark, 'Strong profile');
    assert.ok(h[1].at);
    assert.equal((await setStatus(a._id, { status: 'interview' })).status, 200);
    const last = await setStatus(a._id, { status: 'selected' });
    assert.equal(last.body.application.statusHistory.length, 4);
  });

  it('refuses skipped steps and explains the allowed next ones', async () => {
    const { a } = await fresh();
    const res = await setStatus(a._id, { status: 'interview' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /shortlisted/);
    assert.equal((await setStatus(a._id, { status: 'selected' })).status, 409);
  });

  it('treats selected and rejected as final', async () => {
    const { a } = await fresh();
    assert.equal((await setStatus(a._id, { status: 'rejected' })).status, 200);
    const res = await setStatus(a._id, { status: 'shortlisted' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /no further/);
  });

  it('does not let admins set applied or withdrawn, or unknown statuses', async () => {
    const { a } = await fresh();
    for (const status of ['applied', 'withdrawn', 'nonsense']) {
      assert.equal((await setStatus(a._id, { status })).status, 400, status);
    }
  });

  it('validates the remark and the id, and 404s for unknown applications', async () => {
    const { a } = await fresh();
    assert.equal((await setStatus(a._id, { status: 'shortlisted', remark: 'x'.repeat(501) })).status, 400);
    assert.equal((await setStatus('bad-id', { status: 'shortlisted' })).status, 400);
    assert.equal((await setStatus('a'.repeat(24), { status: 'shortlisted' })).status, 404);
  });

  it('is admin-only', async () => {
    const { s, a } = await fresh();
    const res = await t.api(`/applications/${a._id}/status`, { method: 'PATCH', token: s.token, body: { status: 'shortlisted' } });
    assert.equal(res.status, 403);
  });
});

describe('withdrawing', () => {
  let job;
  before(async () => {
    job = await t.makeJob(admin, { title: 'Withdraw Role' });
  });
  const fresh = async () => {
    const s = await t.makeStudentWithProfile();
    const a = (await apply(job._id, s.token)).body.application;
    return { s, a };
  };

  it('withdraws an undecided application, keeping the record and logging it', async () => {
    const { s, a } = await fresh();
    const res = await withdraw(a._id, s.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.application.status, 'withdrawn');
    const h = res.body.application.statusHistory;
    assert.equal(h[h.length - 1].status, 'withdrawn');
    assert.equal(h[h.length - 1].changedBy, s.user._id);
    assert.equal(await t.models.Application.countDocuments({ _id: a._id }), 1);
  });

  it('cannot be done twice, after a decision, or on someone else\'s application', async () => {
    const { s, a } = await fresh();
    const other = await t.makeStudent();
    assert.equal((await withdraw(a._id, other.token)).status, 404, 'looks missing, not forbidden');
    assert.equal((await withdraw(a._id, admin.token)).status, 403);
    await withdraw(a._id, s.token);
    assert.equal((await withdraw(a._id, s.token)).status, 409);

    const decided = await fresh();
    await setStatus(decided.a._id, { status: 'rejected' });
    assert.equal((await withdraw(decided.a._id, decided.s.token)).status, 409);
  });

  it('blocks admin changes to a withdrawn application and any re-application', async () => {
    const { s, a } = await fresh();
    await withdraw(a._id, s.token);
    assert.equal((await setStatus(a._id, { status: 'shortlisted' })).status, 409);
    assert.equal((await apply(job._id, s.token)).status, 409);
  });
});

describe('concurrent withdraw and admin decision', () => {
  it('always leaves a consistent status and history', async () => {
    for (let i = 0; i < 6; i++) {
      const job = await t.makeJob(admin, { title: `Race ${i}` });
      const s = await t.makeStudentWithProfile();
      const a = (await apply(job._id, s.token)).body.application;

      const [w, d] = await Promise.all([withdraw(a._id, s.token), setStatus(a._id, { status: 'shortlisted' })]);
      assert.ok([200, 409].includes(w.status) && [200, 409].includes(d.status));

      const final = await t.models.Application.findById(a._id);
      const history = final.statusHistory.map((h) => h.status);
      assert.equal(history.at(-1), final.status, 'history ends at the stored status');
      const idx = history.indexOf('withdrawn');
      assert.ok(idx === -1 || idx === history.length - 1, 'nothing happens after a withdrawal');
      assert.equal(history.length, 1 + (w.status === 200 ? 1 : 0) + (d.status === 200 ? 1 : 0), 'each success left one entry');
    }
  });
});

describe('deleting jobs that have applications', () => {
  it('is refused, while a job without applications can still be deleted', async () => {
    const withApps = await t.makeJob(admin, { title: 'Guarded Role', deadline: future(5).toISOString() });
    const s = await t.makeStudentWithProfile();
    await apply(withApps._id, s.token);
    const res = await t.api(`/jobs/${withApps._id}`, { method: 'DELETE', token: admin.token });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Close it instead/);
    assert.ok(await t.models.Job.exists({ _id: withApps._id }));

    const empty = await t.makeJob(admin, { title: 'Empty Role' });
    assert.equal((await t.api(`/jobs/${empty._id}`, { method: 'DELETE', token: admin.token })).status, 200);
  });
});
