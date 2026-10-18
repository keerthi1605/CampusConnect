import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async, Pagination, StatusBadge, Timeline } from '../../components/ui'
import { ALL_STATUSES, NEXT_STATUSES } from '../../constants'
import { useAsync } from '../../hooks/useAsync'
import { cleanParams, formatDate } from '../../utils/format'

function StatusUpdater({ application, onChanged, onError }) {
  const options = NEXT_STATUSES[application.status] ?? []
  const [status, setStatus] = useState(options[0] ?? '')
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)

  if (options.length === 0) return <span className="muted">Final</span>

  const submit = async (e) => {
    e.preventDefault()
    onError(null)
    setBusy(true)
    try {
      await api.patch(`/applications/${application._id}/status`, { status, remark })
      onChanged()
    } catch (err) {
      // e.g. the student withdrew a moment ago. The refresh below remounts this row, so the
      // explanation is shown by the page rather than here
      onError(parseApiError(err))
      setBusy(false)
      onChanged()
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <select aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value)}>
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        aria-label="Remark (optional)"
        placeholder="Remark (optional)"
        maxLength={500}
        value={remark}
        onChange={(e) => setRemark(e.target.value)}
      />
      <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? 'Saving…' : 'Update'}
      </button>
    </form>
  )
}

export default function Applicants() {
  const { id } = useParams()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState(null)

  const job = useAsync(() => api.get(`/jobs/${id}`).then((r) => r.data.job), [id])
  const state = useAsync(
    () => api.get(`/jobs/${id}/applications`, { params: cleanParams({ status, page, limit: 20 }) }).then((r) => r.data),
    [id, status, page],
  )

  return (
    <>
      <p>
        <Link to="/admin/jobs">← All jobs</Link>
      </p>
      <h1>Applicants</h1>
      {job.data && (
        <p className="muted">
          {job.data.title} · {job.data.company}
        </p>
      )}

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

      <FormError error={actionError} />

      <Async state={state}>
        {(data) => (
          <>
            {data.data.length === 0 ? (
              <p className="card muted">No applicants{status ? ` with status “${status}”` : ' yet'}.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Academics</th>
                      <th>Applied</th>
                      <th>Status</th>
                      <th>Change status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((a) => (
                      <tr key={a._id}>
                        <td>
                          {a.student.name}
                          <div className="muted">{a.student.email}</div>
                        </td>
                        <td>
                          {a.profile.rollNo} · {a.profile.branch}
                          <div className="muted">
                            CGPA {a.profile.cgpa} · {a.profile.backlogs} backlog{a.profile.backlogs === 1 ? '' : 's'} · batch{' '}
                            {a.profile.batchYear}
                          </div>
                          {a.profile.skills?.length > 0 && <div className="muted">{a.profile.skills.join(', ')}</div>}
                          {a.profile.resumeUrl && (
                            <a href={a.profile.resumeUrl} target="_blank" rel="noopener noreferrer">
                              Resume
                            </a>
                          )}
                        </td>
                        <td>{formatDate(a.createdAt)}</td>
                        <td>
                          <StatusBadge status={a.status} />
                          <details>
                            <summary>History</summary>
                            <Timeline history={a.statusHistory} />
                          </details>
                        </td>
                        <td>
                          <StatusUpdater
                            key={`${a._id}-${a.status}`}
                            application={a}
                            onChanged={state.reload}
                            onError={setActionError}
                          />
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
