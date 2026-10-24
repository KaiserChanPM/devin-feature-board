import express from 'express';
import { errorHandler, notFound } from './errors.js';
import { ideasRouter } from './routes/ideas.js';

export function createApp(db) {
  const app = express();
  app.use(express.json());

  app.use('/api/ideas', ideasRouter(db));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
