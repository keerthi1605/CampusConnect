# Phase 4: Jobs & Eligibility Engine

**Goal:** admins post and manage jobs; students browse them and immediately see whether they qualify, and why not if they don't.

## What was built

| File | Purpose |
|---|---|
| `models/Job.js` | Job schema, with an embedded `eligibility` sub-document |
| `constants/jobTypes.js` | `full-time`, `part-time`, `internship` |
| `utils/eligibility.js` | `checkEligibility(profile, job)` — pure function, no DB access |
| `validators/job.validators.js` | Create, partial-update and list-query schemas |
| `controllers/job.controller.js` | List, detail, create, update, delete |
| `routes/job.routes.js` | Wires the endpoints; `GET` open to any signed-in user, writes admin-only |
| `routes/meta.routes.js` | `GET /api/meta/job-types` added alongside `/branches` |

## Data model: `Job`

| Field | Rules |
|---|---|
| `title`, `company` | required, 2-150 characters |
| `description` | required, 10-5000 characters |
| `location` | optional |
| `type` | required, one of `full-time`, `part-time`, `internship` |
| `ctc` | optional, >= 0 (annual CTC in LPA, or a stipend for internships) |
| `deadline` | required date; must be in the future when the job is **created** |
| `status` | `open` (default) or `closed` |
| `eligibility.minCgpa` | default 0 |
| `eligibility.branches` | default `[]` — empty means open to every branch |
| `eligibility.maxBacklogs` | optional — unset means no cap |
| `eligibility.batchYear` | optional — unset means any batch |
| `createdBy` | the admin who posted it |

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/jobs` | any signed-in user | Search, filter, sort, paginate |
| GET | `/api/jobs/:id` | any signed-in user | One job |
| POST | `/api/jobs` | admin | Create |
| PUT | `/api/jobs/:id` | admin | **Partial** update (see below) |
| DELETE | `/api/jobs/:id` | admin | Delete |
| GET | `/api/meta/job-types` | public | Allowed `type` values |

### `GET /api/jobs` query parameters

| Param | Meaning |
|---|---|
| `q` | Case-insensitive match on title or company |
| `type` | Exact job type |
| `status` | `open` (default: hides closed **and expired** jobs) · `closed` (only those) · `all` |
| `sort` | `deadline` (default), `-deadline`, `createdAt`, `-createdAt`, `ctc`, `-ctc` |
| `page`, `limit` | Default 1 and 20; `limit` max 100 |

For a **student**, every job in the response also carries `eligible: boolean` and `reasons: string[]`, computed against their own profile. A student with no profile gets `eligible: false` on every job with a single reason to complete their profile first. An **admin** gets the job as-is, with no eligibility fields — eligibility isn't meaningful for a role that has no student profile.

### `checkEligibility(profile, job)`

Checks all of the following and returns **every** reason that fails, not just the first:

1. Job status is `open`
2. Deadline hasn't passed
3. `profile.cgpa >= eligibility.minCgpa`
4. `profile.branch` is in `eligibility.branches` (skipped if the list is empty)
5. `profile.backlogs <= eligibility.maxBacklogs` (skipped if unset)
6. `profile.batchYear === eligibility.batchYear` (skipped if unset)

All numeric comparisons are inclusive (a CGPA exactly at `minCgpa`, or backlogs exactly at `maxBacklogs`, both pass). No profile short-circuits everything else, since there is nothing to check against.

Being pure and DB-free, it will be reused by the apply endpoint in Phase 5 to re-check eligibility server-side even if the client's flag is stale.

## Key decisions

- **`PUT` is a partial update here, unlike the student profile's full-replace `PUT`.** An admin closing a job shouldn't have to resend the title, description and every eligibility rule. The route name stays `PUT` to match the plan's CRUD list, but the body is treated as a patch: only the fields sent are changed, and at least one field is required so an empty request can't silently succeed. This is a deliberate inconsistency with Phase 3's `PUT /students/me`, called out here so it isn't mistaken for an oversight.
- **The `eligibility` object merges field-by-field**, not as a whole. `PUT /jobs/:id { status: "closed" }` changes only `status` — `minCgpa`, `branches` etc. are left as they were. Getting this right needed two separate zod schemas (see "Bug caught" below), because a schema field written as `min Cgpa.default(0).optional()` still applies `0` whenever the field is omitted, which would have reset it on every partial edit.
- **Default `status=open` hides both closed and expired jobs.** A job whose deadline has quietly passed is still `status: "open"` in the database (nothing flips it automatically); the list query treats "past its deadline" the same as "closed" so students don't see stale postings by default. `status=all` or `status=closed` still reach it — a job's own detail page also stays reachable by id regardless of status, so a student who already saw or applied to it doesn't hit a dead link.
- **Deadlines must be in the future on create**, rejecting an obviously wrong posting at the door. Updates that don't touch `deadline` are unaffected.
- **No delete guard yet.** `DELETE /api/jobs/:id` removes the job outright. Phase 5 will need to decide what happens to a job's applications when it's deleted (block the delete, or cascade) — there's nothing to protect yet since applications don't exist.

## Bug caught during verification

The first version of the partial-update schema built `eligibilityPatch` from the create schema's fields via `.unwrap().partial()`. In zod, a field's `.default()` fires on `undefined` even through `.optional()`/`.partial()` — so `PUT /jobs/:id { eligibility: { minCgpa: 8 } }` would have silently reset `branches` back to `[]` on every job, the same class of bug as the blank-skills issue in Phase 3. Fixed by defining the eligibility fields once with no `.default()`, and only adding defaults on the copy used for job creation. Caught by the "patch only minCgpa" / "branches untouched" checks below before it reached the database.

## How it was verified

**Unit tests for `checkEligibility` (14 checks, no database):** no profile, open/closed, future/past deadline, closed-and-expired together, CGPA below/at the limit, branch allowed/blocked/unrestricted, backlogs below/at the cap, wrong batch year, and every rule failing at once (all 6 reasons present).

**Endpoint tests against a real database (37 checks, temporary database, dropped afterwards):**
- RBAC on all five endpoints (student blocked from writes, no token blocked from everything).
- Validation: past deadline, short title, invalid branch in `eligibility` all rejected.
- A job with no `eligibility` block gets the schema defaults (`minCgpa: 0`, `branches: []`).
- Default listing hides an expired-but-still-`open` job and an explicitly closed one; `status=all` and `status=closed` surface them correctly.
- Eligibility annotation: a matching student is `eligible: true` with no reasons; a mismatched student gets every applicable reason; a profile-less student is ineligible on every job; an admin's list has no eligibility fields at all.
- Filters by type, search by company and by title, sort by CTC.
- A job's detail page stays reachable by id even after it's expired.
- Partial `PUT`: patching `status` alone leaves other fields untouched; patching `eligibility.minCgpa` alone leaves `branches`, `maxBacklogs` and `batchYear` untouched; an empty body is rejected.
- Delete: admin-only, 404 on a re-fetch afterward, exact count of remaining jobs confirmed.

## Next

Phase 5: applications — students apply (re-checking eligibility server-side with the same `checkEligibility`), withdraw, and admins move applications through a status pipeline.
