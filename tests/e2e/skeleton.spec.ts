// The e2e skeleton: proves the plumbing end to end against the real Worker and the built placeholder pages.
// The page-specific specs (forms, tracking, Meta) of the LCME site were tied to its markup and IDs. Port them
// here once the design phase fixes LSE's markup; helpers.ts already carries the fakes they need.
import { LOCAL, PROD, expect, fillForm, submitForm, test, waitForRow } from './helpers';

test.describe('pages and the Worker', () => {
  test('the homepage loads with the tracker, the form and the booking dialog', async ({ page }) => {
    await page.goto(`${PROD}/`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('script[data-lse-tracker]')).toHaveCount(1);
    await expect(page.locator('form[data-lead-form]')).toHaveCount(1);
    await expect(page.locator('dialog[data-bookdlg]')).toHaveCount(1);
  });

  test('the booking link opens the dialog', async ({ page }) => {
    await page.goto(`${PROD}/contact-us/`);
    await page.locator('a[data-cal]').first().click();
    await expect(page.locator('dialog[data-bookdlg]')).toBeVisible();
    await page.locator('[data-bookdlg-close]').click();
    await expect(page.locator('dialog[data-bookdlg]')).toBeHidden();
  });

  test('old URLs redirect in one hop and keep the query string', async ({ request }) => {
    const response = await request.get(`${LOCAL}/seo-pricing-page/?utm_source=x`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toContain('/seo-pricing/?utm_source=x');
  });

  test('WordPress leftovers and /intake are not served by this site', async ({ request }) => {
    for (const path of ['/wp-admin/', '/wp-login.php', '/intake/']) {
      expect((await request.get(`${LOCAL}${path}`, { maxRedirects: 0 })).status()).toBe(404);
    }
  });

  test('anything off production is marked noindex', async ({ request }) => {
    const response = await request.get(`${LOCAL}/`);
    expect(response.headers()['x-robots-tag']).toBe('noindex');
  });
});

test.describe('a lead', () => {
  test('the form posts to /api/lead, the Worker saves it, and the page says so', async ({ page, calls }) => {
    await page.goto(`${PROD}/contact-us/`);
    await fillForm(page);
    await submitForm(page);
    await expect(page.locator('[data-done]')).toBeVisible({ timeout: 10_000 });
    expect(calls.leads).toHaveLength(1);
    expect(calls.leads[0]).toMatchObject({ name: 'TEST - ignore', source_form: 'Contact page message', hp: '' });
    await waitForRow('SELECT * FROM leads WHERE conversion_id = ?', String(calls.leads[0]?.conversion_id));
  });
});
