# API Reference

Base URL: `http://localhost:5000/api`. Send JSON, and for protected routes `Authorization: Bearer <token>`.

**Success:** `{ "success": true, ... }`  
**Error:** `{ "success": false, "message": "...", "errors": [{ "field": "body.email", "message": "..." }] }`

Common status codes: `400` validation, `401` missing/invalid/expired token, `403` wrong role or blocked origin, `404` not found, `409` duplicate, `413` body too large, `500` unexpected.

This file grows with each phase.

## Health and metadata

| Method | Path | Access | Phase | Description |
|---|---|---|---|---|
| GET | `/health` | public | 1 | Service status, DB connection state, uptime |
| GET | `/meta/branches` | public | 3 | Allowed branch values |
| GET | `/meta/job-types` | public | 4 | Allowed job type values |

## Authentication

| Method | Path | Access | Phase | Description |
|---|---|---|---|---|
| POST | `/auth/register` | public | 2 | Create a student account. Body: `name`, `email`, `password` |
| POST | `/auth/login` | public | 2 | Body: `email`, `password`. Returns `token` and `user` |
| GET | `/auth/me` | signed in | 2 | Current user |

## Students

| Method | Path | Access | Phase | Description |
|---|---|---|---|---|
| GET | `/students/me` | student | 3 | Own profile (`profile: null` if none) |
| PUT | `/students/me` | student | 3 | Create or replace own profile |
| GET | `/students` | admin | 3 | List with `q`, `branch`, `batchYear`, `minCgpa`, `maxCgpa`, `maxBacklogs`, `sort`, `page`, `limit` |
| GET | `/students/:id` | admin | 3 | One profile by profile id |

## Jobs

| Method | Path | Access | Phase | Description |
|---|---|---|---|---|
| GET | `/jobs` | signed in | 4 | List with `q`, `type`, `status`, `sort`, `page`, `limit`. Each job carries `eligible`/`reasons` for students |
| GET | `/jobs/:id` | signed in | 4 | One job, same eligibility annotation for students |
| POST | `/jobs` | admin | 4 | Create. Body: `title`, `company`, `description`, `type`, `deadline` (future), optional `location`, `ctc`, `eligibility` |
| PUT | `/jobs/:id` | admin | 4 | **Partial** update — only sent fields change; `eligibility` sub-fields merge individually |
| DELETE | `/jobs/:id` | admin | 4 | Delete; `409` if the job has applications (close it instead) |

## Applications

| Method | Path | Access | Phase | Description |
|---|---|---|---|---|
| POST | `/jobs/:id/apply` | student | 5 | Apply. `403` + reasons if ineligible, `409` if already applied |
| GET | `/applications/me` | student | 5 | Own applications with job populated. `status`, `page`, `limit` |
| DELETE | `/applications/:id` | student | 5 | Withdraw (status becomes `withdrawn`). `409` once decided |
| GET | `/jobs/:id/applications` | admin | 5 | Applicants with student name/email and profile academics. `status`, `page`, `limit` |
| PATCH | `/applications/:id/status` | admin | 5 | Body: `status` (`shortlisted`, `interview`, `selected`, `rejected`), optional `remark`. Only legal transitions |

Field-level details are in each phase doc: [auth](phase-2-authentication-rbac.md), [students](phase-3-student-profile.md), [jobs](phase-4-jobs-eligibility.md), [applications](phase-5-applications.md).
