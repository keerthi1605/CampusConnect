# Phase 2: Authentication & Role-Based Access Control

**Goal:** users can register and log in, and every protected route knows who is calling and whether their role is allowed.

## What was built

| File | Purpose |
|---|---|
| `models/User.js` | `name`, unique lowercase `email`, `passwordHash`, `role` (`student` or `admin`) |
| `validators/auth.validators.js` | Register and login request schemas |
| `controllers/auth.controller.js` | `register`, `login`, `getMe` |
| `routes/auth.routes.js` | Wires the three endpoints |
| `utils/token.js` | `signToken` / `verifyToken` (HS256) |
| `middleware/auth.js` | `protect` (authentication) and `authorize(...roles)` (authorization) |
| `scripts/seedAdmin.js` | Creates the first admin from environment variables |
| `config/env.js` | Startup check: `MONGO_URI` set, `JWT_SECRET` at least 32 characters |

## Endpoints

| Method | Path | Access | Result |
|---|---|---|---|
| POST | `/api/auth/register` | public | `201 { token, user }`; always creates a `student` |
| POST | `/api/auth/login` | public | `200 { token, user }` |
| GET | `/api/auth/me` | any signed-in user | `200 { user }` |

Clients send the token as `Authorization: Bearer <token>`.

## How a protected request is handled

```
Authorization: Bearer <jwt>
   └▶ protect   verify signature + expiry → load user from DB → req.user
        └▶ authorize('admin')   req.user.role must be in the allowed list (else 403)
             └▶ validate → controller
```

Usage in a route file: `router.get('/x', protect, authorize(ROLES.ADMIN), handler)`.

## Key decisions

- **Passwords:** hashed with bcrypt (cost 12). Password rules: 8-72 characters with at least one letter and one digit. The 72 cap exists because bcrypt ignores anything past 72 bytes. `passwordHash` is `select: false` and stripped from JSON output, so it never leaves the database layer unless explicitly requested.
- **No self-service admin.** The register schema has no `role` field, so zod strips it if a client sends one. Admins are created with `npm run seed:admin`, which is idempotent.
- **Role comes from the database, not the token.** `protect` loads the user on every request. A deleted user loses access at once, and promoting or demoting a user applies immediately. The cost is one indexed lookup per request.
- **HS256 pinned on verify.** `verifyToken` only accepts HS256, which blocks `alg: none` and algorithm-confusion attacks.
- **`authorize` fails closed.** If used without `protect` before it, it returns `401` rather than letting the request through.
- **No user enumeration.** Login returns the same `401 Invalid email or password` for an unknown email and a wrong password, and runs a dummy bcrypt comparison for unknown emails so response times are similar.
- **Emails are normalised** (trimmed, lowercased) so `Alice@X.com` and `alice@x.com` are one account.
- **Token storage (frontend, Phase 6):** the token will be kept in `localStorage` and sent in a header. It is simple and works with the CORS setup, but exposed to XSS; an httpOnly cookie would be safer at the cost of CSRF handling. Worth stating in the final README.

## Seeding the first admin

Set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` in `server/.env`, then:

```bash
cd server && npm run seed:admin
```

If the email already exists the script changes nothing.

## How it was verified

31 checks against a temporary database (dropped afterwards):

- **Register:** 201 with token; `role: "admin"` in the body ignored; `passwordHash` never in a response; stored value is a bcrypt hash; duplicate email in any letter case gives 409; weak input gives 400 with field names.
- **Login:** email case-insensitive; wrong password and unknown email give identical 401s.
- **Tokens:** garbage, expired, wrong-secret, `alg: none` and non-Bearer tokens all give 401; a deleted user's token gives 401.
- **RBAC:** student on an admin route gives 403, admin gives 200, no token gives 401, `authorize` without `protect` gives 401, and a role change applies to an existing token immediately.
- **Seed script:** creates the admin, is idempotent, refuses to run without a password.
- **Env check:** `assertEnv` rejects a short `JWT_SECRET`.

## Also fixed in this phase

- **Express 5 `listen` errors:** Express 5 passes listen errors (like a busy port) to the `listen` callback. `server.js` now checks it and exits with the real error instead of logging "API listening".
- **Default database:** an Atlas URI without a database name sends data to `test`. `DB_NAME` (default `campusconnect`) now decides the database.

## Next

[Phase 3: Student profile](phase-3-student-profile.md)
