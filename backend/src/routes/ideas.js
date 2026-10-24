import { Router } from 'express';
import { validateIdea } from '../../../shared/ideaRules.js';
import { HttpError } from '../errors.js';

const IDEA_COLUMNS = `
  i.id,
  i.title,
  i.description,
  i.status,
  i.created_at                                  AS createdAt,
  COUNT(v.id)                                   AS voteCount,
  COALESCE(MAX(v.visitor_id = @visitorId), 0)   AS hasVoted
`;

export function ideasRouter(db) {
  const router = Router();

  const listIdeas = db.prepare(`
    SELECT ${IDEA_COLUMNS}
      FROM ideas i
      LEFT JOIN votes v ON v.idea_id = i.id
     GROUP BY i.id
     ORDER BY voteCount DESC, i.created_at DESC, i.id DESC
  `);

  const getIdea = db.prepare(`
    SELECT ${IDEA_COLUMNS}
      FROM ideas i
      LEFT JOIN votes v ON v.idea_id = i.id
     WHERE i.id = @id
     GROUP BY i.id
  `);

  const insertIdea = db.prepare('INSERT INTO ideas (title, description) VALUES (@title, @description)');

  function toIdea({ hasVoted, ...idea }, visitorId) {
    return visitorId ? { ...idea, hasVoted: hasVoted === 1 } : idea;
  }

  router.get('/', (req, res) => {
    const visitorId = req.get('X-Visitor-Id') || null;
    res.json(listIdeas.all({ visitorId }).map((idea) => toIdea(idea, visitorId)));
  });

  router.post('/', (req, res) => {
    // req.body is undefined when there is no JSON body; validateIdea treats that as a missing title.
    const { value, errors } = validateIdea(req.body);
    const firstError = errors.title ?? errors.description;
    if (firstError) throw new HttpError(400, firstError);

    const visitorId = req.get('X-Visitor-Id') || null;
    const { lastInsertRowid: id } = insertIdea.run(value);
    res.status(201).json(toIdea(getIdea.get({ id, visitorId }), visitorId));
  });

  return router;
}
