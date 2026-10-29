import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors.js';

const digest = (value) => createHash('sha256').update(value).digest();

export function createAdminCheck(passcode = process.env.ADMIN_PASSCODE) {
  const expected = passcode ? digest(passcode) : null;
  if (!expected) console.warn('ADMIN_PASSCODE is not set; admin requests will be refused.');

  return function requireAdmin(req, res, next) {
    const supplied = req.get('X-Admin-Passcode');
    if (!expected || !supplied || !timingSafeEqual(expected, digest(supplied))) {
      throw new HttpError(403, 'Invalid admin passcode');
    }
    next();
  };
}
