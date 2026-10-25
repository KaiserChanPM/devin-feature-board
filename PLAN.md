# Feature Request Board: Build Plan

Source: *Feature Request Board PRD* (Oct 24, 2026). Status: **accepted (Oct 24, 2026) with all recommendations below.**

---

## 1. Development sequence

```
M0 Prerequisites (you)
   │
   ▼
M1 Set up and list ideas ──► merge
   │
   ▼
M2 Suggest a feature ──────► merge
   │
   ▼
M3 Vote ───────────────────► merge ──► W1 DeepWiki outline (.devin/wiki.json)
   │                                        │
   ▼                                        ▼
M4 Admin and statuses ─────► merge     D7 Ask/DeepWiki rehearsal
   │
   ▼
D1–D6 Demo task rehearsals (D1 ∥ D2 run in parallel)
   │
   ▼
D6 Bug-fix setup (merge the sabotage last), then live session
```

All four milestones run **one after another**: one Linear ticket, one Devin session, one PR each, merged before the next one starts (as the PRD says). They can't safely run in parallel anyway, because M2, M3 and M4 all edit the same files: the ideas router, the idea card component and the API client.

| Step | Ticket | Depends on | Mode | Owner |
| --- | --- | --- | --- | --- |
| 0 | M0 Prerequisites | — | — | You |
| 1 | M1 Set up and list ideas | M0 | Normal | Devin |
| 2 | M2 Suggest a feature | M1 merged | Normal | Devin |
| 3 | M3 Vote | M2 merged | Normal | Devin |
| 4 | W1 DeepWiki outline | M3 merged | Lite/Normal | Devin |
| 5 | M4 Admin and statuses | M3 merged | Normal | Devin |
| 6 | D1–D7 demo rehearsals | M4 merged (D7 needs only M3) | per task | Devin |

W1 and M4 touch different files (`.devin/` vs app code), so they can run at the same time.

---

## 2. Milestones and tickets

Each milestone is **one Linear ticket**. The numbered sub-tasks are the checklist inside that ticket, listed in build order. A sub-task depends on the ones above it unless marked otherwise.

### M0 Prerequisites (you, before M1)

| # | Task | Why it blocks |
| --- | --- | --- |
| 0.1 | Create the empty public `devin-feature-board` repo on GitHub and give Devin's GitHub app access to it | M1 needs a repo to push to (recommended: create it yourself, as the PRD suggests) |
| 0.2 | Connect Linear (Settings → Organization → Connections → Linear) and check it by labelling a test ticket `!plan` | Tickets drive the sessions |
| 0.3 | Upgrade to Pro and set a spending limit | Budget open question; about 4 milestone sessions + 1 wiki + 7 demo rehearsals |
| 0.4 | Turn on Computer use (Settings → Devin → Sessions) | Needed for the screen recordings in every milestone |

### M1 Set up and list ideas — *Normal*
**Done when:** both apps start with one command; seeded ideas show, sorted by votes with ties newest first; one API test and the browser test pass; README, AGENTS.md and PLAN.md are in the repo; the environment blueprint shows Success.

| # | Sub-task |
| --- | --- |
| 1.1 | Repo layout: root `package.json` with npm workspaces (`/backend`, `/frontend`), `.gitignore` (SQLite file, `node_modules`, `.env`), `.env.example` with `ADMIN_PASSCODE` and `PORT` |
| 1.2 | Backend skeleton: Express app built by a function, `createApp(db)`, so tests can pass in an in-memory database; JSON error middleware that returns `{ "error": "<message>" }` |
| 1.3 | Database module (`better-sqlite3`): create the `ideas` and `votes` tables on startup, with the `CHECK` on status, the default `under_review`, `UNIQUE(idea_id, visitor_id)` and a foreign key to ideas |
| 1.4 | `GET /api/ideas`: returns id, title, description, status, createdAt and voteCount (counted from `votes`), sorted by `voteCount DESC, created_at DESC, id DESC`. Also returns `hasVoted` when `X-Visitor-Id` is sent (needed in M3; costs nothing to add now) |
| 1.5 | Seed script (`npm run seed`): 5 ideas with different vote counts (made-up visitor IDs), at least one tie and every status, so tie-breaking and badges show in the demo |
| 1.6 | Frontend skeleton: Vite + React, a dev proxy sending `/api` to the backend, a header with the app name (Admin button is a placeholder until M4) |
| 1.7 | Idea list: title, description, vote count (read-only for now), status badge, empty-state message, layout that works at phone width |
| 1.8 | One command to run both apps: root `npm run dev` using `concurrently` (backend :3001, frontend :5173) |
| 1.9 | Tests: Vitest + Supertest API test for sorting, including the tie-break; Playwright test (`/frontend`) that starts both servers against a fresh seeded test database and checks the list order |
| 1.10 | GitHub Actions CI: install, backend tests, Playwright. *Not in the PRD; recommended so "all tests passing" shows as a PR check* |
| 1.11 | Docs: README (install, run, seed, test), AGENTS.md (folder layout, commands, "every change includes tests", error format), PLAN.md (this plan) |
| 1.12 | Devin environment blueprint: `npm ci`, `npx playwright install --with-deps chromium`, seed; check that it shows Success |

### M2 Suggest a feature — *Normal*
**Done when:** the form posts a new idea that shows in the list as Under review; invalid titles and over-long descriptions show errors and the API rejects them; tests cover valid and invalid input.

| # | Sub-task |
| --- | --- |
| 2.1 | Shared validation rules: title is trimmed, required, 3–80 characters; description is optional, trimmed, ≤500 characters. Unknown fields such as `status` are ignored, so a new idea is always `under_review` |
| 2.2 | `POST /api/ideas`: returns 201 with the created idea; invalid input returns 400 with a field-specific message |
| 2.3 | "Suggest a feature" form: inline errors from both the browser checks and the API error message; the form clears after a successful post; the list refreshes |
| 2.4 | API tests: valid post, a title missing / too short / too long / whitespace only, a description that's too long, an attempt to set `status`, and the new idea's default status |
| 2.5 | Extend the Playwright test: post an idea and see it in the list as Under review |
| 2.6 | Update README/PLAN.md if anything changed |

### M3 Vote — *Normal*
**Done when:** a browser can vote once per idea and remove its vote; the list re-sorts; Shipped ideas can't be voted on; tests cover duplicate votes, removing a vote, voting on Shipped and tie-breaking.

| # | Sub-task |
| --- | --- |
| 3.1 | Visitor ID middleware: `X-Visitor-Id` is required on vote routes (missing or badly formed → 400) |
| 3.2 | `POST /api/ideas/:id/vote`: unknown idea → 404; Shipped → 409; already voted → 409 (relies on the unique constraint, so two requests at once are also safe); returns the updated count and `hasVoted` |
| 3.3 | `DELETE /api/ideas/:id/vote`: unknown idea → 404; this visitor hasn't voted → 404; otherwise 200 with the updated count |
| 3.4 | Frontend visitor ID: `crypto.randomUUID()` saved in `localStorage` on first visit and sent on every request |
| 3.5 | Vote button: switches between vote and unvote, shows whether this browser has voted, is disabled on Shipped ideas, and the list re-sorts afterwards |
| 3.6 | API tests: vote, duplicate vote returns 409, removing a vote, removing a vote that doesn't exist, voting on Shipped, unknown idea, missing visitor ID, two visitors on the same idea, tie-break after votes |
| 3.7 | Extend the Playwright test: vote, re-sort, unvote |

M3 contract details: vote routes require UUID-formatted visitor headers and return the updated idea
(200, with `voteCount` and `hasVoted`). List/create headers remain optional. Shipped controls are
disabled; POST rejects Shipped, while DELETE may remove an existing vote. Browser identity uses
`localStorage.visitorId`; unavailable storage/secure UUID generation leaves browsing and suggesting
available but disables voting with an explanation. Mutations retain confirmed state if refresh fails,
and superseded list responses are ignored. Browser tests create their own voting ideas to preserve
the seeded counts used by list regressions.

### W1 DeepWiki outline — *Lite or Normal*, after M3

| # | Sub-task |
| --- | --- |
| W.1 | `.devin/wiki.json` with these pages: Product Overview, Architecture, Data Model, "How a vote flows" (plain language) |
| W.2 | Regenerate the wiki and check that the four pages read well |

### M4 Admin and statuses — *Normal*
**Done when:** the passcode unlocks status buttons; only allowed changes are offered and accepted; a wrong passcode is rejected; tests cover every allowed and blocked change.

| # | Sub-task |
| --- | --- |
| 4.1 | One list of allowed status changes, used by both the API and the UI: `under_review→planned`, `planned→under_review`, `planned→shipped` |
| 4.2 | Admin check middleware: compares `X-Admin-Passcode` with `ADMIN_PASSCODE` using a constant-time comparison; wrong or missing passcode → 403; `ADMIN_PASSCODE` not set → every admin call is refused and the server logs a warning |
| 4.3 | `PATCH /api/ideas/:id/status`: unknown idea → 404; unknown status value → 400; status change not allowed → 409; otherwise 200 with the updated idea |
| 4.4 | Passcode check endpoint `POST /api/admin/verify`: 204 if the passcode is right, 403 if not |
| 4.5 | Admin UI: the Admin button asks for the passcode, checks it, and keeps it in `sessionStorage`; shows only the buttons allowed from each idea's current status; has an exit-admin control; if the API returns 403, admin mode turns off with a message |
| 4.6 | API tests: all 3 allowed changes, all 6 blocked ones (including same→same and anything from Shipped), wrong / missing passcode, passcode not set, unknown idea, unknown status. Plus one test across features: an idea becomes Shipped, then a vote on it returns 409 |
| 4.7 | Extend the Playwright test: unlock admin, move an idea to Planned, then Shipped; its vote button becomes disabled |

### Demo tasks (rehearsals after M4; kept as separate tickets, not built in the milestones)

| ID | Task | Depends on | Mode | Notes |
| --- | --- | --- | --- | --- |
| D1 | Status filter tabs | M4 | Normal | Frontend only; filters on the page using the `status` already in `GET /api/ideas` |
| D2 | Edge-case tests for votes and statuses | M4 | Lite | Only `/backend/tests` |
| D3 | Run D1 and D2 at the same time | D1, D2 ready | Both | Safe because they touch different folders |
| D4 | Idea count, once in Lite and once in Normal, on separate branches | M4 | Lite + Normal | Compare cost and whether checks pass; don't merge both |
| D5 | Release notes from merged PRs | M4 (+ any D merges) | Lite | Grouped into New / Improved / Fixed |
| D6 | Tie-break bug: merge the sabotage change, file the report, Devin fixes it | M4; do it **last** | Normal | See note 4.5 |
| D7 | Ask Devin / DeepWiki: "How does a vote flow…?" | M3 + W1 | Ask | Can be rehearsed while M4 is being built |

---

## 3. Decisions (accepted)

| # | Decision |
| --- | --- |
| 3.1 | Add `POST /api/admin/verify` (204 or 403) so the passcode is checked when it's entered (M4, sub-task 4.4) |
| 3.2 | Error codes: 400 bad input · 403 passcode problem · 404 unknown idea or a vote that doesn't exist · **409** for a status change that isn't allowed, voting on Shipped, and duplicate votes |
| 3.3 | Add GitHub Actions CI in M1 (sub-task 1.10) |
| 3.4 | The DeepWiki outline (W1) comes after M3, not M2 |

---

## 4. PRD review notes (gaps and risks)

1. **Tie-break and timestamps.** If `created_at` is stored to the second, the seed script inserts all 5 ideas in the same second and the "newest first" order becomes unpredictable. The plan stores milliseconds (ISO) and adds `id DESC` as a final tie-break.
2. **Visitor ID on `GET`.** `hasVoted` needs `X-Visitor-Id` on the list request too, not just on the vote routes. It's added in M1 so M3 doesn't have to change the API's shape.
3. **Status badge in M1.** The seed data includes every status, so M1 shows the badges read-only. M4 adds only the controls.
4. **Separate test databases.** API tests use a database in memory. Playwright uses its own file that it seeds itself, so tests never touch your demo data.
5. **Demo bug (D6) vs CI.** The tie-break tests from M1/M3 will fail on the sabotage change. Either merge it with CI bypassed, or have it also weaken that test, which makes it a more believable bug. Also, simply removing `created_at DESC` makes ties come back **oldest first** (insertion order), which is predictable, not "random". To match the report's wording, the sabotage should sort ties by something unstable, or the report should say "wrong order".
6. **Wiki timing.** The PRD puts `.devin/wiki.json` after M2, but its "How a vote flows" page would describe a feature that doesn't exist until M3. Moving it to right after M3 is the better order; it can still be written while M4 is being built.
7. **Unspecified edge cases now settled:** titles are trimmed before the length check; `status` sent on create is ignored; removing a vote you never cast returns 404; same→same and any change from Shipped are blocked; a missing `ADMIN_PASSCODE` refuses all admin calls.
8. **Native module and Node version.** `better-sqlite3` needs a native build step. The current major versions of the core libraries (`better-sqlite3` 13, Vitest 5, `concurrently` 10, Vite 8) need Node 22.12 or newer, so the project is pinned to **Node 24 LTS** (`.nvmrc`, used by CI and the blueprint). `better-sqlite3` installs from a prebuilt binary on Node 24. Fallback: Node's built-in `node:sqlite`.

---

## 5. Per-milestone "show me" checklist
- PR link, all checks green (backend tests + Playwright)
- Screen recording of Devin using the new feature in its browser
- README / AGENTS.md / PLAN.md updated if the change affects them
