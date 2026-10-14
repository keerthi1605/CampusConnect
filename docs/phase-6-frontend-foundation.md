# Phase 6: Frontend Foundation

**Goal:** the React app can sign users in and out, remembers them across reloads, talks to the API with the right token, and keeps each role inside its own area. Phase 7 builds the real screens on top of this.

## What was built

```
client/src/
├── main.jsx                  BrowserRouter > AuthProvider > App
├── App.jsx                   route table
├── api/
│   ├── client.js             axios instance + token / 401 interceptors
│   ├── tokenStorage.js       localStorage wrapper that never throws
│   └── errors.js             parseApiError(): axios error -> { message, fieldErrors }
├── auth/
│   ├── authContext.js        the React context object
│   ├── AuthProvider.jsx      user state, login / register / logout, session restore
│   ├── useAuth.js            hook + homePathFor(role)
│   └── routeGuards.jsx       ProtectedRoute, RoleRoute, GuestRoute, RootRedirect
├── components/
│   ├── Layout.jsx            role-aware navbar + page outlet
│   └── FormError.jsx         shows the API's message plus per-field errors
└── pages/
    ├── Login.jsx, Register.jsx
    ├── Dashboards.jsx        StudentHome / AdminHome placeholders
    └── StatusPages.jsx       NotFound, Forbidden
```

Environment: `VITE_API_URL` (default `http://localhost:5000/api`).

## Routes

| Path | Who | Behaviour |
|---|---|---|
| `/` | anyone | Redirects to the user's home, or `/login` if signed out |
| `/login`, `/register` | signed-out only | A signed-in user is redirected away |
| `/student`, `/student/*` | students | Others get `/forbidden` |
| `/admin`, `/admin/*` | admins | Others get `/forbidden` |
| `/forbidden`, anything else | anyone | "Not allowed" / "Page not found" |

Convention for Phase 7: **student screens live under `/student/...`, admin screens under `/admin/...`.** The post-login redirect relies on it.

## How the pieces fit

**API client (`api/client.js`).**
- *Request interceptor:* reads the token from storage on every request and adds `Authorization: Bearer <token>`.
- *Response interceptor:* on a `401` it calls a handler registered by `AuthProvider`, which clears the token and user. `ProtectedRoute` then re-renders and redirects to `/login`. The login and register calls are exempt, since a `401` there just means a wrong password.

**Session restore (`AuthProvider`).** If a token is stored, the provider calls `GET /auth/me` before deciding anything, showing "Loading…" meanwhile, so a refresh doesn't flash the login page. A rejected token is cleared. Because the server loads the user on every request, a deleted account or changed role is noticed here too.

**Guards.**
- `ProtectedRoute` sends signed-out users to `/login`, remembering where they were headed.
- `RoleRoute roles={[...]}` checks the role.
- `GuestRoute` keeps signed-in users off the login pages and, after sign-in, returns them to the page they originally asked for. That destination is only honoured if it is inside the user's own role area; a student who opened `/admin` before logging in lands on `/student` instead of a "Not allowed" page.

**Errors.** `parseApiError` turns the API's `{ message, errors[] }` into something displayable. A request that never got a response shows "Cannot reach the server" instead of a blank failure.

## Key decisions

- **Token in `localStorage`.** It's simple and works with the API's header-based auth and CORS setup (no credentials mode). The trade-off: any script that runs in the page, such as an XSS hole or a malicious dependency, could read it. An httpOnly cookie avoids that but would need `credentials: true` in CORS plus CSRF protection. Mentioned here so the final README can state it plainly.
- **Server is the source of truth for the role.** The client reads `user.role` from `/auth/me` and the login response for navigation only. Hiding a link or a route is not security; every API call is still authorised by the server (Phase 2).
- **Storage wrapper never throws.** Blocked site data or private windows make `localStorage` throw; the app then just won't remember the session across reloads.
- **No UI library yet.** Plain CSS with variables, following the system light/dark setting, and a responsive layout. Phase 7 can add components as needed without a framework to unpick.
- **Context split across three files.** The linter's react-refresh rule wants component files to export only components, so the context object, the provider and the hook are separate.

## How it was verified

The real app was run in the browser pane: the Vite dev server against the real API, backed by a **temporary Atlas database** that was dropped afterwards. Throwaway test accounts only.

| Check | Result |
|---|---|
| Signed-out visit to `/admin` | Redirected to `/login` |
| Wrong password | API's "Invalid email or password" shown; no logout loop; cross-origin call allowed by CORS |
| API unreachable | "Cannot reach the server" shown and the button re-enables |
| Admin login | Lands on `/admin`, navbar shows name and role badge |
| Admin opens `/student` | `/forbidden` |
| Full page reload while signed in | Stays signed in |
| `/login` while signed in | Redirected to the dashboard |
| Log out | Token removed, `/login`; `/admin` then redirects to login |
| Register with a weak password | Server's field errors listed under the headline |
| Register with a valid password | Account created, lands on `/student` |
| Student opens `/admin` | `/forbidden` |
| Garbage token in storage + reload | Cleared, redirected to `/login` |
| Token turns invalid while the app is open | Next API call gets `401`; user is logged out and sent to `/login` |
| Signed-out `/admin` visit, then student login | Lands on `/student`, not "Not allowed" |
| 375px-wide viewport | No horizontal scroll |

`npm run lint` and `npm run build` pass. There is no automated frontend test suite; Phase 8 covers automated testing.

## Setup note found during testing

`server/.env` must have a `JWT_SECRET` of at least 32 characters. The API refuses to start otherwise (a check added in Phase 2). If the client shows "Cannot reach the server" while `npm run dev` is running in `server/`, check that terminal first.

## Next

Phase 7: the real screens: student profile form, job list with eligibility badges, job detail and apply, "my applications" timeline; admin dashboard, job management, applicants table with a status dropdown, and the student directory.
