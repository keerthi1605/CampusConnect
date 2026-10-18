import api from '../api/client'
import { useAsync } from './useAsync'

/** Branch and job-type lists come from the API so dropdowns always match what it validates. */
export function useMeta() {
  const { data } = useAsync(
    () =>
      Promise.all([api.get('/meta/branches'), api.get('/meta/job-types')]).then(([b, t]) => ({
        branches: b.data.branches,
        jobTypes: t.data.jobTypes,
      })),
    [],
  )
  return data ?? { branches: [], jobTypes: [] }
}
