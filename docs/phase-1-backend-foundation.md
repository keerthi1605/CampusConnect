# Phase 1: Backend Foundation

**Goal:** the plumbing every later feature depends on: a modular folder structure, CORS, input validation and one consistent error format.

## What was built

| File | Purpose |
|---|---|
| `routes/index.js` | Mounts feature routers under `/api` |
| `controllers/health.controller.js` | `GET /api/health` reports service status, DB connection state and uptime |
| `config/cors.js` | CORS allowlist built from `CLIENT_URL` |
| `middleware/validate.js` | `validate({ body, params, query })` using zod schemas |
| `middleware/errorHandler.js` | `notFound` (404) and the central `errorHandler` |
| `utils/ApiError.js` | Error class with helpers: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict` |

Middleware order in `app.js`: `helmet` → `cors` → `morgan` → `express.json` → `/api` routes → `notFound` → `errorHandler`.

## CORS

- `CLIENT_URL` accepts several comma-separated origins (for example local plus production).
- Allowed origins receive CORS headers; preflight (`OPTIONS`) answers for `GET, POST, PUT, PATCH, DELETE` and the `Content-Type` and `Authorization` headers, cached for 10 minutes.
- A browser request from any other origin gets a `403` JSON error and no CORS headers.
- Requests with no `Origin` header (Postman, curl, server-to-server) are allowed, because CORS only protects browsers.
- No `credentials` flag: the JWT travels in the `Authorization` header, not in cookies.

## Validation

`validate(schemas)` parses `req.params`, `req.query` and `req.body` against zod schemas.

- Failures return `400` with **every** problem, e.g. `{ field: "body.email", message: "..." }`.
- On success the parsed result **replaces** the request data, so controllers see coerced numbers (`"3"` → `3`), defaults applied, and unknown keys stripped. Stripping is what blocks mass-assignment (a client sending `role: "admin"`).
- Express 5 makes `req.query` a read-only getter, so the middleware redefines the property instead of assigning it.

## Error handling

Controllers just `throw`. Express 5 forwards rejected promises from async handlers to the error middleware, so no `try/catch` or `asyncHandler` wrapper is needed.

Every error becomes `{ success: false, message, errors? }`:

| Thrown error | Status |
|---|---|
| `ApiError` | its own status |
| zod / Mongoose validation error | 400 |
| Mongoose `CastError` (bad ObjectId) | 400 |
| Malformed JSON body | 400 |
| Body too large | 413 |
| JWT invalid / expired | 401 |
| Mongo duplicate key (`11000`) | 409 |
| Anything else | 500 (generic message; stack trace only outside production) |

Unknown routes return `404 { message: "Route GET /api/x not found" }`.

## How it was verified

A throwaway script ran 12 checks against the real app and a small test app: allowed and blocked origins, preflight, 404, malformed JSON, validation coercion and stripping, multi-field errors, the 500 / 409 / 400 mappings, and that production mode hides stack traces and internal messages.

## Next

[Phase 2: Authentication & RBAC](phase-2-authentication-rbac.md)
