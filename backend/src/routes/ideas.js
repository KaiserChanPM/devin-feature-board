import { Router } from 'express';

export function ideasRouter(db) {
  const router = Router();

  const listIdeas = db.prepare(`
    SELECT i.id,
           i.title,
           i.description,
           i.status,
           i.created_at                                  AS createdAt,
           COUNT(v.id)                                   AS voteCount,
           COALESCE(MAX(v.visitor_id = @visitorId), 0)   AS hasVoted
      FROM ideas i
      LEFT JOIN votes v ON v.idea_id = i.id
     GROUP BY i.id
     ORDER BY voteCount DESC, i.created_at DESC, i.id DESC
  `);

  router.get('/', (req, res) => {
    const visitorId = req.get('X-Visitor-Id') || null;
    const ideas = listIdeas.all({ visitorId }).map(({ hasVoted, ...idea }) =>
      visitorId ? { ...idea, hasVoted: hasVoted === 1 } : idea,
    );
    res.json(ideas);
  });

  return router;
}
