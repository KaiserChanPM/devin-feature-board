async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
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
