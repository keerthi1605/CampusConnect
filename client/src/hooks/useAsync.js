import { useCallback, useEffect, useState } from 'react'
import { parseApiError } from '../api/errors'

/**
 * Runs `fn` (which returns a promise) on mount and whenever `deps` change.
 * Returns { data, error, loading, reload }. A response that arrives after the inputs
 * changed or the component unmounted is ignored, so stale results never overwrite newer ones.
 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (err) => !cancelled && setState({ data: null, error: parseApiError(err), loading: false }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
