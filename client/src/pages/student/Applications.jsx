import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async, Pagination, StatusBadge, Timeline } from '../../components/ui'
import { ALL_STATUSES, WITHDRAWABLE } from '../../constants'
import { useAsync } from '../../hooks/useAsync'
import { cleanParams, formatDate } from '../../utils/format'

function ApplicationCard({ application, onChanged }) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const { job } = application

  const withdraw = async () => {
    if (!window.confirm(`Withdraw your application to ${job.title} at ${job.company}? This can’t be undone.`)) return
    setError(null)
    setBusy(true)
    try {
      await api.delete(`/applications/${application._id}`)
      onChanged()
    } catch (err) {
      setError(parseApiError(err))
      setBusy(false)
    }
  }

  return (
    <article className="card">
      <div className="job-head">
        <div>
          <h2>
            <Link to={`/student/jobs/${job._id}`}>{job.title}</Link>
          </h2>
          <p className="muted">
            {job.company} · applied {formatDate(application.createdAt)}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <FormError error={error} />
      <details>
        <summary>Progress</summary>
        <Timeline history={application.statusHistory} />
      </details>
      {WITHDRAWABLE.includes(application.status) && (
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={withdraw}>
          {busy ? 'Withdrawing…' : 'Withdraw'}
        </button>
      )}
    </article>
  )
}

export default function Applications() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const state = useAsync(
    () => api.get('/applications/me', { params: cleanParams({ status, page, limit: 10 }) }).then((r) => r.data),
    [status, page],
  )

  return (
    <>
      <h1>My applications</h1>
      <div className="filters">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Async state={state}>
        {(data) => (
          <>
            {data.data.length === 0 && (
              <p className="card muted">
                No applications here yet. <Link to="/student/jobs">Browse jobs</Link>
              </p>
            )}
            <div className="stack">
              {data.data.map((a) => (
                <ApplicationCard key={a._id} application={a} onChanged={state.reload} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </>
  )
}
