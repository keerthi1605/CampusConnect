import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async, StatusBadge } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { describeEligibility, formatCtc, formatDate, jobState } from '../../utils/format'
import { EligibilityTag } from './Jobs'

function JobBody({ job, application, onApplied }) {
  const [error, setError] = useState(null)
  const [applying, setApplying] = useState(false)
  const state = jobState(job)

  const apply = async () => {
    setError(null)
    setApplying(true)
    try {
      await api.post(`/jobs/${job._id}/apply`)
      onApplied()
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setApplying(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="job-head">
          <div>
            <h1>{job.title}</h1>
            <p className="muted">{job.company}</p>
          </div>
          <div className="job-tags">
            {state !== 'open' && <span className="tag tag-no">{state}</span>}
            <EligibilityTag job={job} />
          </div>
        </div>
        <p className="meta">
          <span>{job.type}</span>
          {job.location && <span>{job.location}</span>}
          <span>{formatCtc(job.ctc)}</span>
          <span>Apply by {formatDate(job.deadline)}</span>
        </p>
        <h2>About the role</h2>
        <p className="prewrap">{job.description}</p>
        <h2>Who can apply</h2>
        <ul>
          {describeEligibility(job.eligibility).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        {application ? (
          <p>
            You applied to this job. Status: <StatusBadge status={application.status} /> ·{' '}
            <Link to="/student/applications">See your applications</Link>
          </p>
        ) : (
          <>
            {!job.eligible && (
              <>
                <p>
                  <strong>You can’t apply to this job:</strong>
                </p>
                <ul className="reasons">
                  {job.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {job.reasons.some((r) => /profile/i.test(r)) && <Link to="/student/profile">Complete your profile</Link>}
              </>
            )}
            <FormError error={error} />
            <button type="button" className="btn btn-primary" disabled={!job.eligible || applying} onClick={apply}>
              {applying ? 'Applying…' : 'Apply now'}
            </button>
          </>
        )}
      </div>
    </>
  )
}

export default function JobDetail() {
  const { id } = useParams()
  const job = useAsync(() => api.get(`/jobs/${id}`).then((r) => r.data.job), [id])
  const mine = useAsync(() => api.get('/applications/me', { params: { limit: 100 } }).then((r) => r.data), [])

  const reload = () => {
    job.reload()
    mine.reload()
  }

  return (
    <>
      <p>
        <Link to="/student/jobs">← All jobs</Link>
      </p>
      <Async state={job}>
        {(j) => (
          <JobBody
            job={j}
            application={mine.data?.data.find((a) => a.job?._id === j._id)}
            onApplied={reload}
          />
        )}
      </Async>
    </>
  )
}
