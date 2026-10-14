import { useAuth } from '../auth/useAuth'

// Placeholders: Phase 7 replaces these with the real student and admin screens.

export function StudentHome() {
  const { user } = useAuth()
  return (
    <section className="card">
      <h1>Hi, {user.name}</h1>
      <p className="muted">Student dashboard. Your profile, eligible jobs and applications will appear here.</p>
    </section>
  )
}

export function AdminHome() {
  const { user } = useAuth()
  return (
    <section className="card">
      <h1>Hi, {user.name}</h1>
      <p className="muted">Admin dashboard. Job management, applicants and the student directory will appear here.</p>
    </section>
  )
}
