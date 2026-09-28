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

Field-level details are in each phase doc: [auth](phase-2-authentication-rbac.md), [students](phase-3-student-profile.md).

## Planned

| Area | Phase |
|---|---|
| Jobs (CRUD, eligibility flag) | 4 |
| Applications (apply, withdraw, admin status updates) | 5 |
