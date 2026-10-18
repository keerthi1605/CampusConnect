import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async, Pagination, StatusBadge } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useMeta } from '../../hooks/useMeta'
import { cleanParams, formatCtc, formatDate, jobState } from '../../utils/format'

export default function AdminJobs() {
  const { jobTypes } = useMeta()
  const [draft, setDraft] = useState({ q: '', type: '', status: 'all' })
  const [query, setQuery] = useState(draft)
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState(null)

  const state = useAsync(
    () => api.get('/jobs', { params: cleanParams({ ...query, page, limit: 10 }) }).then((r) => r.data),
    [query, page],
  )

  const run = async (request) => {
    setActionError(null)
    try {
      await request()
      state.reload()
    } catch (err) {
      setActionError(parseApiError(err))
    }
  }

  const toggleStatus = (job) =>
    run(() => api.put(`/jobs/${job._id}`, { status: job.status === 'open' ? 'closed' : 'open' }))

  const remove = (job) => {
    if (!window.confirm(`Delete “${job.title}” at ${job.company}? This can’t be undone.`)) return
    run(() => api.delete(`/jobs/${job._id}`))
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQuery(draft)
  }

  return (
    <>
      <div className="page-head">
        <h1>Jobs</h1>
        <Link to="/admin/jobs/new" className="btn btn-primary btn-sm">
          Post a job
        </Link>
      </div>

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
        <select aria-label="State" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="all">Open, closed and expired</option>
          <option value="open">Open only</option>
          <option value="closed">Closed / expired only</option>
        </select>
        <button type="submit" className="btn btn-primary btn-sm">
          Search
        </button>
      </form>

      <FormError error={actionError} />

      <Async state={state}>
        {(data) => (
          <>
            {data.data.length === 0 ? (
              <p className="card muted">No jobs match.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Type</th>
                      <th>CTC</th>
                      <th>Deadline</th>
                      <th>State</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((job) => (
                      <tr key={job._id}>
                        <td>
                          {job.title}
                          <div className="muted">{job.company}</div>
                        </td>
                        <td>{job.type}</td>
                        <td>{formatCtc(job.ctc)}</td>
                        <td>{formatDate(job.deadline)}</td>
                        <td>
                          <StatusBadge status={jobState(job)} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <Link to={`/admin/jobs/${job._id}/applicants`} className="btn btn-ghost btn-sm">
                              Applicants
                            </Link>
                            <Link to={`/admin/jobs/${job._id}/edit`} className="btn btn-ghost btn-sm">
                              Edit
                            </Link>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleStatus(job)}>
                              {job.status === 'open' ? 'Close' : 'Reopen'}
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(job)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </>
  )
}
