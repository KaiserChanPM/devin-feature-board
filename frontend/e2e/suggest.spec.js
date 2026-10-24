import { expect, test } from '@playwright/test';

test('posts a new idea and shows it in the list as Under review', async ({ page }) => {
  const title = `Bulk import ${Date.now()}`;
  await page.goto('/');

  const form = page.getByRole('region', { name: 'Suggest a feature' });
  const titleInput = form.getByLabel('Title');
  const descriptionInput = form.getByLabel('Description (optional)');

  await titleInput.fill(title);
  await descriptionInput.fill('Upload a CSV of ideas in one go.');
  await form.getByRole('button', { name: 'Submit idea' }).click();

  await expect(form.getByRole('status')).toHaveText(`Thanks! "${title}" was added.`);
  await expect(titleInput).toHaveValue('');
  await expect(descriptionInput).toHaveValue('');

  const item = page.getByRole('list', { name: 'Ideas' }).getByRole('listitem').filter({ hasText: title });
  await expect(item).toHaveCount(1);
  await expect(item.getByRole('heading', { name: title })).toBeVisible();
  await expect(item.getByText('Under review', { exact: true })).toBeVisible();
  await expect(item.getByLabel('0 votes')).toBeVisible();
  await expect(item.getByText('Upload a CSV of ideas in one go.')).toBeVisible();
});

test('shows inline errors from the browser checks and does not post', async ({ page }) => {
  let posted = false;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/api/ideas')) posted = true;
  });
  await page.goto('/');

  const form = page.getByRole('region', { name: 'Suggest a feature' });
  const titleInput = form.getByLabel('Title');
  const descriptionInput = form.getByLabel('Description (optional)');
  const submit = form.getByRole('button', { name: 'Submit idea' });

  await submit.click();
  await expect(titleInput).toHaveAttribute('aria-invalid', 'true');
  await expect(titleInput).toHaveAccessibleDescription(/Title is required/);
  await expect(titleInput).toBeFocused();

  await titleInput.fill('  ab  ');
  await expect(titleInput).toHaveAccessibleDescription(/Title must be 3–80 characters/);

  await titleInput.fill('A valid title');
  await descriptionInput.fill('d'.repeat(501));
  await expect(titleInput).toHaveAttribute('aria-invalid', 'false');
  await submit.click();
  await expect(descriptionInput).toHaveAttribute('aria-invalid', 'true');
  await expect(descriptionInput).toHaveAccessibleDescription(/Description must be 500 characters or fewer/);

  expect(posted).toBe(false);
});

test('shows the error message the API returns', async ({ page }) => {
  await page.route('**/api/ideas', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({ status: 400, json: { error: 'Title must be 3–80 characters' } })
      : route.fallback(),
  );
  await page.goto('/');

  const form = page.getByRole('region', { name: 'Suggest a feature' });
  await form.getByLabel('Title').fill('A valid title');
  await form.getByRole('button', { name: 'Submit idea' }).click();

  await expect(form.getByRole('alert')).toHaveText("Couldn't add your idea: Title must be 3–80 characters");
  await expect(form.getByLabel('Title')).toHaveValue('A valid title');
});
