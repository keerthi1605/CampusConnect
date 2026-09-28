/**
 * Pure function: given a plain student-profile object and a plain job object,
 * returns { eligible, reasons[] }. No DB access, so it is unit-testable in isolation
 * and reusable wherever eligibility needs checking (job list, apply endpoint in Phase 5).
 */
export function checkEligibility(profile, job) {
  if (!profile) {
    return { eligible: false, reasons: ['Complete your profile to check eligibility'] };
  }

  const reasons = [];
  const rules = job.eligibility || {};

  if (job.status !== 'open') reasons.push('This job is closed');
  if (job.deadline && new Date(job.deadline).getTime() < Date.now()) {
    reasons.push('Application deadline has passed');
  }
  if (typeof rules.minCgpa === 'number' && profile.cgpa < rules.minCgpa) {
    reasons.push(`Requires CGPA of at least ${rules.minCgpa} (yours: ${profile.cgpa})`);
  }
  if (rules.branches?.length && !rules.branches.includes(profile.branch)) {
    reasons.push(`Open to ${rules.branches.join(', ')} only`);
  }
  if (typeof rules.maxBacklogs === 'number' && profile.backlogs > rules.maxBacklogs) {
    reasons.push(`Allows at most ${rules.maxBacklogs} backlog(s) (yours: ${profile.backlogs})`);
  }
  if (typeof rules.batchYear === 'number' && profile.batchYear !== rules.batchYear) {
    reasons.push(`Open to the ${rules.batchYear} batch only`);
  }

  return { eligible: reasons.length === 0, reasons };
}
