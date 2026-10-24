import { expect, test } from '@playwright/test';

const SEEDED_ORDER = [
  { title: 'Dark mode', votes: '5 votes', status: 'Planned' },
  { title: 'Email me when an idea ships', votes: '3 votes', status: 'Under review' },
  { title: 'Export ideas to CSV', votes: '3 votes', status: 'Under review' },
  { title: 'Keyboard shortcuts', votes: '1 vote', status: 'Shipped' },
  { title: 'Comment on ideas', votes: '0 votes', status: 'Under review' },
];

test('lists seeded ideas by votes, newest first on a tie', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Feature Request Board' })).toBeVisible();

  // Other tests post ideas into the same test database, so check only the seeded ideas' order.
  const items = page.getByRole('list', { name: 'Ideas' }).getByRole('listitem');
  await expect(items.getByRole('heading', { name: SEEDED_ORDER[0].title })).toBeVisible();
  const titles = await items.getByRole('heading').allTextContents();
  const seededTitles = SEEDED_ORDER.map((idea) => idea.title);
  expect(titles.filter((title) => seededTitles.includes(title))).toEqual(seededTitles);

  for (const idea of SEEDED_ORDER) {
    const item = items.filter({ has: page.getByRole('heading', { name: idea.title, exact: true }) });
    await expect(item.getByLabel(idea.votes)).toBeVisible();
    await expect(item.getByText(idea.status, { exact: true })).toBeVisible();
  }

  await expect(page.getByText('No ideas yet')).toHaveCount(0);
});

test.describe('at phone width', () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test('fits the screen without horizontal scrolling', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: SEEDED_ORDER[0].title })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
