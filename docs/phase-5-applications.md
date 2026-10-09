# Phase 5: Applications & Status Tracking

**Goal:** students apply to jobs they qualify for and can withdraw; admins review applicants and move each application through a hiring pipeline, with a full audit trail.

## What was built

| File | Purpose |
|---|---|
| `models/Application.js` | Application schema with an embedded `statusHistory` log and the unique `{student, job}` index |
| `constants/applicationStatus.js` | Status names and the allowed-transition table |
| `controllers/application.controller.js` | Apply, list mine, withdraw, list applicants, update status |
| `routes/application.routes.js` | `/api/applications/*` |
| `routes/job.routes.js` | Adds `POST /jobs/:id/apply` and `GET /jobs/:id/applications` |
| `validators/application.validators.js` | List-query and status-update schemas |
| `controllers/job.controller.js` | `deleteJob` now refuses jobs that have applications |

## Data model: `Application`

| Field | Notes |
|---|---|
| `student` | ref to `User` |
| `job` | ref to `Job` |
| `profile` | ref to the student's `StudentProfile`, so admins see roll number, branch and CGPA without a second lookup |
| `status` | `applied` (default), `shortlisted`, `interview`, `selected`, `rejected`, `withdrawn` |
| `statusHistory[]` | `{ status, changedBy, at, remark? }`, appended on every change; the first entry is `applied` |

Indexes: **unique `{student, job}`**, `{job, status, createdAt}` for applicant lists, `{student, createdAt}` for "my applications".

## Status flow

```
applied ──▶ shortlisted ──▶ interview ──▶ selected
   │             │              │
   └─────────────┴──────────────┴──▶ rejected

applied / shortlisted / interview ──(student)──▶ withdrawn
```

`selected`, `rejected` and `withdrawn` are terminal. Admins cannot skip steps (no `applied → interview`) and cannot set `applied` or `withdrawn`; only the student withdraws.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/api/jobs/:id/apply` | student | Apply; eligibility re-checked server-side |
| GET | `/api/applications/me` | student | Own applications, with the job populated. Query: `status`, `page`, `limit` |
| DELETE | `/api/applications/:id` | student | Withdraw (sets status `withdrawn`; the record is kept) |
| GET | `/api/jobs/:id/applications` | admin | Applicants for a job, with student name/email and profile academics. Query: `status`, `page`, `limit` |
| PATCH | `/api/applications/:id/status` | admin | Body: `status` (`shortlisted`, `interview`, `selected`, `rejected`), optional `remark` (max 500) |

Errors worth knowing: apply returns `403` with every failing eligibility reason in `errors`, or `409` if already applied; an illegal transition or a withdrawal after a decision returns `409` with the allowed next steps in the message.

## Key decisions

- **Eligibility is re-checked on apply.** The `eligible` flag on the job list is only a hint and can be stale (a deadline can pass, a job can close, a profile can change). The apply endpoint calls the same `checkEligibility` from Phase 4 and refuses with the specific reasons.
- **Duplicates are blocked by the database, not by code.** The controller doesn't "check then insert" (two simultaneous requests would both pass the check). It inserts and maps the unique-index error (`11000`) to a clear `409 You have already applied to this job`.
- **Withdrawing keeps the record.** The status becomes `withdrawn` and the history gains an entry, so admins and the student can still see what happened. A withdrawn student **cannot re-apply** to the same job (the unique index still holds). That's a deliberate simplification; allowing re-applies would mean reopening the old record.
- **Conditional atomic updates for withdrawals and status changes.** Both use `findOneAndUpdate` with the status they validated against in the filter. If a withdrawal and an admin decision arrive together, one wins and the other gets `409` instead of silently overwriting; the history can never gain an entry after `withdrawn`.
- **Other students' applications look missing, not forbidden.** Withdrawing an application you don't own returns `404`, so ids can't be probed.
- **A job with applications can't be deleted** (`409`, "Close it instead"). This closes the gap noted in Phase 4: deleting would orphan applications and erase students' history. Jobs with no applications still delete normally.
- **Admins can still process applications on closed or expired jobs.** The deadline stops new applicants, not the review of existing ones.

## How it was verified

57 checks against a temporary database (dropped afterwards):

- **Apply:** eligible student gets `201` with a one-entry history; no token `401`; admin `403`; ineligible student `403` with each reason and no row created; no profile, closed job and expired job all `403`; unknown job `404`; malformed id `400`.
- **Duplicates:** a second apply gives `409`; six simultaneous applies by one student give exactly one `201` and five `409`, leaving a single row.
- **My applications / applicant list:** correct ownership, population, status filter, pagination and role checks; applicant rows carry name, email and academics but never `passwordHash`.
- **Pipeline:** skipping steps, setting `applied`/`withdrawn`, unknown statuses and student attempts are rejected; the legal path `applied → shortlisted → interview → selected` works and records who changed what, when and the trimmed remark; `selected` is terminal; `applied → rejected` works.
- **Withdrawal:** own undecided application withdraws and is recorded; double withdrawal, withdrawal after a decision, someone else's application, and re-applying are all refused.
- **Races:** 8 rounds of withdraw-vs-shortlist fired in parallel. Status and history were consistent every time (history always ends at the stored status, nothing follows `withdrawn`). In all 8 the withdrawal won and the admin got `409`, because the status update does an extra read first; the opposite order (shortlist, then withdraw) is an ordinary sequential case that the transition table allows.
- **Job delete guard:** blocked when applications exist, still works otherwise.

## Next

Phase 6: frontend foundation — axios client with a token interceptor, auth context, protected and role-based routes, login and register pages.
