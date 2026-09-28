# CampusConnect Documentation

CampusConnect is a full-stack campus placement management system. Students maintain profiles, browse jobs they are eligible for and apply; placement administrators post jobs and move applications through a hiring pipeline.

**Stack:** React (Vite) · Node.js · Express 5 · MongoDB (Mongoose) · JWT · REST

## Contents

| Doc | What it covers | Status |
|---|---|---|
| [Phase 0: Project setup](phase-0-project-setup.md) | Repo layout, tooling, environment variables | Done |
| [Phase 1: Backend foundation](phase-1-backend-foundation.md) | Express app structure, CORS, validation, error handling | Done |
| [Phase 2: Authentication & RBAC](phase-2-authentication-rbac.md) | Register/login, JWT, role-based access, admin seeding | Done |
| [Phase 3: Student profile](phase-3-student-profile.md) | Profile model, self-service endpoints, admin search | Done |
| Phase 4: Jobs & eligibility | Job CRUD, eligibility engine | Planned |
| Phase 5: Applications & status tracking | Apply, status pipeline | Planned |
| Phase 6: Frontend foundation | Router, auth context, API client | Planned |
| Phase 7: Frontend screens | Student and admin UI | Planned |
| Phase 8: Hardening & testing | Rate limiting, automated tests | Planned |
| Phase 9: Deployment & docs | Hosting, final README | Planned |
| [API reference](api-reference.md) | Every endpoint built so far | Living |

Each phase doc follows the same shape: **goal → what was built → key decisions → how to verify → what is next.**

## Architecture

```
React client (Vite)  ──HTTP/JSON + Bearer JWT──▶  Express API  ──Mongoose──▶  MongoDB Atlas
   client/                                          server/
```

Request flow inside the API:

```
request → helmet → cors → morgan → express.json → /api router
              → [protect → authorize → validate] → controller → response
                                                       │
       any thrown error (sync or async) ───────────────┴──▶ errorHandler → { success:false, message, errors? }
```

Server layout (`server/src`):

| Folder | Responsibility |
|---|---|
| `config/` | DB connection, CORS options, environment checks |
| `routes/` | URL → middleware chain → controller mapping only |
| `controllers/` | Request handling and business logic |
| `models/` | Mongoose schemas |
| `validators/` | zod schemas for request bodies, params and queries |
| `middleware/` | `protect`, `authorize`, `validate`, error handling |
| `utils/` | `ApiError`, JWT helpers, pagination, regex escaping |
| `constants/` | Shared fixed lists (e.g. branches) |
| `scripts/` | One-off CLI tasks (admin seeding) |

## Why MongoDB (and not SQL)

A relational database would also work for this data. MongoDB was chosen because:

- The project targets the MERN stack, and Mongoose models map directly onto the "modular routes / controllers / models" structure.
- The dataset is small and read-mostly, with no multi-table transactions or heavy reporting.
- Job eligibility rules (min CGPA, allowed branches, max backlogs, batch year) vary per job and fit naturally as an embedded `eligibility` object on the job document.

The two things SQL does well that this project needs are covered:

| SQL feature | MongoDB equivalent used here |
|---|---|
| "One application per student per job" constraint | Unique compound index on `{student, job}` (Phase 5) |
| Joins for admin views | `populate()` |

If the project later needs heavy analytics or strict multi-row transactions, PostgreSQL would become the better fit.

## Running locally

```bash
# 1. API
cd server
cp .env.example .env      # then fill in the values (see below)
npm install
npm run dev               # http://localhost:5000

# 2. Client
cd client
npm install
npm run dev               # http://localhost:5173

# 3. Create the first admin (after setting ADMIN_EMAIL / ADMIN_PASSWORD in server/.env)
cd server && npm run seed:admin
```

### Server environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | no (5000) | API port |
| `MONGO_URI` | yes | MongoDB / Atlas connection string |
| `DB_NAME` | no (`campusconnect`) | Database name; overrides any name in the URI |
| `JWT_SECRET` | yes | Signing key, **at least 32 characters** |
| `JWT_EXPIRES_IN` | no (`7d`) | Token lifetime |
| `CLIENT_URL` | yes | Allowed CORS origin(s), comma-separated |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | seed only | Used by `npm run seed:admin` |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Client environment variables (`client/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API, e.g. `http://localhost:5000/api` |

## Conventions

- **Response shape:** success → `{ success: true, ...data }`; failure → `{ success: false, message, errors? }` where `errors` is a list of `{ field, message }`.
- **Validation:** every route that accepts input runs `validate(schema)` first, so controllers only see parsed, stripped, coerced data.
- **Errors:** controllers throw (`throw ApiError.notFound(...)`); Express 5 forwards async rejections to the central handler, so there are no try/catch blocks or `asyncHandler` wrappers.
- **Authorization:** roles come from the database on every request, not from the token, so revoking or changing a role takes effect immediately.
