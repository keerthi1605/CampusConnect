import { Link } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { Async, StatusBadge } from '../../components/ui'
import { ALL_STATUSES } from '../../constants'
import { useAsync } from '../../hooks/useAsync'

export default function StudentDashboard() {
  const { user } = useAuth()
  const state = useAsync(
    () =>
      Promise.all([api.get('/students/me'), api.get('/applications/me', { params: { limit: 100 } })]).then(
        ([p, a]) => ({ profile: p.data.profile, applications: a.data.data, total: a.data.pagination.total }),
      ),
    [],
  )

  return (
    <>
      <h1>Hi, {user.name}</h1>
      <Async state={state}>
        {({ profile, applications, total }) => {
          const counts = Object.fromEntries(ALL_STATUSES.map((s) => [s, applications.filter((a) => a.status === s).length]))
          return (
            <div className="stack">
              {profile ? (
                <section className="card">
                  <h2>Your profile</h2>
                  <p className="muted">
                    {profile.rollNo} · {profile.branch} · CGPA {profile.cgpa} · batch {profile.batchYear}
                  </p>
                  <Link to="/student/profile">Edit profile</Link>
                </section>
              ) : (
                <section className="card notice-card">
                  <h2>Complete your profile</h2>
                  <p>Add your roll number, branch and CGPA so we can show which jobs you are eligible for.</p>
                  <Link to="/student/profile" className="btn btn-primary">
                    Complete profile
                  </Link>
                </section>
              )}

              <section className="card">
                <h2>Applications ({total})</h2>
                {total === 0 ? (
                  <p className="muted">
                    You haven’t applied anywhere yet. <Link to="/student/jobs">Browse jobs</Link>
                  </p>
                ) : (
                  <div className="counts">
                    {ALL_STATUSES.filter((s) => counts[s] > 0).map((s) => (
                      <span key={s}>
                        <StatusBadge status={s} /> {counts[s]}
                      </span>
                    ))}
                  </div>
                )}
                <Link to="/student/applications">View all</Link>
              </section>
            </div>
          )
        }}
      </Async>
    </>
  )
}
