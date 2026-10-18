export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export const formatCtc = (ctc) => (typeof ctc === 'number' ? `${ctc} LPA` : '—')

/** Open in the database but past its deadline counts as expired. */
export const jobState = (job) => {
  if (job.status === 'closed') return 'closed'
  return new Date(job.deadline).getTime() < Date.now() ? 'expired' : 'open'
}

// <input type="datetime-local"> works in local time without a zone suffix
export const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Drops empty values so they aren't sent as params. */
export const cleanParams = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined))

/** Human-readable list of a job's eligibility rules, e.g. ['CGPA 7 or above', 'CSE, IT only']. */
export const describeEligibility = (e = {}) => {
  const rules = []
  if (typeof e.minCgpa === 'number' && e.minCgpa > 0) rules.push(`CGPA ${e.minCgpa} or above`)
  rules.push(e.branches?.length ? `${e.branches.join(', ')} only` : 'All branches')
  if (typeof e.maxBacklogs === 'number') rules.push(`At most ${e.maxBacklogs} backlog${e.maxBacklogs === 1 ? '' : 's'}`)
  if (typeof e.batchYear === 'number') rules.push(`${e.batchYear} batch only`)
  return rules
}
