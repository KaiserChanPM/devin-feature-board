import { getVisitorIdentity } from './visitorId.js';

async function request(path, options = {}) {
  const { id } = getVisitorIdentity();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...(id && { 'X-Visitor-Id': id }), ...options.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(body?.error ?? `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return body;
}

export function fetchIdeas() {
  return request('/ideas');
}

export function createIdea({ title, description }) {
  return request('/ideas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });
}

export function changeVote(id, hasVoted) {
  return request(`/ideas/${id}/vote`, { method: hasVoted ? 'DELETE' : 'POST' });
}

export function verifyAdmin(passcode) {
  return request('/admin/verify', {
    method: 'POST',
    headers: { 'X-Admin-Passcode': passcode },
  });
}

export function changeStatus(id, status, passcode) {
  return request(`/ideas/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Passcode': passcode },
    body: JSON.stringify({ status }),
  });
}
