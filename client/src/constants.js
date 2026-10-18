// Mirrors server/src/constants/applicationStatus.js. The server is the authority and rejects
// illegal moves; this copy only decides which choices to offer.
export const NEXT_STATUSES = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['interview', 'rejected'],
  interview: ['selected', 'rejected'],
}

export const WITHDRAWABLE = ['applied', 'shortlisted', 'interview']

export const ALL_STATUSES = ['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'withdrawn']
