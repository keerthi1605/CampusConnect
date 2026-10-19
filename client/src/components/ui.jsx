import FormError from './FormError'

export function StatusBadge({ status }) {
  return <span className={`status status-${status}`}>{status}</span>
}

/** Renders `children(data)` once loaded; shows loading and error states around it. */
export function Async({ state, children }) {
  if (state.error) {
    return (
      <>
        <FormError error={state.error} />
        <button type="button" className="btn btn-ghost btn-sm retry" onClick={state.reload}>
          Try again
        </button>
      </>
    )
  }
  if (!state.data) return <p className="muted">Loading…</p>
  return children(state.data)
}

export function Pagination({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null
  const { page, pages, total } = pagination
  return (
    <div className="pagination">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {page} of {pages} · {total} total
      </span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  )
}

export function Timeline({ history }) {
  return (
    <ol className="timeline">
      {history.map((h, i) => (
        <li key={i}>
          <StatusBadge status={h.status} />
          <span className="muted">
            {new Date(h.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          {h.remark && <span className="remark">“{h.remark}”</span>}
        </li>
      ))}
    </ol>
  )
}
