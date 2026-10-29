import { Router } from 'express';
import { validateIdea } from '../../../shared/ideaRules.js';
import { allowedStatuses, STATUSES } from '../../../shared/statusRules.js';
import { HttpError } from '../errors.js';
import { requireVisitorId } from '../visitorId.js';

const IDEA_COLUMNS = `
  i.id,
  i.title,
  i.description,
  i.status,
  i.created_at                                  AS createdAt,
  COUNT(v.id)                                   AS voteCount,
  COALESCE(MAX(v.visitor_id = @visitorId), 0)   AS hasVoted
`;

export function ideasRouter(db, requireAdmin) {
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
  const insertVote = db.prepare('INSERT INTO votes (idea_id, visitor_id) VALUES (@id, @visitorId)');
  const deleteVote = db.prepare('DELETE FROM votes WHERE idea_id = @id AND visitor_id = @visitorId');
  const updateStatus = db.prepare('UPDATE ideas SET status = @status WHERE id = @id');
  const changeStatus = db.transaction((params, status) => {
    const idea = getIdea.get(params);
    if (!idea) throw new HttpError(404, 'Idea not found');
    if (!allowedStatuses(idea.status).includes(status)) {
      throw new HttpError(409, 'Status change not allowed');
    }
    updateStatus.run({ id: params.id, status });
    return getIdea.get(params);
  });

  function voteParams(req) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, 'Idea not found');
    const params = { id, visitorId: req.visitorId };
    if (!getIdea.get(params)) throw new HttpError(404, 'Idea not found');
    return params;
  }

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

  router.patch('/:id/status', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(404, 'Idea not found');
    const status = req.body?.status;
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');
    const visitorId = req.get('X-Visitor-Id') || null;
    res.json(toIdea(changeStatus.immediate({ id, visitorId }, status), visitorId));
  });

  router.post('/:id/vote', requireVisitorId, (req, res) => {
    const params = voteParams(req);
    if (getIdea.get(params).status === 'shipped') throw new HttpError(409, 'Shipped ideas cannot be voted on');
    try {
      insertVote.run(params);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new HttpError(409, 'You already voted on this idea');
      throw err;
    }
    res.json(toIdea(getIdea.get(params), params.visitorId));
  });

  router.delete('/:id/vote', requireVisitorId, (req, res) => {
    const params = voteParams(req);
    if (deleteVote.run(params).changes === 0) throw new HttpError(404, 'Vote not found');
    res.json(toIdea(getIdea.get(params), params.visitorId));
  });

  return router;
}
