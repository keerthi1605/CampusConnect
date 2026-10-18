import { useState } from 'react'
import api from '../../api/client'
import { Async, Pagination } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useMeta } from '../../hooks/useMeta'
import { cleanParams } from '../../utils/format'

const EMPTY = { q: '', branch: '', batchYear: '', minCgpa: '', maxCgpa: '', maxBacklogs: '', sort: '-createdAt' }

export default function Students() {
  const { branches } = useMeta()
  const [draft, setDraft] = useState(EMPTY)
  const [query, setQuery] = useState(EMPTY)
  const [page, setPage] = useState(1)

  const state = useAsync(
    () => api.get('/students', { params: cleanParams({ ...query, page, limit: 20 }) }).then((r) => r.data),
    [query, page],
  )

  const set = (name) => (e) => setDraft({ ...draft, [name]: e.target.value })

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setQuery(draft)
  }

  const reset = () => {
    setDraft(EMPTY)
    setQuery(EMPTY)
    setPage(1)
  }

  return (
    <>
      <h1>Students</h1>
      <form className="filters" onSubmit={handleSearch}>
        <input aria-label="Search name, email or roll number" placeholder="Name, email or roll no." value={draft.q} onChange={set('q')} />
        <select aria-label="Branch" value={draft.branch} onChange={set('branch')}>
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input className="narrow" aria-label="Batch year" type="number" placeholder="Batch" value={draft.batchYear} onChange={set('batchYear')} />
        <input className="narrow" aria-label="Minimum CGPA" type="number" step="0.01" min="0" max="10" placeholder="Min CGPA" value={draft.minCgpa} onChange={set('minCgpa')} />
        <input className="narrow" aria-label="Maximum CGPA" type="number" step="0.01" min="0" max="10" placeholder="Max CGPA" value={draft.maxCgpa} onChange={set('maxCgpa')} />
        <input className="narrow" aria-label="Maximum backlogs" type="number" min="0" placeholder="Max backlogs" value={draft.maxBacklogs} onChange={set('maxBacklogs')} />
        <select aria-label="Sort" value={draft.sort} onChange={set('sort')}>
          <option value="-createdAt">Newest first</option>
          <option value="-cgpa">CGPA high to low</option>
          <option value="cgpa">CGPA low to high</option>
          <option value="rollNo">Roll number</option>
        </select>
        <button type="submit" className="btn btn-primary btn-sm">
          Search
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
          Reset
        </button>
      </form>

      <Async state={state}>
        {(data) => (
          <>
            {data.data.length === 0 ? (
              <p className="card muted">No students match. Students appear here once they save their profile.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll no.</th>
                      <th>Branch</th>
                      <th>Batch</th>
                      <th>CGPA</th>
                      <th>Backlogs</th>
                      <th>Skills</th>
                      <th>Resume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((s) => (
                      <tr key={s._id}>
                        <td>
                          {s.user.name}
                          <div className="muted">{s.user.email}</div>
                        </td>
                        <td>{s.rollNo}</td>
                        <td>{s.branch}</td>
                        <td>{s.batchYear}</td>
                        <td>{s.cgpa}</td>
                        <td>{s.backlogs}</td>
                        <td>{s.skills?.join(', ') || '—'}</td>
                        <td>
                          {s.resumeUrl ? (
                            <a href={s.resumeUrl} target="_blank" rel="noopener noreferrer">
                              Open
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )}
      </Async>
    </>
  )
}
