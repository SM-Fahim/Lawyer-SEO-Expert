// The e2e skeleton: proves the plumbing end to end against the real Worker and the built placeholder pages.
// The page-specific specs (forms, tracking, Meta) of the LCME site were tied to its markup and IDs. Port them
// here once the design phase fixes LSE's markup; helpers.ts already carries the fakes they need.
import { LOCAL, PROD, expect, fillForm, submitForm, test, waitForRow } from './helpers';

test.describe('pages and the Worker', () => {
  test('the homepage loads with the tracker, both forms and the booking dialog', async ({ page }) => {
    await page.goto(`${PROD}/`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('script[data-lse-tracker]')).toHaveCount(1);
    // The short form in the hero (owner rule: a way to act in the hero) and the full one in the final section.
    await expect(page.locator('form[data-lead-form]')).toHaveCount(2);
    await expect(page.locator('input[name="source_form"][value="Homepage hero form"]')).toHaveCount(1);
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

test.describe('the shell', () => {
  test('the phone menu opens, closes with Escape, and holds the booking button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${PROD}/`);
    const toggle = page.locator('[data-menu-toggle]');
    await expect(page.locator('#lse-nav')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#lse-nav a[data-cal]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lse-nav')).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test('the homepage has one H1, the FAQ JSON-LD matches the visible questions, and every image has a size', async ({ page }) => {
    await page.goto(`${PROD}/`);
    const visible = await page.locator('.lse-faq summary').allInnerTexts();
    const graph = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}')['@graph'] as Array<{ '@type': string; mainEntity?: Array<{ name: string }> }>;
    const faq = graph.find((node) => node['@type'] === 'FAQPage');
    expect(faq?.mainEntity?.map((q) => q.name)).toEqual(visible.map((q) => q.trim()));
    for (const img of await page.locator('main img').all()) {
      expect(await img.getAttribute('width')).toBeTruthy();
      expect(await img.getAttribute('height')).toBeTruthy();
    }
  });
});
