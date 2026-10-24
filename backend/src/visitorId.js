import { isVisitorId } from '../../shared/visitorRules.js';
import { HttpError } from './errors.js';

export function requireVisitorId(req, res, next) {
  const visitorId = req.get('X-Visitor-Id');
  if (!isVisitorId(visitorId)) throw new HttpError(400, 'X-Visitor-Id must be a valid UUID');
  req.visitorId = visitorId;
  next();
}
