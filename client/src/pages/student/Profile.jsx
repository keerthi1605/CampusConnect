import { useState } from 'react'
import api from '../../api/client'
import { parseApiError } from '../../api/errors'
import FormError from '../../components/FormError'
import { Async } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { useMeta } from '../../hooks/useMeta'

const toForm = (p) => ({
  rollNo: p?.rollNo ?? '',
  branch: p?.branch ?? '',
  cgpa: p?.cgpa ?? '',
  batchYear: p?.batchYear ?? '',
  backlogs: p?.backlogs ?? 0,
  phone: p?.phone ?? '',
  skills: (p?.skills ?? []).join(', '),
  resumeUrl: p?.resumeUrl ?? '',
})

function ProfileForm({ initial }) {
  const { branches } = useMeta()
  const [form, setForm] = useState(() => toForm(initial))
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const update = (e) => {
    setSaved(false)
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { data } = await api.put('/students/me', {
        rollNo: form.rollNo,
        branch: form.branch,
        cgpa: Number(form.cgpa),
        batchYear: Number(form.batchYear),
        backlogs: Number(form.backlogs || 0),
        phone: form.phone,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        resumeUrl: form.resumeUrl,
      })
      setForm(toForm(data.profile))
      setSaved(true)
    } catch (err) {
      setError(parseApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const ready = form.rollNo && form.branch && form.cgpa !== '' && form.batchYear !== ''

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      <FormError error={error} />
      {saved && (
        <div className="notice" role="status">
          Profile saved. Your eligibility on the jobs page is updated.
        </div>
      )}

      <div className="grid-2">
        <div>
          <label htmlFor="rollNo">Roll number *</label>
          <input id="rollNo" name="rollNo" value={form.rollNo} onChange={update} />
        </div>
        <div>
          <label htmlFor="branch">Branch *</label>
          <select id="branch" name="branch" value={form.branch} onChange={update}>
            <option value="">Select…</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cgpa">CGPA (0–10) *</label>
          <input id="cgpa" name="cgpa" type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={update} />
        </div>
        <div>
          <label htmlFor="batchYear">Batch (graduation year) *</label>
          <input id="batchYear" name="batchYear" type="number" min="2000" max="2100" value={form.batchYear} onChange={update} />
        </div>
        <div>
          <label htmlFor="backlogs">Current backlogs</label>
          <input id="backlogs" name="backlogs" type="number" min="0" value={form.backlogs} onChange={update} />
        </div>
        <div>
          <label htmlFor="phone">Phone (10 digits)</label>
          <input id="phone" name="phone" inputMode="numeric" value={form.phone} onChange={update} />
        </div>
      </div>

      <label htmlFor="skills">Skills (comma separated)</label>
      <input id="skills" name="skills" value={form.skills} onChange={update} placeholder="React, Node.js, SQL" />

      <label htmlFor="resumeUrl">Resume link</label>
      <input id="resumeUrl" name="resumeUrl" type="url" value={form.resumeUrl} onChange={update} placeholder="https://drive.google.com/…" />
      <p className="hint">Paste a shareable link (Drive, Dropbox…). Only http(s) links are accepted.</p>

      <button type="submit" className="btn btn-primary" disabled={saving || !ready}>
        {saving ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  )
}

export default function Profile() {
  const state = useAsync(() => api.get('/students/me').then((r) => r.data), [])
  return (
    <>
      <h1>My profile</h1>
      <p className="muted">These details decide which jobs you are eligible for.</p>
      <Async state={state}>{(data) => <ProfileForm initial={data.profile} />}</Async>
    </>
  )
}
