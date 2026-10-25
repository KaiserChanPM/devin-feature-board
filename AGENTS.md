# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Read [PLAN.md](PLAN.md) for the milestones
and accepted decisions before starting a ticket.

## Layout

```
package.json            npm workspaces root; scripts: dev, seed, test, test:e2e, build
.env.example            PORT, ADMIN_PASSCODE, DATABASE_PATH
shared/
  ideaRules.js          validation rules for a new idea, imported by both backend and frontend
backend/
  src/app.js            createApp(db): builds the Express app; tests pass an in-memory db
  src/db.js             openDb(): opens SQLite, enables foreign keys, creates tables
  src/errors.js         HttpError, 404 handler, JSON error middleware
  src/routes/           one router per resource (ideas.js)
  src/seed.js           demo data + seed(db)
  src/server.js         entry point (listens on PORT, default 3001)
  scripts/seed.js       `npm run seed`
  tests/                Vitest + Supertest API tests
frontend/
  src/api.js            all fetch calls to /api
  src/visitorId.js      persistent browser UUID, or a read-only fallback when storage is unavailable
  src/components/       React components
  src/status.js         status labels
  e2e/                  Playwright tests
  playwright.config.js  starts its own backend + frontend on ports 3101/5174 with a seeded test db
.github/workflows/ci.yml  backend tests + Playwright on every PR
```

## Commands

```bash
npm ci                 # install (Node 24, see .nvmrc)
npm run seed           # reset the dev database to the demo ideas
npm run dev            # backend :3001 + frontend :5173
npm test               # backend tests
npm run test:e2e       # Playwright (run `npx playwright install chromium` once first)
npm run build          # production build of the frontend
```

## Rules

- **Every change includes tests.** API behaviour gets a Vitest + Supertest test in `backend/tests`;
  user-visible flows get a Playwright test in `frontend/e2e`. `npm test` and `npm run test:e2e` must
  pass before opening a PR.
- **Error format:** every API error is JSON `{ "error": "<message>" }`. Throw or `next()` an
  `HttpError(status, message)` from `backend/src/errors.js`; the error middleware formats it.
  Status codes follow PLAN.md decision 3.2 (400 bad input, 403 passcode, 404 not found, 409 conflict).
- Build the app with `createApp(db)`; don't open the database inside routes. Tests use
  `openDb(':memory:')`.
- Rules that both the API and the UI enforce live once in `shared/` (plain ESM, no dependencies),
  imported by relative path from both workspaces. Don't duplicate limits in components or routes.
- Playwright seeds `e2e.db` once per run, so ideas created by one test are visible to the others:
  find ideas by title, not by position or list length.
- Vote e2e tests create their own ideas; do not mutate seeded vote counts/order.
- Vote routes require UUID-formatted `X-Visitor-Id` via `requireVisitorId`; other routes keep it optional.
  Catch `SQLITE_CONSTRAINT_UNIQUE` for duplicate-vote 409, rather than checking before insert.
- Shipped UI controls are disabled; POST rejects Shipped, but DELETE can remove an existing vote.
- Keep confirmed mutation responses visible if a list refresh fails; ignore superseded list responses.
- Statuses are `under_review`, `planned`, `shipped` (enforced by a `CHECK` in `db.js`).
- Sort order for ideas is `voteCount DESC, created_at DESC, id DESC`. `created_at` is ISO-8601 with
  milliseconds so it sorts correctly as text.
- ES modules everywhere (`"type": "module"`). Keep frontend fetch calls in `src/api.js`.
- Update README / AGENTS.md / PLAN.md when a change affects them.
