import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

const PASSCODE = 'test-admin-passcode';
const VISITOR = 'f485b4ab-82eb-4a12-b9f1-b1b12dc83397';
const STATES = ['under_review', 'planned', 'shipped'];
const ALLOWED = ['under_review:planned', 'planned:under_review', 'planned:shipped'];
let db;
let app;
let id;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db, { adminPasscode: PASSCODE });
  id = Number(db.prepare("INSERT INTO ideas (title, description) VALUES ('Admin idea', 'Details')").run().lastInsertRowid);
});

afterEach(() => db.close());

const patch = (status, ideaId = id) => request(app).patch(`/api/ideas/${ideaId}/status`)
  .set('X-Admin-Passcode', PASSCODE).send({ status });

describe('PATCH /api/ideas/:id/status', () => {
  for (const from of STATES) {
    for (const to of STATES) {
      const allowed = ALLOWED.includes(`${from}:${to}`);
      it(`${allowed ? 'allows' : 'blocks'} ${from} → ${to}`, async () => {
        db.prepare('UPDATE ideas SET status = ? WHERE id = ?').run(from, id);
        const before = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
        const res = await patch(to);
        expect(res.status).toBe(allowed ? 200 : 409);
        if (allowed) {
          expect(res.body).toEqual({ id, title: before.title, description: before.description,
            status: to, createdAt: before.created_at, voteCount: 0 });
        } else {
          expect(res.body).toEqual({ error: 'Status change not allowed' });
        }
        expect(db.prepare('SELECT * FROM ideas WHERE id = ?').get(id)).toEqual({ ...before, status: allowed ? to : from });
      });
    }
  }

  it('preserves vote counts and visitor-specific state', async () => {
    await request(app).post(`/api/ideas/${id}/vote`).set('X-Visitor-Id', VISITOR);
    const res = await patch('planned').set('X-Visitor-Id', VISITOR);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ voteCount: 1, hasVoted: true, status: 'planned' });
    const list = await request(app).get('/api/ideas').set('X-Visitor-Id', VISITOR);
    expect(list.body).toEqual([res.body]);
  });

  it.each(['999999', 'bad-id', '0', '-1', '1.5', '9007199254740992'])('returns JSON 404 for unknown/invalid idea %s', async (ideaId) => {
    const res = await patch('planned', ideaId);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Idea not found' });
  });

  it.each([undefined, null, '', 'done', 'PLANNED', ' planned ', 1, [], {}, 'toString', '__proto__'])(
    'returns JSON 400 for unknown status %s', async (status) => {
      const res = await patch(status);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Unknown status' });
      expect(db.prepare('SELECT status FROM ideas').get().status).toBe('under_review');
    },
  );

  it('rejects missing, array and malformed bodies', async () => {
    for (const body of [undefined, '[]', '{bad']) {
      const req = request(app).patch(`/api/ideas/${id}/status`).set('X-Admin-Passcode', PASSCODE);
      if (body !== undefined) req.set('Content-Type', 'application/json').send(body);
      const res = await req;
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
    }
  });

  it('only accepts one of two simultaneous transitions to Planned', async () => {
    const responses = await Promise.all([patch('planned'), patch('planned')]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(db.prepare('SELECT status FROM ideas').get().status).toBe('planned');
  });

  it('ships through the API, rejects new votes, but permits deleting an existing vote', async () => {
    await request(app).post(`/api/ideas/${id}/vote`).set('X-Visitor-Id', VISITOR);
    expect((await patch('planned')).status).toBe(200);
    expect((await patch('shipped')).status).toBe(200);
    const vote = await request(app).post(`/api/ideas/${id}/vote`).set('X-Visitor-Id', VISITOR);
    expect(vote.status).toBe(409);
    expect(vote.body).toEqual({ error: 'Shipped ideas cannot be voted on' });
    const removed = await request(app).delete(`/api/ideas/${id}/vote`).set('X-Visitor-Id', VISITOR);
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ status: 'shipped', voteCount: 0, hasVoted: false });
  });
});
