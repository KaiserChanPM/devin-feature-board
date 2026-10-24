# Feature Request Board

A small app where visitors suggest features, vote on them, and an admin moves ideas through
**Under review → Planned → Shipped**. Ideas are sorted by votes, with ties shown newest first.

- `/backend`: Express + SQLite (`better-sqlite3`) API, tested with Vitest + Supertest
- `/frontend`: Vite + React app, tested end to end with Playwright

The build plan, milestones and decisions are in [PLAN.md](PLAN.md).

## Requirements

- Node.js 24 (see [.nvmrc](.nvmrc); anything older than 22.12 won't work with the current dependencies)
- npm 10+

## Install

```bash
nvm use          # optional, picks up .nvmrc
npm ci
cp .env.example .env   # optional, see "Configuration"
```

## Run

```bash
npm run seed     # load 5 demo ideas (wipes existing ideas and votes)
npm run dev      # backend on http://localhost:3001, frontend on http://localhost:5173
```

Open http://localhost:5173. The frontend dev server forwards `/api` to the backend.

## Test

```bash
npm test                              # backend API tests (Vitest + Supertest, in-memory database)
npx playwright install chromium       # once, to download the browser
npm run test:e2e                      # Playwright browser tests
```

The Playwright tests start their own backend (port 3101) and frontend (port 5174) against a freshly
seeded test database (`backend/data/e2e.db`), so they never touch your demo data and can run while
`npm run dev` is running.

## Configuration

Settings are read from the environment, or from a `.env` file in the repo root (see
[.env.example](.env.example)). Real environment variables win over `.env`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | Backend port; the frontend dev proxy follows it |
| `ADMIN_PASSCODE` | — | Unlocks admin mode (from M4) |
| `DATABASE_PATH` | `data/feature-board.db` | SQLite file, relative to `/backend` |

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/ideas` | All ideas: `id`, `title`, `description`, `status`, `createdAt`, `voteCount`, sorted by `voteCount DESC, createdAt DESC, id DESC`. Adds `hasVoted` when an `X-Visitor-Id` header is sent. |
| `POST` | `/api/ideas` | Suggest an idea. Body: `{ "title", "description" }`. Title is trimmed and must be 3–80 characters; description is optional, trimmed, up to 500 characters. Any other field (such as `status`) is ignored, so new ideas are always `under_review`. Returns `201` with the new idea; invalid input returns `400` with a message naming the field, e.g. `{ "error": "Title must be 3–80 characters" }`. |
| `POST` | `/api/ideas/:id/vote` | Requires `X-Visitor-Id` (UUID). Returns `200` with the updated idea, including `voteCount` and `hasVoted: true`. Unknown idea → `404`; Shipped or duplicate vote → `409`. |
| `DELETE` | `/api/ideas/:id/vote` | Requires `X-Visitor-Id` (UUID). Removes only that visitor's vote. Returns `200` with the updated idea and `hasVoted: false`; unknown idea or missing vote → `404`. |

Errors are always JSON: `{ "error": "<message>" }`.

## Voting

The browser generates a `crypto.randomUUID()` once, stores it as `visitorId` in `localStorage`, and
sends it as `X-Visitor-Id` on every API request. The vote routes reject missing/malformed UUIDs with
`400`; listing and suggesting ideas still work without a header. Each browser identity can vote
once per idea, then unvote. Counts and list order refresh from the server after each change.

Shipped ideas have disabled voting controls. The API still allows removing an existing vote from
a Shipped idea, but never adding one. Duplicate votes are rejected by SQLite's unique constraint,
including simultaneous requests.

This is anonymous browser identity, not authentication or abuse prevention. Clearing storage or
using another browser/origin creates a different visitor. `randomUUID()` needs HTTPS or localhost.
If browser storage or secure UUID generation is unavailable, voting is disabled with an explanation;
browsing and suggesting ideas remain available. Reload after enabling storage/HTTPS.
