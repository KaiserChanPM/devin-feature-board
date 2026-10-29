import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

const PASSCODE = 'test-admin-passcode';
let db;
let app;

beforeEach(() => {
  db = openDb(':memory:');
  app = createApp(db, { adminPasscode: PASSCODE });
  db.prepare("INSERT INTO ideas (title) VALUES ('Admin idea')").run();
});

afterEach(() => {
  db.close();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function adminRequest(path) {
  return path === 'verify'
    ? request(app).post('/api/admin/verify')
    : request(app).patch('/api/ideas/1/status').send({ status: 'planned' });
}

describe('admin authorization', () => {
  it('verifies the correct passcode with an empty 204 response', async () => {
    const res = await adminRequest('verify').set('X-Admin-Passcode', PASSCODE);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  for (const path of ['verify', 'status']) {
    it.each([undefined, '', 'wrong', 'x'.repeat(PASSCODE.length), 'x'.repeat(100), 'é'.repeat(20)])(
      `${path}: refuses missing/wrong passcode %s`, async (passcode) => {
        const req = adminRequest(path);
        if (passcode !== undefined) req.set('X-Admin-Passcode', passcode);
        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Invalid admin passcode' });
        expect(db.prepare('SELECT status FROM ideas').get().status).toBe('under_review');
      },
    );

    it.each([undefined, ''])(`${path}: fails closed and warns when configuration is %s`, async (passcode) => {
      vi.stubEnv('ADMIN_PASSCODE', passcode);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      app = createApp(db);
      expect(warn).toHaveBeenCalledExactlyOnceWith('ADMIN_PASSCODE is not set; admin requests will be refused.');
      for (const supplied of ['', PASSCODE]) {
        const res = await adminRequest(path).set('X-Admin-Passcode', supplied);
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Invalid admin passcode' });
      }
      expect((await request(app).get('/api/ideas')).status).toBe(200);
    });
  }

  it('compares unequal UTF-8 byte lengths without throwing', async () => {
    app = createApp(db, { adminPasscode: 'é' });
    expect((await adminRequest('verify').set('X-Admin-Passcode', 'a')).status).toBe(403);
    expect((await adminRequest('verify').set('X-Admin-Passcode', 'é')).status).toBe(204);
  });
});
