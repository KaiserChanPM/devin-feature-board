import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { SEED_IDEAS, seed } from '../src/seed.js';

let db;
let app;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db);
});

afterEach(() => {
  if (db.open) db.close();
});

function addIdea({ title, status = 'under_review', createdAt, votes = 0 }) {
  const { lastInsertRowid: id } = db
    .prepare('INSERT INTO ideas (title, status, created_at) VALUES (?, ?, ?)')
    .run(title, status, createdAt);
  for (let i = 0; i < votes; i++) {
    db.prepare('INSERT INTO votes (idea_id, visitor_id) VALUES (?, ?)').run(id, `visitor-${i}`);
  }
  return Number(id);
}

describe('GET /api/ideas', () => {
  it('returns an empty list when there are no ideas', async () => {
    const res = await request(app).get('/api/ideas');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns each idea with its fields and vote count', async () => {
    const id = addIdea({ title: 'Dark mode', status: 'planned', createdAt: '2026-01-01T00:00:00.000Z', votes: 2 });

    const res = await request(app).get('/api/ideas');

    expect(res.body).toEqual([
      {
        id,
        title: 'Dark mode',
        description: '',
        status: 'planned',
        createdAt: '2026-01-01T00:00:00.000Z',
        voteCount: 2,
      },
    ]);
  });

  it('sorts by vote count, then newest first on a tie, then highest id', async () => {
    addIdea({ title: 'Older tie', createdAt: '2026-01-01T00:00:00.000Z', votes: 3 });
    addIdea({ title: 'Most votes', createdAt: '2025-06-01T00:00:00.000Z', votes: 5 });
    addIdea({ title: 'No votes', createdAt: '2026-03-01T00:00:00.000Z', votes: 0 });
    addIdea({ title: 'Newer tie', createdAt: '2026-02-01T00:00:00.000Z', votes: 3 });
    addIdea({ title: 'Same time, lower id', createdAt: '2025-01-01T00:00:00.123Z', votes: 1 });
    addIdea({ title: 'Same time, higher id', createdAt: '2025-01-01T00:00:00.123Z', votes: 1 });

    const res = await request(app).get('/api/ideas');

    expect(res.body.map((idea) => idea.title)).toEqual([
      'Most votes',
      'Newer tie',
      'Older tie',
      'Same time, higher id',
      'Same time, lower id',
      'No votes',
    ]);
    expect(res.body.map((idea) => idea.voteCount)).toEqual([5, 3, 3, 1, 1, 0]);
  });

  it('breaks ties by milliseconds', async () => {
    addIdea({ title: 'Earlier', createdAt: '2026-01-01T00:00:00.001Z', votes: 1 });
    addIdea({ title: 'Later', createdAt: '2026-01-01T00:00:00.002Z', votes: 1 });

    const res = await request(app).get('/api/ideas');

    expect(res.body.map((idea) => idea.title)).toEqual(['Later', 'Earlier']);
  });

  it('leaves out hasVoted when no X-Visitor-Id is sent', async () => {
    addIdea({ title: 'Idea', createdAt: '2026-01-01T00:00:00.000Z', votes: 1 });

    const res = await request(app).get('/api/ideas');

    expect(res.body[0]).not.toHaveProperty('hasVoted');
  });

  it('returns hasVoted for the visitor in X-Visitor-Id', async () => {
    addIdea({ title: 'Voted', createdAt: '2026-01-01T00:00:00.000Z', votes: 2 });
    addIdea({ title: 'Not voted', createdAt: '2026-01-02T00:00:00.000Z', votes: 0 });

    const res = await request(app).get('/api/ideas').set('X-Visitor-Id', 'visitor-1');

    expect(res.body.map(({ title, hasVoted }) => ({ title, hasVoted }))).toEqual([
      { title: 'Voted', hasVoted: true },
      { title: 'Not voted', hasVoted: false },
    ]);
  });
});

describe('errors', () => {
  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found: GET /api/nope' });
  });

  it('returns JSON 400 for a malformed JSON body', async () => {
    const res = await request(app).post('/api/ideas').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });

  it('returns JSON 500 without leaking details when something breaks', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.close();

    const res = await request(app).get('/api/ideas');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('database schema', () => {
  it('defaults new ideas to under_review with a millisecond timestamp', () => {
    db.prepare("INSERT INTO ideas (title) VALUES ('Idea')").run();
    const idea = db.prepare('SELECT status, created_at FROM ideas').get();
    expect(idea.status).toBe('under_review');
    expect(idea.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('rejects an unknown status', () => {
    expect(() => db.prepare("INSERT INTO ideas (title, status) VALUES ('Idea', 'done')").run()).toThrow(/CHECK/);
  });

  it('allows one vote per visitor per idea', () => {
    const id = addIdea({ title: 'Idea', createdAt: '2026-01-01T00:00:00.000Z' });
    const vote = db.prepare("INSERT INTO votes (idea_id, visitor_id) VALUES (?, 'v1')");
    vote.run(id);
    expect(() => vote.run(id)).toThrow(/UNIQUE/);
  });

  it('rejects votes for an idea that does not exist', () => {
    expect(() => db.prepare("INSERT INTO votes (idea_id, visitor_id) VALUES (999, 'v1')").run()).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe('seed', () => {
  it('loads ideas covering every status, with a tie shown newest first', async () => {
    seed(db);
    seed(db); // re-running replaces the data rather than duplicating it

    const res = await request(app).get('/api/ideas');

    expect(res.body).toHaveLength(SEED_IDEAS.length);
    expect(res.body.map(({ title, voteCount }) => [title, voteCount])).toEqual([
      ['Dark mode', 5],
      ['Email me when an idea ships', 3],
      ['Export ideas to CSV', 3],
      ['Keyboard shortcuts', 1],
      ['Comment on ideas', 0],
    ]);
    expect(new Set(res.body.map((idea) => idea.status))).toEqual(new Set(['under_review', 'planned', 'shipped']));
  });
});
