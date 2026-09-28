# Phase 0: Project Setup

**Goal:** a working monorepo skeleton where the API and the React app both start, and the API can reach MongoDB.

## What was built

```
CampusConnect/
├── .gitignore            ignores node_modules, .env, build output
├── client/               Vite + React app (placeholder page pings the API)
│   └── .env.example      VITE_API_URL
└── server/               Express API (ES modules)
    ├── .env.example
    └── src/
        ├── server.js     entry point: env check → DB connect → listen
        ├── app.js        Express app (kept separate so it can be tested without listening)
        └── config/db.js  Mongoose connection
```

- **Server** (`server/`): `express`, `mongoose`, `dotenv`, `cors`, `bcryptjs`, `jsonwebtoken`, `zod`, `helmet`, `morgan`; `nodemon` for development. Scripts: `npm run dev`, `npm start`.
- **Client** (`client/`): Vite React template plus `react-router-dom` and `axios`. The demo page calls `GET /api/health` and shows the result.
- **Database:** MongoDB Atlas free cluster (see the decision in the [docs index](README.md#why-mongodb-and-not-sql)).

## Key decisions

- **Two independent packages, not npm workspaces.** Client and server have separate `package.json` files and are deployed separately (Phase 9), so workspaces add nothing.
- **ES modules on the server** (`"type": "module"`), matching the client's import syntax.
- **`app.js` vs `server.js` split.** `app.js` only builds the Express app; `server.js` connects to the DB and listens. Tests can import the app and bind it to a random port.
- **`.env` is git-ignored; `.env.example` is committed** so anyone can see which variables exist.

## How to verify

1. Fill in `server/.env` (Atlas URI, secret) and run `npm run dev` in `server/`. Expect `MongoDB connected: ...` and `API listening on http://localhost:5000`.
2. Run `npm run dev` in `client/` and open http://localhost:5173. The page should show **API status: ok**.

## Installed packages

| Package | Where | Purpose |
|---|---|---|
| `express` | server | Web framework for the REST API |
| `mongoose` | server | MongoDB models, schemas, queries |
| `dotenv` | server | Loads config from `.env` |
| `cors` | server | Cross-origin allowlist |
| `bcryptjs` | server | Password hashing |
| `jsonwebtoken` | server | Signs and verifies JWTs |
| `zod` | server | Request validation |
| `helmet` | server | Security HTTP headers |
| `morgan` | server | Request logging |
| `nodemon` | server (dev) | Auto-restart during development |
| `react`, `react-dom` | client | UI library |
| `vite`, `@vitejs/plugin-react` | client (dev) | Dev server and bundler |
| `react-router-dom` | client | Client-side routing |
| `axios` | client | HTTP client |
| `oxlint` | client (dev) | Linter from the Vite template |

## Next

[Phase 1: Backend foundation](phase-1-backend-foundation.md)
