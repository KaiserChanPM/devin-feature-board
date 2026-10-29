import { expect, test } from '@playwright/test';

const PASSCODE = 'e2e-admin-passcode';

async function createIdea(request, label) {
  const res = await request.post('/api/ideas', { data: { title: `${label} ${crypto.randomUUID()}` } });
  expect(res.status()).toBe(201);
  return res.json();
}

const card = (page, idea) => page.getByRole('listitem')
  .filter({ has: page.getByRole('heading', { name: idea.title, exact: true }) });

async function unlock(page, passcode = PASSCODE) {
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.getByLabel('Admin passcode', { exact: true }).fill(passcode);
  await page.getByRole('button', { name: 'Unlock admin', exact: true }).click();
}

test('rejects a wrong passcode, then plans and ships an idea with voting closed', async ({ page, request }) => {
  const idea = await createIdea(request, 'Admin lifecycle');
  const adminHeaders = [];
  page.on('request', (req) => {
    if (new URL(req.url()).pathname.startsWith('/api/')) {
      adminHeaders.push([new URL(req.url()).pathname, req.headers()['x-admin-passcode']]);
    }
  });
  await page.goto('/');
  const item = card(page, idea);
  await expect(item.getByRole('group')).toHaveCount(0);
  await unlock(page, 'wrong-passcode');
  await expect(page.getByRole('alert')).toContainText('Invalid admin passcode');
  await expect(item.getByRole('group')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBeNull();

  await page.getByLabel('Admin passcode', { exact: true }).fill(PASSCODE);
  await page.getByRole('button', { name: 'Unlock admin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit admin' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBe(PASSCODE);
  await expect(item.getByRole('group').getByRole('button')).toHaveText(['Move to Planned']);
  await item.getByRole('button', { name: `Vote for ${idea.title}`, exact: true }).click();
  await expect(item.getByText('You voted', { exact: true })).toBeVisible();
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
  await expect(item.getByRole('group').getByRole('button')).toHaveText(['Move to Under review', 'Move to Shipped']);
  await item.getByRole('button', { name: 'Move to Shipped', exact: true }).click();
  await expect(item.getByText('Shipped', { exact: true })).toBeVisible();
  await expect(item.getByRole('group')).toHaveCount(0);
  await expect(item.getByRole('button', { name: `Remove vote from ${idea.title}` })).toBeDisabled();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
  await expect(item.getByText('You voted', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Exit admin' })).toBeVisible();
  await expect(item.getByText('Shipped', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit admin' }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBeNull();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Admin', exact: true })).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(0);
  expect(adminHeaders.filter(([, code]) => code).every(([path]) =>
    path === '/api/admin/verify' || path.endsWith('/status'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('adminPasscode'))).toBeNull();
});

test('allows Planned to return to Under review and fits at phone width', async ({ page, request }) => {
  const idea = await createIdea(request, 'Reverse status');
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await unlock(page);
  const item = card(page, idea);
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await item.getByRole('button', { name: 'Move to Under review', exact: true }).click();
  await expect(item.getByText('Under review', { exact: true })).toBeVisible();
  await expect(item.getByRole('group').getByRole('button')).toHaveText(['Move to Planned']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('a status 403 clears stored credentials and locks every card with an explanation', async ({ page, request }) => {
  const idea = await createIdea(request, 'Expired admin');
  await page.goto('/');
  await unlock(page);
  await page.route(`**/api/ideas/${idea.id}/status`, (route) =>
    route.fulfill({ status: 403, json: { error: 'Invalid admin passcode' } }));
  await card(page, idea).getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit admin' })).toHaveCount(0);
  await expect(page.getByRole('group')).toHaveCount(0);
  await expect(page.getByRole('banner').getByRole('alert')).toContainText('Admin session expired');
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBeNull();
});

test('reverifies and removes a rejected saved passcode before showing admin controls', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('adminPasscode', 'stale-passcode'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Invalid admin passcode');
  await expect(page.getByRole('group')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBeNull();
});

test('storage failures leave public browsing working but admin locked', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === sessionStorage) throw new Error('Storage blocked');
      return original.call(this, key, value);
    };
  });
  await page.goto('/');
  await unlock(page);
  await expect(page.getByRole('alert')).toContainText('Admin mode needs session storage');
  await expect(page.getByRole('group')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Dark mode', exact: true })).toBeVisible();
});

test('handles blocked session storage reads without breaking the public board', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Storage blocked'); } });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Admin mode needs session storage');
  await expect(page.getByRole('heading', { name: 'Dark mode', exact: true })).toBeVisible();
});

test('verification network failure allows retry without unlocking', async ({ page }) => {
  await page.route('**/api/admin/verify', (route) => route.abort());
  await page.goto('/');
  await unlock(page);
  await expect(page.getByRole('banner').getByRole('alert')).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(0);
  await page.unroute('**/api/admin/verify');
  await page.getByLabel('Admin passcode', { exact: true }).fill(PASSCODE);
  await page.getByRole('button', { name: 'Unlock admin', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit admin' })).toBeVisible();
});

test('cancelled verification cannot unlock from a late success', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/admin/verify', async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await unlock(page);
  await expect(page.getByRole('button', { name: 'Checking…', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const finished = page.waitForResponse('**/api/admin/verify');
  release();
  await finished;
  await expect(page.getByRole('button', { name: 'Exit admin' })).toHaveCount(0);
  await expect(page.getByRole('group')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('adminPasscode'))).toBeNull();
});

test('serializes vote and status mutations on a card and prevents repeat status changes', async ({ page, request }) => {
  const idea = await createIdea(request, 'Pending status');
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  await page.route(`**/api/ideas/${idea.id}/status`, async (route) => {
    calls++;
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await unlock(page);
  const item = card(page, idea);
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(item.getByRole('button', { name: 'Move to Planned', exact: true })).toBeDisabled();
  await expect(item.getByRole('button', { name: `Vote for ${idea.title}`, exact: true })).toBeDisabled();
  release();
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
  await expect(item.getByRole('button', { name: 'Move to Shipped', exact: true })).toBeEnabled();
  expect(calls).toBe(1);

  let releaseVote;
  const voteGate = new Promise((resolve) => { releaseVote = resolve; });
  await page.route(`**/api/ideas/${idea.id}/vote`, async (route) => {
    const response = await route.fetch();
    await voteGate;
    await route.fulfill({ response });
  });
  await item.getByRole('button', { name: `Vote for ${idea.title}`, exact: true }).click();
  await expect(item.getByRole('button', { name: 'Move to Shipped', exact: true })).toBeDisabled();
  releaseVote();
  await expect(item.getByRole('button', { name: 'Move to Shipped', exact: true })).toBeEnabled();
  await item.getByRole('button', { name: 'Move to Shipped', exact: true }).click();
  await expect(item.getByText('Shipped', { exact: true })).toBeVisible();
  await expect(item.getByLabel('1 vote', { exact: true })).toBeVisible();
});

test('keeps a confirmed status when refresh fails, then retries the refresh', async ({ page, request }) => {
  const idea = await createIdea(request, 'Status refresh failure');
  await page.goto('/');
  await unlock(page);
  const item = card(page, idea);
  await expect(item.getByRole('button', { name: 'Move to Planned', exact: true })).toBeVisible();
  await page.route('**/api/ideas', (route) => route.fulfill({ status: 500, json: { error: 'Refresh unavailable' } }));
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText("Couldn't load ideas: Refresh unavailable");
  await page.unroute('**/api/ideas');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
});

test('refreshes an actual status conflict and offers only the new allowed actions', async ({ page, request }) => {
  const idea = await createIdea(request, 'Status conflict');
  await page.goto('/');
  await unlock(page);
  const item = card(page, idea);
  await expect(item.getByRole('button', { name: 'Move to Planned', exact: true })).toBeVisible();
  const updated = await request.patch(`/api/ideas/${idea.id}/status`, {
    headers: { 'X-Admin-Passcode': PASSCODE }, data: { status: 'planned' },
  });
  expect(updated.status()).toBe(200);
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(item.getByRole('alert')).toContainText("Couldn't save status: Status change not allowed");
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
  await item.getByRole('button', { name: 'Move to Shipped', exact: true }).click();
  await expect(item.getByText('Shipped', { exact: true })).toBeVisible();
  await expect(item.getByRole('alert')).toHaveCount(0);
});

test('ignores a pre-transition list response that arrives after the status refresh', async ({ page, request }) => {
  const idea = await createIdea(request, 'Stale status list');
  await page.goto('/');
  await unlock(page);
  const item = card(page, idea);
  await expect(item.getByRole('button', { name: 'Move to Planned', exact: true })).toBeVisible();
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
  await form.getByLabel('Title').fill(`Status refresh trigger ${crypto.randomUUID()}`);
  await form.getByRole('button', { name: 'Submit idea' }).click();
  await started;
  await item.getByRole('button', { name: 'Move to Planned', exact: true }).click();
  await expect(item.getByRole('button', { name: 'Move to Shipped', exact: true })).toBeEnabled();
  const finished = page.waitForResponse((res) => res.url().endsWith('/api/ideas') && res.request().method() === 'GET');
  release();
  await finished;
  await expect(item.getByText('Planned', { exact: true })).toBeVisible();
});
