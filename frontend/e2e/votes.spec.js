import { expect, test } from '@playwright/test';

async function createIdea(request, label) {
  const res = await request.post('/api/ideas', { data: { title: `${label} ${crypto.randomUUID()}` } });
  expect(res.status()).toBe(201);
  return res.json();
}

function card(page, idea) {
  return page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: idea.title, exact: true }) });
}

test('votes, re-sorts, persists across reload and tabs, then unvotes', async ({ page, request, context }) => {
  const older = await createIdea(request, 'Older voting idea');
  const newer = await createIdea(request, 'Newer voting idea');
  const headers = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) headers.push(req.headers()['x-visitor-id']);
  });
  await page.goto('/');
  const item = card(page, older);
  const order = async () => (await page.getByRole('listitem').getByRole('heading').allTextContents())
    .filter((title) => [older.title, newer.title].includes(title));
  await expect(item.getByLabel('0 votes')).toBeVisible();
  expect(await order()).toEqual([newer.title, older.title]);
  await item.getByRole('button', { name: `Vote for ${older.title}`, exact: true }).click();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  await expect(item.getByText('You voted', { exact: true })).toBeVisible();
  await expect(item.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(order).toEqual([older.title, newer.title]);
  const id = await page.evaluate(() => localStorage.getItem('visitorId'));
  expect(id).toMatch(/^[0-9a-f-]{36}$/);

  await page.reload();
  await expect(item.getByRole('button', { name: `Remove vote from ${older.title}` })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('visitorId'))).toBe(id);
  const tab = await context.newPage();
  await tab.goto('/');
  await expect(card(tab, older).getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  expect(await tab.evaluate(() => localStorage.getItem('visitorId'))).toBe(id);
  await tab.close();

  await item.getByRole('button', { name: `Remove vote from ${older.title}` }).click();
  await expect(item.getByLabel('0 votes')).toBeVisible();
  await expect(item.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(order).toEqual([newer.title, older.title]);
  expect(headers.length).toBeGreaterThanOrEqual(5);
  expect(headers.every((value) => value === id)).toBe(true);
});

test('disables voting on Shipped ideas', async ({ page }) => {
  await page.goto('/');
  const item = card(page, { title: 'Keyboard shortcuts' });
  await expect(item.getByText('Voting closed')).toBeVisible();
  await expect(item.getByRole('button')).toBeDisabled();
});

test('prevents repeat submissions while saving', async ({ page, request }) => {
  const idea = await createIdea(request, 'Pending vote');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  await page.route(`**/api/ideas/${idea.id}/vote`, async (route) => {
    calls++;
    await gate;
    await route.continue();
  });
  await page.goto('/');
  const button = card(page, idea).getByRole('button');
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveText('Saving…');
  await expect(button).toHaveAttribute('aria-busy', 'true');
  release();
  await expect(button).toBeEnabled();
  await expect(card(page, idea).getByLabel('1 vote', { exact: true })).toBeVisible();
  expect(calls).toBe(1);
});

test('shows mutation errors, refreshes conflicting state, and allows retry', async ({ page, request }) => {
  const idea = await createIdea(request, 'Vote retry');
  await page.route(`**/api/ideas/${idea.id}/vote`, (route) =>
    route.fulfill({ status: 409, json: { error: 'You already voted on this idea' } }),
  );
  await page.goto('/');
  const item = card(page, idea);
  await item.getByRole('button').click();
  await expect(item.getByRole('alert')).toHaveText("Couldn't save your vote: You already voted on this idea");
  await expect(item.getByLabel('0 votes')).toBeVisible();
  await expect(item.getByRole('button')).toBeEnabled();
  await page.unroute(`**/api/ideas/${idea.id}/vote`);
  await item.getByRole('button').click();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  await expect(item.getByRole('alert')).toHaveCount(0);
});

test('keeps a confirmed vote visible if list refresh fails, then retries', async ({ page, request }) => {
  const idea = await createIdea(request, 'Refresh retry');
  await page.goto('/');
  const item = card(page, idea);
  await expect(item.getByRole('button')).toBeVisible();
  await page.route('**/api/ideas', (route) => route.fulfill({ status: 500, json: { error: 'Try again later' } }));
  await item.getByRole('button').click();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  await expect(item.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('alert')).toContainText("Couldn't load ideas: Try again later");
  await expect(item.getByRole('button')).toBeEnabled();
  await page.unroute('**/api/ideas');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
});

test('ignores an older list response arriving after a vote refresh', async ({ page, request }) => {
  const idea = await createIdea(request, 'Stale response');
  await page.goto('/');
  const item = card(page, idea);
  await expect(item.getByRole('button')).toBeVisible();
  let release;
  let captured;
  const gate = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { captured = resolve; });
  let reads = 0;
  await page.route('**/api/ideas', async (route) => {
    if (route.request().method() !== 'GET' || reads++ > 0) return route.continue();
    const response = await route.fetch();
    captured();
    await gate;
    await route.fulfill({ response });
  });
  const form = page.getByRole('region', { name: 'Suggest a feature' });
  await form.getByLabel('Title').fill(`Trigger refresh ${crypto.randomUUID()}`);
  await form.getByRole('button', { name: 'Submit idea' }).click();
  await started;
  await item.getByRole('button').click();
  await expect(item.getByRole('button')).toBeEnabled();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  const staleFinished = page.waitForResponse((res) => res.url().endsWith('/api/ideas') && res.request().method() === 'GET');
  release();
  await staleFinished;
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  await expect(item.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
});

test('replaces a malformed stored visitor ID and sends identity on idea creation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('visitorId', 'invalid'));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dark mode', exact: true })).toBeVisible();
  const id = await page.evaluate(() => localStorage.getItem('visitorId'));
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const form = page.getByRole('region', { name: 'Suggest a feature' });
  await form.getByLabel('Title').fill(`Identity header ${crypto.randomUUID()}`);
  const sent = page.waitForRequest((req) => req.method() === 'POST' && req.url().endsWith('/api/ideas'));
  await form.getByRole('button', { name: 'Submit idea' }).click();
  expect((await sent).headers()['x-visitor-id']).toBe(id);
  await expect(form.getByRole('status')).toBeVisible();
});

test('preserves browsing and suggestions when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Storage denied', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Voting is unavailable');
  await expect(card(page, { title: 'Dark mode' }).getByRole('button')).toBeDisabled();
  const form = page.getByRole('region', { name: 'Suggest a feature' });
  await form.getByLabel('Title').fill(`Storage blocked ${crypto.randomUUID()}`);
  await form.getByRole('button', { name: 'Submit idea' }).click();
  await expect(form.getByRole('status')).toBeVisible();
});
