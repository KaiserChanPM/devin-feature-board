import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

const VISITOR = 'f485b4ab-82eb-4a12-b9f1-b1b12dc83397';
const OTHER = 'c7dc6cb1-84cf-4a31-ad74-d6af87d39369';
let db;
let app;
let id;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db);
  id = Number(db.prepare("INSERT INTO ideas (title) VALUES ('Vote for this')").run().lastInsertRowid);
});

afterEach(() => db.close());

const vote = (visitor = VISITOR, ideaId = id) =>
  request(app).post(`/api/ideas/${ideaId}/vote`).set('X-Visitor-Id', visitor);
const unvote = (visitor = VISITOR, ideaId = id) =>
  request(app).delete(`/api/ideas/${ideaId}/vote`).set('X-Visitor-Id', visitor);

describe('vote routes', () => {
  it('votes and unvotes with the updated idea and persisted visitor state', async () => {
    const added = await vote();
    expect(added.status).toBe(200);
    expect(added.body).toMatchObject({ id, title: 'Vote for this', voteCount: 1, hasVoted: true });
    expect((await request(app).get('/api/ideas').set('X-Visitor-Id', VISITOR)).body[0].hasVoted).toBe(true);

    const removed = await unvote();
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ id, voteCount: 0, hasVoted: false });
    expect((await request(app).get('/api/ideas').set('X-Visitor-Id', VISITOR)).body[0].hasVoted).toBe(false);
    expect((await vote()).status).toBe(200);
  });

  it('rejects a duplicate vote with 409 without increasing the count', async () => {
    await vote();
    const res = await vote();
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'You already voted on this idea' });
    expect(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n).toBe(1);
  });

  it('allows only one of two concurrent duplicate votes', async () => {
    const responses = await Promise.all([vote(), vote()]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n).toBe(1);
  });

  it('keeps two visitors independent and only deletes the requesting visitor vote', async () => {
    await vote();
    expect((await vote(OTHER)).body.voteCount).toBe(2);
    expect((await unvote()).body).toMatchObject({ voteCount: 1, hasVoted: false });
    const list = await request(app).get('/api/ideas').set('X-Visitor-Id', OTHER);
    expect(list.body[0]).toMatchObject({ voteCount: 1, hasVoted: true });
  });

  it('returns 404 when this visitor has no vote, including after removing it', async () => {
    await vote(OTHER);
    expect((await unvote()).status).toBe(404);
    await unvote(OTHER);
    const res = await unvote(OTHER);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Vote not found' });
  });

  it('rejects a vote on Shipped, but permits removal of an existing vote', async () => {
    await vote();
    db.prepare("UPDATE ideas SET status = 'shipped' WHERE id = ?").run(id);
    const res = await vote(OTHER);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'Shipped ideas cannot be voted on' });
    expect((await unvote()).body).toMatchObject({ status: 'shipped', voteCount: 0, hasVoted: false });
  });

  it('allows votes on Planned ideas', async () => {
    db.prepare("UPDATE ideas SET status = 'planned' WHERE id = ?").run(id);
    expect((await vote()).status).toBe(200);
  });

  it('accepts UUIDs with uppercase hexadecimal digits', async () => {
    expect((await vote(VISITOR.toUpperCase())).status).toBe(200);
    expect((await unvote(VISITOR.toUpperCase())).status).toBe(200);
  });

  for (const method of ['post', 'delete']) {
    it.each(['999999', 'bad-id', '0', '-1', '1.5', '9007199254740992'])(`${method}: unknown/invalid idea %s returns JSON 404`, async (ideaId) => {
      const res = await request(app)[method](`/api/ideas/${ideaId}/vote`).set('X-Visitor-Id', VISITOR);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Idea not found' });
    });

    it.each([undefined, '', 'visitor-1', 'invalid', `${VISITOR},${OTHER}`, VISITOR.replaceAll('-', '')])(`${method}: rejects missing/malformed visitor %s`, async (visitor) => {
      const req = request(app)[method](`/api/ideas/${id}/vote`);
      if (visitor !== undefined) req.set('X-Visitor-Id', visitor);
      const res = await req;
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'X-Visitor-Id must be a valid UUID' });
      expect(db.prepare('SELECT COUNT(*) AS n FROM votes').get().n).toBe(0);
    });
  }

  it('re-sorts after voting and unvoting, with timestamp and id tie-breaks', async () => {
    db.prepare('UPDATE ideas SET created_at = ?').run('2026-01-01T00:00:00.001Z');
    const later = Number(db.prepare('INSERT INTO ideas (title, created_at) VALUES (?, ?)').run('Later', '2026-01-01T00:00:00.002Z').lastInsertRowid);
    const sameTime = Number(db.prepare('INSERT INTO ideas (title, created_at) VALUES (?, ?)').run('Same time', '2026-01-01T00:00:00.002Z').lastInsertRowid);
    const order = async () => (await request(app).get('/api/ideas')).body.map((idea) => idea.id);
    expect(await order()).toEqual([sameTime, later, id]);
    await vote();
    expect(await order()).toEqual([id, sameTime, later]);
    await vote(VISITOR, later);
    await vote(VISITOR, sameTime);
    expect(await order()).toEqual([sameTime, later, id]);
    await unvote(VISITOR, sameTime);
    expect(await order()).toEqual([later, id, sameTime]);
    await unvote();
    await unvote(VISITOR, later);
    expect(await order()).toEqual([sameTime, later, id]);
  });
});
