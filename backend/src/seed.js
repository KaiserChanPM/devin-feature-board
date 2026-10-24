const DAY = 24 * 60 * 60 * 1000;

// Covers every status and includes a tie (3 votes) so tie-breaking and badges show in the demo.
export const SEED_IDEAS = [
  {
    title: 'Dark mode',
    description: 'A dark theme that follows the system setting, for late-night browsing.',
    status: 'planned',
    daysAgo: 20,
    votes: 5,
  },
  {
    title: 'Export ideas to CSV',
    description: 'Download the full list with vote counts so we can share it in planning meetings.',
    status: 'under_review',
    daysAgo: 12,
    votes: 3,
  },
  {
    title: 'Email me when an idea ships',
    description: 'Let people leave an email address and get a note when an idea they care about ships.',
    status: 'under_review',
    daysAgo: 5,
    votes: 3,
  },
  {
    title: 'Keyboard shortcuts',
    description: 'Press "/" to jump to search and "n" to suggest a new feature.',
    status: 'shipped',
    daysAgo: 30,
    votes: 1,
  },
  {
    title: 'Comment on ideas',
    description: 'A short discussion thread under each idea to collect use cases.',
    status: 'under_review',
    daysAgo: 1,
    votes: 0,
  },
];

// Replaces all ideas and votes with SEED_IDEAS. Safe to run repeatedly.
export function seed(db, now = Date.now()) {
  const insertIdea = db.prepare(
    'INSERT INTO ideas (title, description, status, created_at) VALUES (?, ?, ?, ?)',
  );
  const insertVote = db.prepare('INSERT INTO votes (idea_id, visitor_id) VALUES (?, ?)');

  db.transaction(() => {
    db.exec(`DELETE FROM votes; DELETE FROM ideas; DELETE FROM sqlite_sequence;`);
    SEED_IDEAS.forEach((idea, index) => {
      const createdAt = new Date(now - idea.daysAgo * DAY).toISOString();
      const { lastInsertRowid } = insertIdea.run(idea.title, idea.description, idea.status, createdAt);
      for (let v = 1; v <= idea.votes; v++) {
        insertVote.run(lastInsertRowid, `seed-visitor-${index + 1}-${v}`);
      }
    });
  })();
}
