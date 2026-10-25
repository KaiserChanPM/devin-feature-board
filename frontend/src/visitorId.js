import { isVisitorId } from '../../shared/visitorRules.js';

let identity;

export function getVisitorIdentity() {
  if (identity) return identity;
  try {
    let id = localStorage.getItem('visitorId');
    if (!isVisitorId(id)) {
      id = crypto.randomUUID();
      localStorage.setItem('visitorId', id);
    }
    identity = { id, error: null };
  } catch {
    identity = {
      id: null,
      error: 'Voting is unavailable. Enable browser storage and use HTTPS (or localhost), then reload. You can still browse and suggest ideas.',
    };
  }
  return identity;
}
