import { useState } from 'react'
import { Link } from 'react-router-dom'
import { parseApiError } from '../api/errors'
import { useAuth } from '../auth/useAuth'
import FormError from '../components/FormError'

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(form)
    } catch (err) {
      setError(parseApiError(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>Create your account</h1>
        <p className="muted">Student registration. Placement admins are added by the placement cell.</p>
        <FormError error={error} />

        <label htmlFor="name">Full name</label>
        <input id="name" name="name" autoComplete="name" required value={form.name} onChange={update} />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={form.email} onChange={update} />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={update}
        />
        <p className="hint">At least 8 characters, with a letter and a number.</p>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || !form.name || !form.email || !form.password}
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted center">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
