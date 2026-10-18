import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import { Async, Pagination, StatusBadge } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useMeta } from '../../hooks/useMeta'
import { cleanParams, formatCtc, formatDate } from '../../utils/format'

export function EligibilityTag({ job }) {
  return job.eligible ? (
    <span className="tag tag-ok">Eligible</span>
  ) : (
    <span className="tag tag-no">Not eligible</span>
  )
}

function JobCard({ job, applicationStatus }) {
  return (
    <article className="card job-card">
      <div className="job-head">
        <div>
          <h2>
            <Link to={`/student/jobs/${job._id}`}>{job.title}</Link>
          </h2>
          <p className="muted">{job.company}</p>
        </div>
        <div className="job-tags">
          {applicationStatus && <StatusBadge status={applicationStatus} />}
          <EligibilityTag job={job} />
        </div>
      </div>
      <p className="meta">
        <span>{job.type}</span>
        {job.location && <span>{job.location}</span>}
        <span>{formatCtc(job.ctc)}</span>
        <span>Apply by {formatDate(job.deadline)}</span>
      </p>
      {!job.eligible && job.reasons.length > 0 && (
        <ul className="reasons">
          {job.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

export default function Jobs() {
  const { jobTypes } = useMeta()
  const [draft, setDraft] = useState({ q: '', type: '', includeClosed: false })
  const [query, setQuery] = useState(draft)
  const [page, setPage] = useState(1)

  const jobs = useAsync(
    () =>
      api
        .get('/jobs', {
          params: cleanParams({
            q: query.q,
            type: query.type,
            status: query.includeClosed ? 'all' : 'open',
            page,
            limit: 10,
          }),
        })
        .then((r) => r.data),
    [query, page],
  )
  const mine = useAsync(() => api.get('/applications/me', { params: { limit: 100 } }).then((r) => r.data), [])

  // job id -> my application status, so cards can show "applied / shortlisted / …"
  const statusByJob = useMemo(
    () => Object.fromEntries((mine.data?.data ?? []).map((a) => [a.job?._id, a.status])),
    [mine.data],
  )

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQuery(draft)
  }

  return (
    <>
      <h1>Jobs</h1>
      <form className="filters" onSubmit={handleSearch}>
        <input
          aria-label="Search title or company"
          placeholder="Search title or company"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
        />
        <select aria-label="Job type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
          <option value="">All types</option>
          {jobTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="check">
          <input
            type="checkbox"
            checked={draft.includeClosed}
            onChange={(e) => setDraft({ ...draft, includeClosed: e.target.checked })}
          />
          Include closed / expired
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Search
        </button>
      </form>

      <Async state={jobs}>
        {(data) => (
          <>
            {data.data.length === 0 && <p className="card muted">No jobs match your search.</p>}
            <div className="stack">
              {data.data.map((job) => (
                <JobCard key={job._id} job={job} applicationStatus={statusByJob[job._id]} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </>
  )
}
