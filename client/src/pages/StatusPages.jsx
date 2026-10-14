import { Link } from 'react-router-dom'
import { homePathFor, useAuth } from '../auth/useAuth'

function homeLink(user) {
  return user ? { to: homePathFor(user.role), label: 'Go to your dashboard' } : { to: '/login', label: 'Go to sign in' }
}

export function NotFound() {
  const { user } = useAuth()
  const link = homeLink(user)
  return (
    <div className="auth-page">
      <section className="card auth-card center">
        <h1>Page not found</h1>
        <p className="muted">That address doesn’t exist.</p>
        <Link to={link.to}>{link.label}</Link>
      </section>
    </div>
  )
}

export function Forbidden() {
  const { user } = useAuth()
  const link = homeLink(user)
  return (
    <div className="auth-page">
      <section className="card auth-card center">
        <h1>Not allowed</h1>
        <p className="muted">Your account doesn’t have access to that page.</p>
        <Link to={link.to}>{link.label}</Link>
      </section>
    </div>
  )
}
