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
| `ADMIN_PASSCODE` | — | Unlocks admin mode; unset/empty refuses every admin request and logs a startup warning |
| `DATABASE_PATH` | `data/feature-board.db` | SQLite file, relative to `/backend` |

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/ideas` | All ideas: `id`, `title`, `description`, `status`, `createdAt`, `voteCount`, sorted by `voteCount DESC, createdAt DESC, id DESC`. Adds `hasVoted` when an `X-Visitor-Id` header is sent. |
| `POST` | `/api/ideas` | Suggest an idea. Body: `{ "title", "description" }`. Title is trimmed and must be 3–80 characters; description is optional, trimmed, up to 500 characters. Any other field (such as `status`) is ignored, so new ideas are always `under_review`. Returns `201` with the new idea; invalid input returns `400` with a message naming the field, e.g. `{ "error": "Title must be 3–80 characters" }`. |
| `POST` | `/api/ideas/:id/vote` | Requires `X-Visitor-Id` (UUID). Returns `200` with the updated idea, including `voteCount` and `hasVoted: true`. Unknown idea → `404`; Shipped or duplicate vote → `409`. |
| `DELETE` | `/api/ideas/:id/vote` | Requires `X-Visitor-Id` (UUID). Removes only that visitor's vote. Returns `200` with the updated idea and `hasVoted: false`; unknown idea or missing vote → `404`. |
| `POST` | `/api/admin/verify` | Requires `X-Admin-Passcode`. Correct passcode → empty `204`; missing, wrong or unconfigured passcode → `403`. |
| `PATCH` | `/api/ideas/:id/status` | Requires `X-Admin-Passcode`. Body: `{ "status": "planned" }`. Returns `200` with the updated idea, including counts and optional visitor-specific `hasVoted`. Unknown status → `400`; passcode problem → `403`; unknown idea → `404`; forbidden transition → `409`. |

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

## Admin and statuses

Set `ADMIN_PASSCODE` in the environment or root `.env`, then start/restart the backend. Click
**Admin**, enter the passcode and select **Unlock admin**. Only a verified passcode enables status
buttons. The passcode stays in `sessionStorage.adminPasscode` for this tab and is checked again on
reload; **Exit admin** clears it. A rejected admin request (`403`) locks the controls and asks you
to enter the passcode again. If session storage is unavailable, admin entry stays locked with an
explanation; public browsing, suggesting and voting (when visitor storage works) remain available.

Allowed changes are **Under review → Planned**, **Planned → Under review**, and **Planned → Shipped**.
Shipped is terminal: it has no status actions and voting is disabled. Both API and UI use the same
transition rules. Pending vote/status changes disable all mutation controls on that card to prevent
overlapping responses. A confirmed status remains visible even if the following list refresh fails;
use **Retry** to refresh. Conflicts refresh the current status before offering the next actions.

Passcodes are compared using fixed-length SHA-256 digests and Node's `timingSafeEqual`; they are
never sent on public API requests. This is simple demo authentication, not accounts or production
access control: use HTTPS and a private passcode rather than the example value. Same-origin scripts
can read session storage. Never put the passcode in a `VITE_*` variable or commit your `.env`.

Playwright supplies its own test-only passcode and creates fresh ideas for admin mutations, leaving
seeded status/count/order fixtures unchanged. API tests cover all three allowed and six blocked
transitions, authorization/validation errors and shipping's effect on voting.
