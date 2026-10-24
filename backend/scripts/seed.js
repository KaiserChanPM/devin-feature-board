import { openDb } from '../src/db.js';
import { SEED_IDEAS, seed } from '../src/seed.js';

const db = openDb();
seed(db);
db.close();
console.log(`Seeded ${SEED_IDEAS.length} ideas into ${db.name}`);
