export const APPLICATION_STATUS = Object.freeze({
  APPLIED: 'applied',
  SHORTLISTED: 'shortlisted',
  INTERVIEW: 'interview',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
});

const S = APPLICATION_STATUS;

// What an admin may move an application to, keyed by its current status.
// selected / rejected / withdrawn are terminal.
export const ADMIN_TRANSITIONS = Object.freeze({
  [S.APPLIED]: [S.SHORTLISTED, S.REJECTED],
  [S.SHORTLISTED]: [S.INTERVIEW, S.REJECTED],
  [S.INTERVIEW]: [S.SELECTED, S.REJECTED],
});

// A student may withdraw only before a decision has been made
export const WITHDRAWABLE = Object.freeze([S.APPLIED, S.SHORTLISTED, S.INTERVIEW]);

// Statuses an admin can set (applied is the starting state, withdrawn is student-only)
export const ADMIN_SETTABLE = Object.freeze([S.SHORTLISTED, S.INTERVIEW, S.SELECTED, S.REJECTED]);
