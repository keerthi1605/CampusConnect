import { Component } from 'react'

/** Last line of defence: a crash while rendering shows a message instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="auth-page">
        <section className="card auth-card center" role="alert">
          <h1>Something went wrong</h1>
          <p className="muted">The page hit an unexpected error. Your data is safe.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.assign('/')}>
            Back to the start
          </button>
        </section>
      </div>
    )
  }
}
