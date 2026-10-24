import { createApp } from './app.js';
import { openDb } from './db.js';

const port = Number(process.env.PORT) || 3001;
const db = openDb();

createApp(db).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
