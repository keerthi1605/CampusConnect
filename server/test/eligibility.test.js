import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkEligibility } from '../src/utils/eligibility.js';
import { future, past } from './helpers.js';

const profile = { cgpa: 8, branch: 'CSE', backlogs: 0, batchYear: 2026 };
const openJob = (over = {}) => ({ status: 'open', deadline: future(5), eligibility: {}, ...over });

describe('checkEligibility (pure function)', () => {
  it('rejects a student with no profile with a single reason', () => {
    const r = checkEligibility(null, openJob());
    assert.equal(r.eligible, false);
    assert.equal(r.reasons.length, 1);
  });

  it('accepts an open job with no rules and a future deadline', () => {
    assert.deepEqual(checkEligibility(profile, openJob()), { eligible: true, reasons: [] });
  });

  it('rejects a closed job', () => {
    const r = checkEligibility(profile, openJob({ status: 'closed' }));
    assert.equal(r.eligible, false);
    assert.match(r.reasons[0], /closed/);
  });

  it('rejects a job past its deadline', () => {
    const r = checkEligibility(profile, openJob({ deadline: past(1) }));
    assert.equal(r.eligible, false);
    assert.match(r.reasons[0], /deadline/i);
  });

  it('reports both reasons when a job is closed and expired', () => {
    assert.equal(checkEligibility(profile, openJob({ status: 'closed', deadline: past(1) })).reasons.length, 2);
  });

  it('checks CGPA, inclusive at the boundary', () => {
    assert.equal(checkEligibility(profile, openJob({ eligibility: { minCgpa: 9 } })).eligible, false);
    assert.equal(checkEligibility(profile, openJob({ eligibility: { minCgpa: 8 } })).eligible, true);
  });

  it('checks the allowed branches; an empty list means every branch', () => {
    assert.equal(checkEligibility(profile, openJob({ eligibility: { branches: ['ECE', 'EEE'] } })).eligible, false);
    assert.equal(checkEligibility(profile, openJob({ eligibility: { branches: ['CSE', 'IT'] } })).eligible, true);
    assert.equal(checkEligibility(profile, openJob({ eligibility: { branches: [] } })).eligible, true);
  });

  it('checks the backlog cap, inclusive at the boundary', () => {
    const job = openJob({ eligibility: { maxBacklogs: 1 } });
    assert.equal(checkEligibility({ ...profile, backlogs: 2 }, job).eligible, false);
    assert.equal(checkEligibility({ ...profile, backlogs: 1 }, job).eligible, true);
  });

  it('checks the batch year', () => {
    assert.equal(checkEligibility(profile, openJob({ eligibility: { batchYear: 2025 } })).eligible, false);
    assert.equal(checkEligibility(profile, openJob({ eligibility: { batchYear: 2026 } })).eligible, true);
  });

  it('treats null (a cleared rule) as "no restriction"', () => {
    const job = openJob({ eligibility: { minCgpa: 0, maxBacklogs: null, batchYear: null } });
    assert.equal(checkEligibility({ ...profile, backlogs: 9, batchYear: 1999 }, job).eligible, true);
  });

  it('reports every failing rule at once', () => {
    const r = checkEligibility(profile, {
      status: 'closed',
      deadline: past(1),
      eligibility: { minCgpa: 9, branches: ['ECE'], maxBacklogs: -1, batchYear: 2025 },
    });
    assert.equal(r.eligible, false);
    assert.equal(r.reasons.length, 6);
  });
});
