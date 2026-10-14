import { useState } from 'react'
import { Link } from 'react-router-dom'
import { parseApiError } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import FormError from '../components/FormError'

export default function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(form.email, form.password)
      // GuestRoute notices the new user and redirects
    } catch (err) {
      setError(parseApiError(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to CampusConnect</p>
        <FormError error={error} />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update}
        />

        <button type="submit" className="btn btn-primary" disabled={submitting || !form.email || !form.password}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted center">
          New student? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  )
}
