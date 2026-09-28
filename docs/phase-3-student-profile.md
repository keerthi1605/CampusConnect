# Phase 3: Student Profile

**Goal:** students maintain the academic details that eligibility checks will use (Phase 4), and admins can search and filter students.

## What was built

| File | Purpose |
|---|---|
| `models/StudentProfile.js` | Profile schema, one per user |
| `constants/branches.js` | The fixed branch list used by profiles now and job eligibility in Phase 4 |
| `validators/student.validators.js` | Profile upsert schema and admin list query schema |
| `validators/common.js` | Shared `objectId`, `emptyToUndefined`, `paginationQuery`, `idParams` |
| `controllers/student.controller.js` | Own-profile and admin handlers |
| `routes/student.routes.js` | All routes require sign-in; role checked per route |
| `routes/meta.routes.js` | `GET /api/meta/branches` so the UI builds dropdowns from the API's own list |
| `utils/pagination.js`, `utils/escapeRegex.js` | Reusable helpers (jobs list in Phase 4 will use them too) |

## Data model: `StudentProfile`

| Field | Rules |
|---|---|
| `user` | reference to `User`, required, **unique** (one profile per account) |
| `rollNo` | required, **unique**, stored uppercase, 3-20 letters/digits/hyphens |
| `branch` | required, one of `CSE, IT, AIML, AIDS, CSBS, ECE, EEE, MECH, CIVIL, OTHER` |
| `cgpa` | required, 0-10 |
| `batchYear` | required, integer 2000-2100 |
| `backlogs` | integer >= 0, default 0 |
| `phone` | optional, exactly 10 digits |
| `skills` | list of up to 20 strings (max 40 characters each), trimmed and de-duplicated ignoring case |
| `resumeUrl` | optional, `http(s)` URL only |

Indexes: unique on `user` and `rollNo`; plain indexes on `branch`, `cgpa`, `batchYear` for the admin filters.

Name and email stay on `User`; the profile holds only academic data.

## Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/students/me` | student | Own profile, or `profile: null` if not created yet |
| PUT | `/api/students/me` | student | Create or replace own profile |
| GET | `/api/students` | admin | Search, filter, sort, paginate |
| GET | `/api/students/:id` | admin | One profile (`:id` is the **profile** id) |
| GET | `/api/meta/branches` | public | Allowed branch values |

### `PUT /api/students/me`

Required: `rollNo`, `branch`, `cgpa`, `batchYear`. Optional: `backlogs` (default 0), `phone`, `skills`, `resumeUrl`.

- It is a **full replace**: optional fields left out are cleared.
- Empty strings (`""`) for `phone` and `resumeUrl` count as "not provided", since HTML forms send blanks.
- `user`, `_id` and any other extra keys in the body are stripped, so a student cannot write to someone else's profile.

### `GET /api/students` query parameters

| Param | Meaning |
|---|---|
| `q` | Case-insensitive match on roll number, name or email |
| `branch` | Exact branch |
| `batchYear` | Exact year |
| `minCgpa`, `maxCgpa` | Inclusive CGPA range |
| `maxBacklogs` | Backlogs less than or equal to this |
| `sort` | `createdAt`, `cgpa`, `rollNo`, `batchYear`, each optionally prefixed `-` for descending (default `-createdAt`) |
| `page`, `limit` | Default 1 and 20; `limit` max 100 |

Response: `{ success, data: [profile...], pagination: { page, limit, total, pages } }`. Each profile has `user` populated with `name` and `email` only.

## Key decisions

- **Own-profile routes are student-only.** Admins have no profile, so `/students/me` returns 403 for them.
- **`GET /me` returns `profile: null` instead of 404** so the frontend can show an empty form on first visit without an error in the console.
- **Fixed branch list.** Eligibility in Phase 4 matches branch exactly. Free text ("CS", "Computer Science", "CSE") would silently make students ineligible; an enum prevents that.
- **Search across two collections.** Name and email live on `User`, roll number on the profile. When `q` is present the controller first finds matching student users, then matches profiles by roll number or those user ids.
- **Regex safety.** `q` is escaped before becoming a regular expression, so `.*` matches literally and `(` cannot crash the query or cause catastrophic backtracking.
- **Injection-resistant filters.** Query values pass through zod and become plain numbers or enum strings. Express 5's query parser does not build nested objects, so `?branch[$ne]=CSE` arrives as a literal key `branch[$ne]`, which zod strips: the filter is ignored and no Mongo operator is ever produced. Invalid values such as `?branch=$ne` are rejected with 400.
- **Sort whitelist plus tie-breaker.** Only listed fields can be sorted on (no sorting by `passwordHash`), and `_id` is appended so pages stay stable when many rows share a value.
- **`http(s)` only for `resumeUrl`.** A stored `javascript:` URL would become an XSS vector once rendered as a link.
- **Resume upload is not implemented.** Students paste a link (Drive, etc.). File upload is a stretch goal.

## How it was verified

**Offline (done, 40 checks pass).** The real Express app, routes, middleware, zod schemas and Mongoose schema were run with the database calls stubbed:

- **Access control:** no token gives 401; a student gets 403 on admin routes; an admin gets 403 on `/me`.
- **Own profile:** the first `GET` returns null; `PUT` saves a valid profile; omitted and empty optional fields are cleared; `backlogs` defaults to 0.
- **Normalisation:** roll number uppercased; skills trimmed, de-duplicated, blanks dropped.
- **Validation:** bad values for every field give 400 with field names; `javascript:` and `ftp:` resume links, string CGPA and short roll numbers are rejected.
- **Mass assignment:** `user`, `_id` and `role` in the body cannot override anything.
- **Admin list:** the exact Mongo filter, sort, skip and limit built from each query; `q` is regex-escaped; empty filters are ignored; `limit=1000`, `page=0`, out-of-range CGPA, non-whitelisted sort and invalid enums give 400; `?branch[$ne]=CSE` is ignored.
- **Detail:** a malformed id gives 400; a missing profile gives 404.

**Against a real database (done, 36 checks pass).** Once Atlas was reachable again, a throwaway script created four students and an admin in a temporary database (dropped afterwards) and confirmed: one profile per user; a second `PUT` updates the same document rather than creating another; a duplicate roll number across two different students gives 409; branch/CGPA-range/batch/backlogs filters, name/email/roll-number search and sorting all return the right rows on real data; `populate` returns `name` and `email` only, never `passwordHash`.

## Next

Phase 4: jobs and the eligibility engine (`checkEligibility(profile, job)` using the fields defined here).
