import express from 'express';
import { errorHandler, notFound } from './errors.js';
import { ideasRouter } from './routes/ideas.js';
import { createAdminCheck } from './admin.js';

export function createApp(db, { adminPasscode = process.env.ADMIN_PASSCODE } = {}) {
  const app = express();
  const requireAdmin = createAdminCheck(adminPasscode);
  app.use(express.json());

  app.post('/api/admin/verify', requireAdmin, (req, res) => res.sendStatus(204));
  app.use('/api/ideas', ideasRouter(db, requireAdmin));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
