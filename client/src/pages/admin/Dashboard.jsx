import { Link } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Async, StatusBadge } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { formatDate, jobState } from '../../utils/format'

const get = (url, params) => api.get(url, { params }).then((r) => r.data)

export default function AdminDashboard() {
  const { user } = useAuth()
  const state = useAsync(
    () =>
      Promise.all([
        get('/jobs', { status: 'open', limit: 1 }),
        get('/jobs', { status: 'all', sort: '-createdAt', limit: 5 }),
        get('/students', { limit: 1 }),
      ]).then(([open, all, students]) => ({
        openJobs: open.pagination.total,
        totalJobs: all.pagination.total,
        recent: all.data,
        students: students.pagination.total,
      })),
    [],
  )

  return (
    <>
      <div className="page-head">
        <h1>Hi, {user.name}</h1>
        <Link to="/admin/jobs/new" className="btn btn-primary btn-sm">
          Post a job
        </Link>
      </div>
      <Async state={state}>
        {({ openJobs, totalJobs, recent, students }) => (
          <div className="stack">
            <div className="stat-row">
              <div className="card">
                <div className="stat">{openJobs}</div>
                <p className="muted">Open jobs</p>
              </div>
              <div className="card">
                <div className="stat">{totalJobs}</div>
                <p className="muted">Total jobs</p>
              </div>
              <div className="card">
                <div className="stat">{students}</div>
                <p className="muted">
                  <Link to="/admin/students">Students with profiles</Link>
                </p>
              </div>
            </div>

            <section>
              <h2>Latest jobs</h2>
              {recent.length === 0 ? (
                <p className="card muted">No jobs yet. Post the first one.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Job</th>
                        <th>Deadline</th>
                        <th>State</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((j) => (
                        <tr key={j._id}>
                          <td>
                            {j.title}
                            <div className="muted">{j.company}</div>
                          </td>
                          <td>{formatDate(j.deadline)}</td>
                          <td>
                            <StatusBadge status={jobState(j)} />
                          </td>
                          <td>
                            <Link to={`/admin/jobs/${j._id}/applicants`}>Applicants</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </Async>
    </>
  )
}
