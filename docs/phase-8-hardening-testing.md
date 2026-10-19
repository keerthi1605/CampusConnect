# Phase 8: Hardening & Testing

**Goal:** make the API harder to abuse, replace the throwaway check scripts of earlier phases with a permanent automated suite, add demo data, and make the UI fail gracefully.

## 1. Hardening

| Protection | Where | Behaviour |
|---|---|---|
| **Sign-in throttling, per account** | `config/rateLimit.js` | 5 *failed* attempts per IP + email per 15 min, then `429` |
| **Sign-in throttling, per network** | same | 100 failed attempts per IP across all accounts per 15 min |
| **Registration throttling** | same | 30 sign-ups per IP per hour |
| **Whole-API ceiling** | same | 600 requests per IP per 15 min |
| **Request size limit** | `app.js` | JSON bodies over 20 kB get `413` before parsing (`BODY_LIMIT` to change) |
| **Proxy awareness** | `app.js` | `TRUST_PROXY=1` behind a host's proxy so limits apply per visitor |
| **Graceful shutdown** | `server.js` | On `SIGTERM`/`SIGINT`: finish in-flight requests, close the database, exit |

Blocked requests get the API's normal error shape (`{ success:false, message }`) plus a `Retry-After` header.

**Design choices**

- **Failed sign-ins are keyed by IP *and* email.** A campus shares a handful of public addresses. Keying only on IP would let one student's typos, or one attacker, lock out everybody. Per-account keys throttle guessing against a single account; the broader per-IP counter (set high) still catches an attacker trying many accounts. The email is lower-cased first, so changing letter case doesn't reset the count.
- **Successful logins aren't counted**, so a legitimate user who signs in often is never throttled.
- **A locked account stays locked for the window, even with the right password.** That is the price of stopping password guessing; the message says to retry in 15 minutes.
- **The limiter store is in memory.** That is correct for a single server process. With several instances behind a load balancer each would count separately; moving to a shared store (e.g. Redis) would be the fix. Worth stating in the final README.
- **All limits are environment variables** (see `server/.env.example`).

**Input sanitisation, and why there is no sanitiser package.** NoSQL injection needs a request to smuggle a Mongo operator (`{"$gt": ""}`) into a query. Here every body, query string and URL parameter is parsed by a zod schema into plain strings, numbers and enums *before* any controller runs, so operator objects are rejected (login) or stripped (queries). Express 5's query parser also doesn't build nested objects, so `?branch[$ne]=CSE` arrives as a harmless literal key. Packages like `express-mongo-sanitize` are therefore unnecessary (and don't support Express 5's read-only `req.query`). The tests below prove it. Free-text search is regex-escaped (Phase 3), and React renders all text as text, never HTML.

**Already in place from earlier phases:** `helmet` security headers, CORS origin allowlist, bcrypt hashing, HS256-pinned JWTs, role checks loaded from the database, production errors that hide stack traces.

## 2. Automated tests

```bash
cd server
npm test
```

**96 tests, about 30 seconds.** No new test framework: it uses Node's built-in runner (`node:test`) and `fetch`, so there is nothing extra to install.

| File | Covers |
|---|---|
| `eligibility.test.js` | The pure `checkEligibility` rules: every rule, inclusive boundaries, cleared (`null`) rules, all reasons at once |
| `auth.test.js` | Register, login, enumeration-safe errors, forged / expired / `alg:none` tokens, role checks, deleted users |
| `students.test.js` | Profile create/replace/validation/mass-assignment, the admin directory's filters, search, sort, pagination, operator-style queries |
| `jobs.test.js` | Create/validate, default hiding of closed and expired jobs, eligibility on the list, partial `PUT`, clearing fields, delete |
| `applications.test.js` | Apply rules, duplicates (including 6 simultaneous), the status pipeline, withdrawal rules, withdraw-vs-decision races, delete guard |
| `security.test.js` | All rate limits, 413 and malformed JSON, NoSQL-operator payloads, CORS, security headers, production error hiding |

**How it runs safely**

- Each file runs in its own process and creates a **uniquely named database** (`campusconnect_test_<random>`) on the cluster in `MONGO_URI`, then drops it. The harness refuses to run, or drop anything, if the connected database doesn't have that name, so it can never touch your real data.
- Each file uses its **own random `JWT_SECRET`**, so your `.env` secret isn't involved, and a lower bcrypt cost (`BCRYPT_ROUNDS=4`) to keep it fast. Production still defaults to 12.
- Tests drive the real Express app over HTTP on an ephemeral port, so routing, middleware, validation, and the database are all exercised together.
- **It needs network access to your MongoDB cluster.** I chose this over `mongodb-memory-server` (a ~780 MB download) and over Jest (awkward with ES modules).

**Do the tests actually catch bugs?** I deliberately broke three behaviours one at a time and checked the right tests failed: allowing `applied → interview` (1 test failed), dropping the unique `{student, job}` index (3 failed, including the simultaneous-apply test), and removing the per-account login limiter (3 failed). Each change was reverted afterwards.

## 3. Demo data

```bash
cd server
DEMO_PASSWORD=<pick-one> npm run seed:demo            # seed once
DEMO_PASSWORD=<pick-one> npm run seed:demo -- --reset  # wipe the demo data and rebuild it
```

(On Windows PowerShell, set `$env:DEMO_PASSWORD = "..."` first, then run `npm run seed:demo`.)

Creates 1 admin (`demo.admin@campusconnect.test`), 8 students with profiles (`aarav@`, `diya@`, `kabir@`... `@campusconnect.test`), 9 jobs (including one closed and one past its deadline), and 14 applications across every status. It checks each seeded application against the same eligibility rules, so the data is internally consistent. Safeguards: it needs `DEMO_PASSWORD` (the password is never in the repo), it refuses to run with `NODE_ENV=production`, it is idempotent, and `--reset` removes only `@campusconnect.test` data.

## 4. UI resilience

- `ErrorBoundary` wraps the app: a rendering crash shows "Something went wrong" with a way back instead of a blank page.
- Every data-loading screen now shows **Try again** next to a load error, which re-runs the request.
- (Loading states, disabled buttons while saving, and the API's field-level error messages were already in place from Phases 6 and 7.)

## How it was verified

- **`npm test`: 96 of 96 pass**, plus the three deliberate-breakage checks above.
- **Demo seed:** ran against a temporary database: missing password rejected; `NODE_ENV=production` rejected; seeds 1 admin, 8 students, 9 jobs, 14 applications; second run does nothing; `--reset` rebuilds the same counts.
- **In the browser** (temporary database seeded by `seed:demo`): signed in as a demo student; the job list showed a realistic mix of Eligible, Not eligible, Shortlisted and Selected, with closed and expired jobs hidden. With the API stopped, the Applications page showed "Cannot reach the server" and **Try again**; after restarting the API, one click recovered the page.
- **Not exercised in a browser:** the `ErrorBoundary` fallback (it needs a deliberate render crash). Graceful shutdown was written but not tested with a real `SIGTERM` (Windows signal behaviour differs from a Linux host).

## Next

Phase 9: deployment and documentation. Host the API (Render or Railway), the client (Vercel or Netlify) and use Atlas; set `CLIENT_URL`, `TRUST_PROXY` and a strong `JWT_SECRET` in production; write the final README with an architecture diagram, setup steps, API table, screenshots and demo logins.
