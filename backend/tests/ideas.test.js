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

describe('POST /api/ideas', () => {
  const post = (body) => request(app).post('/api/ideas').send(body);

  it('creates an idea and returns it with 201', async () => {
    const res = await post({ title: 'Bulk import', description: 'Upload a CSV of ideas.' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      title: 'Bulk import',
      description: 'Upload a CSV of ideas.',
      status: 'under_review',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      voteCount: 0,
    });

    const list = await request(app).get('/api/ideas');
    expect(list.body).toEqual([res.body]);
  });

  it('defaults a new idea to under_review', async () => {
    const res = await post({ title: 'Bulk import' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('under_review');
    expect(db.prepare('SELECT status FROM ideas WHERE id = ?').get(res.body.id).status).toBe('under_review');
  });

  it('ignores an attempt to set status and other unknown fields', async () => {
    const res = await post({ title: 'Bulk import', status: 'shipped', voteCount: 99, id: 42 });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('under_review');
    expect(res.body.voteCount).toBe(0);
    expect(res.body.id).not.toBe(42);
  });

  it('trims the title and description', async () => {
    const res = await post({ title: '   Bulk import  ', description: '\n  Upload a CSV.  \n' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Bulk import');
    expect(res.body.description).toBe('Upload a CSV.');
  });

  it('allows the description to be left out or empty', async () => {
    const missing = await post({ title: 'No description' });
    const empty = await post({ title: 'Empty description', description: '   ' });

    expect(missing.status).toBe(201);
    expect(missing.body.description).toBe('');
    expect(empty.status).toBe(201);
    expect(empty.body.description).toBe('');
  });

  it('accepts a title of exactly 3 and exactly 80 characters', async () => {
    expect((await post({ title: 'abc' })).status).toBe(201);
    expect((await post({ title: 'a'.repeat(80) })).status).toBe(201);
  });

  it('accepts a description of exactly 500 characters', async () => {
    const res = await post({ title: 'Long description', description: 'd'.repeat(500) });
    expect(res.status).toBe(201);
    expect(res.body.description).toHaveLength(500);
  });

  it('includes hasVoted: false when an X-Visitor-Id is sent', async () => {
    const res = await request(app).post('/api/ideas').set('X-Visitor-Id', 'visitor-1').send({ title: 'Bulk import' });
    expect(res.status).toBe(201);
    expect(res.body.hasVoted).toBe(false);
  });

  it.each([
    ['missing', {}, 'Title is required'],
    ['empty', { title: '' }, 'Title is required'],
    ['whitespace only', { title: '    ' }, 'Title is required'],
    ['too short', { title: 'ab' }, 'Title must be 3–80 characters'],
    ['too short after trimming', { title: '  ab  ' }, 'Title must be 3–80 characters'],
    ['too long', { title: 'a'.repeat(81) }, 'Title must be 3–80 characters'],
    ['not a string', { title: 123 }, 'Title must be text'],
  ])('rejects a title that is %s', async (_, body, error) => {
    const res = await post(body);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(db.prepare('SELECT COUNT(*) AS n FROM ideas').get().n).toBe(0);
  });

  it('rejects a description that is too long', async () => {
    const res = await post({ title: 'Bulk import', description: 'd'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Description must be 500 characters or fewer' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM ideas').get().n).toBe(0);
  });

  it('rejects a description that is not a string', async () => {
    const res = await post({ title: 'Bulk import', description: ['a'] });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Description must be text' });
  });

  it('rejects a request with no body', async () => {
    const res = await request(app).post('/api/ideas');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Title is required' });
  });

  it('rejects a JSON body that is not an object', async () => {
    const res = await request(app).post('/api/ideas').set('Content-Type', 'application/json').send('["Bulk import"]');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Title is required' });
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
