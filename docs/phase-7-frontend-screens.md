# Phase 7: Frontend Screens

**Goal:** both roles can complete their whole workflow in the browser: students fill in a profile, find jobs they qualify for, apply and track progress; admins post jobs, review applicants and move them through the pipeline.

## Screens and routes

**Student** (all under `/student`)

| Route | Screen |
|---|---|
| `/student` | Dashboard: prompt to complete the profile (or a summary of it), application counts by status |
| `/student/profile` | Profile form (roll number, branch, CGPA, batch, backlogs, phone, skills, resume link) |
| `/student/jobs` | Job list: search, type filter, "include closed / expired", pagination. Each card shows **Eligible / Not eligible** with the reasons, and the student's own application status if they applied |
| `/student/jobs/:id` | Job detail: description, who can apply, the student's own eligibility result, **Apply now** |
| `/student/applications` | My applications: status filter, progress timeline (with the admin's remarks), **Withdraw** |

**Admin** (all under `/admin`)

| Route | Screen |
|---|---|
| `/admin` | Dashboard: open jobs, total jobs, students with profiles, latest jobs |
| `/admin/jobs` | Job table: search, type and state filters; Applicants, Edit, Close/Reopen, Delete |
| `/admin/jobs/new`, `/admin/jobs/:id/edit` | Job form with the eligibility rules (min CGPA, branches, max backlogs, batch) |
| `/admin/jobs/:id/applicants` | Applicants table: academics, resume link, status, history, and a **status dropdown + remark** offering only the legal next steps |
| `/admin/students` | Student directory: search, branch, batch, CGPA range, backlog filters, sorting |

## Code structure added

```
client/src/
├── constants.js              status transition table (mirror of the server's)
├── hooks/useAsync.js         load-on-mount/deps hook: { data, error, loading, reload }
├── hooks/useMeta.js          branch and job-type lists from the API
├── utils/format.js           dates, CTC, job state, eligibility wording, param cleanup
├── components/ui.jsx         StatusBadge, Async (loading/error wrapper), Pagination, Timeline
└── pages/{student,admin}/    one file per screen (JobForm.jsx holds both create and edit)
```

## Key decisions

- **The server stays the authority.** The "Eligible" badge, the disabled Apply button, and the status dropdown (which only lists legal next steps, mirrored in `constants.js`) are conveniences. Every action is re-checked by the API, and its error messages are shown as they come.
- **Stale screens are handled.** If an admin clicks Update on a row whose student has just withdrawn, the API refuses; the page shows the server's explanation at the top and refreshes the row to the real state. (The first version refreshed the row and silently lost the message, which the browser test caught.)
- **Editing a job.** The form sends only what the API needs: a blank optional field is sent as `null` to clear it, and the **deadline is only sent if the admin changed it**. The API rejects past deadlines, so resending an unchanged deadline would make it impossible to edit any other field of an expired job.
- **Search runs on submit,** not on every keystroke, so typing doesn't fire a request per character. Changing a filter resets to page 1; late responses from superseded requests are ignored.
- **"Already applied" is looked up client-side.** The API has no "do I have an application for this job?" endpoint, so the job list and detail pages fetch the student's own applications (up to 100) and match by job id. That's fine at campus scale; a very large history would need a field on the job response.
- **All text is rendered as React text,** never as HTML, so job descriptions and remarks can't inject markup. Resume links are `http(s)` only (enforced by the API) and open with `rel="noopener noreferrer"`.
- **Destructive actions ask first** (delete a job, withdraw an application) with a native confirm dialog; a richer modal can come later.
- **Backend change made for this phase:** `PUT /api/jobs/:id` now accepts `null` to clear optional fields (see [Phase 4](phase-4-jobs-eligibility.md)). Before that, the edit form could never remove a backlog cap or CTC once set.

## How it was verified

The real app was exercised in the browser against a **temporary Atlas database** (dropped afterwards), with throwaway accounts.

**Student flow**
- A student with no profile: dashboard prompts for one; every job reads "Not eligible: complete your profile".
- Profile form: server errors listed per field (short roll number, bad phone); after saving, the roll number comes back uppercased and skills de-duplicated.
- Job list then reflects the real profile: Eligible for the two matching roles, Not eligible (with reason) for the ECE-only role; closed jobs hidden until "include closed" is ticked; search narrows the list.
- Detail page: Apply disabled with the reason for the ineligible job; Apply on an eligible job turns the button into the application status.
- My applications: timeline shows the admin's remark; Withdraw moves it to *withdrawn* and removes the button.

**Admin flow**
- Dashboard counts match the data; job form shows the server's "Deadline must be in the future" error, then creates the job.
- Edit form is prefilled, and clearing max backlogs, batch and location stores `null` while the CGPA rule, branches and CTC stay put.
- Delete is refused for a job with applications (with the API's message) and works for one without; Close and Reopen toggle the state.
- Applicants table: shortlisting with a remark updates the status, and the dropdown then offers only the next legal steps.
- Stale-row race (student withdraws, admin clicks Update on the old page): the refusal is shown and the row refreshes to *withdrawn / Final*.
- Student directory: CGPA filter and name search return the right rows.

**Layout:** all nine pages checked at 375px wide with no horizontal page scroll (wide tables scroll inside their own container). `npm run lint` and `npm run build` pass.

**Not covered:** there is no automated frontend test suite yet (Phase 8). Browser checks for the destructive actions used an auto-accepted `confirm()`, so the dialog wording itself was not exercised.

## Next

Phase 8: hardening and tests, with rate limiting on the auth routes, request-size limits and sanitisation, automated API tests (jest + supertest) that turn today's throwaway scripts into a permanent suite, nicer loading and error states, and a demo-data seed script.
