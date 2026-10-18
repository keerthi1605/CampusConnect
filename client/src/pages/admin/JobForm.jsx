import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useMeta } from '../../hooks/useMeta'
import { toLocalInput } from '../../utils/format'

const toForm = (job) => ({
  title: job?.title ?? '',
  company: job?.company ?? '',
  description: job?.description ?? '',
  location: job?.location ?? '',
  type: job?.type ?? 'full-time',
  ctc: job?.ctc ?? '',
  deadline: toLocalInput(job?.deadline),
  status: job?.status ?? 'open',
  minCgpa: job?.eligibility?.minCgpa ?? 0,
  branches: job?.eligibility?.branches ?? [],
  maxBacklogs: job?.eligibility?.maxBacklogs ?? '',
  batchYear: job?.eligibility?.batchYear ?? '',
})

const num = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v))

function JobForm({ job }) {
  const navigate = useNavigate()
  const { branches, jobTypes } = useMeta()
  const editing = Boolean(job)
  const [form, setForm] = useState(() => toForm(job))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  const toggleBranch = (b) =>
    setForm((f) => ({
      ...f,
      branches: f.branches.includes(b) ? f.branches.filter((x) => x !== b) : [...f.branches, b],
    }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    // Creating: blank optional fields are simply left out. Editing: blank means "clear it",
    // which the API expects as null (leaving a field out means "keep what is there").
    const blank = editing ? null : undefined
    const body = {
      title: form.title,
      company: form.company,
      description: form.description,
      location: form.location.trim() === '' ? blank : form.location,
      type: form.type,
      ctc: num(form.ctc) ?? blank,
      eligibility: {
        minCgpa: Number(form.minCgpa || 0),
        branches: form.branches,
        maxBacklogs: num(form.maxBacklogs) ?? blank,
        batchYear: num(form.batchYear) ?? blank,
      },
    }
    // The API insists a deadline is in the future, so don't resend an unchanged (maybe
    // already passed) one when editing other fields of an old job
    if (!editing || form.deadline !== toLocalInput(job.deadline)) {
      body.deadline = form.deadline ? new Date(form.deadline).toISOString() : ''
    }
    if (editing) body.status = form.status

    try {
      if (editing) await api.put(`/jobs/${job._id}`, body)
      else await api.post('/jobs', body)
      navigate('/admin/jobs')
    } catch (err) {
      setError(parseApiError(err))
      setSaving(false)
    }
  }

  const ready = form.title && form.company && form.description && form.deadline

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <FormError error={error} />

      <div className="grid-2">
        <div>
          <label htmlFor="title">Job title *</label>
          <input id="title" name="title" value={form.title} onChange={update} />
        </div>
        <div>
          <label htmlFor="company">Company *</label>
          <input id="company" name="company" value={form.company} onChange={update} />
        </div>
        <div>
          <label htmlFor="type">Type *</label>
          <select id="type" name="type" value={form.type} onChange={update}>
            {(jobTypes.length ? jobTypes : [form.type]).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="location">Location</label>
          <input id="location" name="location" value={form.location} onChange={update} />
        </div>
        <div>
          <label htmlFor="ctc">CTC / stipend (LPA)</label>
          <input id="ctc" name="ctc" type="number" min="0" step="0.1" value={form.ctc} onChange={update} />
        </div>
        <div>
          <label htmlFor="deadline">Application deadline *</label>
          <input id="deadline" name="deadline" type="datetime-local" value={form.deadline} onChange={update} />
        </div>
      </div>

      <label htmlFor="description">Description *</label>
      <textarea id="description" name="description" value={form.description} onChange={update} />

      <h2 className="section-title">Eligibility</h2>
      <div className="grid-2">
        <div>
          <label htmlFor="minCgpa">Minimum CGPA</label>
          <input id="minCgpa" name="minCgpa" type="number" min="0" max="10" step="0.01" value={form.minCgpa} onChange={update} />
        </div>
        <div>
          <label htmlFor="maxBacklogs">Max backlogs</label>
          <input id="maxBacklogs" name="maxBacklogs" type="number" min="0" value={form.maxBacklogs} onChange={update} />
          <p className="hint">Leave empty for no limit.</p>
        </div>
        <div>
          <label htmlFor="batchYear">Batch (graduation year)</label>
          <input id="batchYear" name="batchYear" type="number" min="2000" max="2100" value={form.batchYear} onChange={update} />
          <p className="hint">Leave empty for any batch.</p>
        </div>
        {editing && (
          <div>
            <label htmlFor="status">Status</label>
            <select id="status" name="status" value={form.status} onChange={update}>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </div>
        )}
      </div>

      <label>Allowed branches</label>
      <div className="checks">
        {branches.map((b) => (
          <label key={b} className="check">
            <input type="checkbox" checked={form.branches.includes(b)} onChange={() => toggleBranch(b)} />
            {b}
          </label>
        ))}
      </div>
      <p className="hint">Select none to open the job to every branch.</p>

      <div className="row-actions form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !ready}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Post job'}
        </button>
        <Link to="/admin/jobs" className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  )
}

export function JobNew() {
  return (
    <>
      <h1>Post a job</h1>
      <JobForm />
    </>
  )
}

export function JobEdit() {
  const { id } = useParams()
  const state = useAsync(() => api.get(`/jobs/${id}`).then((r) => r.data.job), [id])
  return (
    <>
      <h1>Edit job</h1>
      <Async state={state}>{(job) => <JobForm key={job._id} job={job} />}</Async>
    </>
  )
}
