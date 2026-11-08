// The e2e skeleton: proves the plumbing end to end against the real Worker and the built placeholder pages.
// The page-specific specs (forms, tracking, Meta) of the LCME site were tied to its markup and IDs. Port them
// here once the design phase fixes LSE's markup; helpers.ts already carries the fakes they need.
import { LOCAL, PROD, expect, fillForm, submitForm, test, waitForRow } from './helpers';
import type { Page } from '@playwright/test';

test.describe('pages and the Worker', () => {
  test('the homepage loads with the tracker, both forms and the booking dialog', async ({ page }) => {
    await page.goto(`${PROD}/`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('script[data-lse-tracker]')).toHaveCount(1);
    // The short form in the hero (owner rule: a way to act in the hero). The close is call-first: the calendar.
    await expect(page.locator('form[data-lead-form]')).toHaveCount(1);
    await expect(page.locator('#book [data-calendly]')).toHaveCount(1);
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
    // The panel fills the screen, the toggle says "Close", and the page under it can't scroll.
    await expect(toggle).toContainText('Close');
    await expect(page.locator('html')).toHaveClass(/lse-menu-open/);
    await expect(page.locator('#lse-nav a[data-cal]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#lse-nav')).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toContainText('Menu');
  });

  test('"Practice areas" opens a plain list of the practice pages', async ({ page }) => {
    await page.goto(`${PROD}/seo-pricing/`);
    const button = page.locator('[data-pa-toggle]');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#lse-pa a')).toHaveCount(11);
    await page.keyboard.press('Escape');
    await expect(page.locator('#lse-pa')).toBeHidden();
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

// The calendar's loading states (critique section 4). No request reaches Calendly: widget.js is either held open
// (never answered) or refused by the default route in helpers.ts.
test.describe('the calendar while it loads', () => {
  const holdCalendly = (page: Page) => page.route('https://assets.calendly.com/**', () => {});

  test('a slow calendar shows the progress line, then the Calendly link only 8 s after it mounts', async ({ page }) => {
    await holdCalendly(page);
    await page.goto(`${PROD}/contact-us/`);
    const body = page.locator('#book [data-calendly]');
    // Before it nears the screen: the skeleton, no progress line, no link.
    await expect(body).not.toHaveClass(/is-loading/);
    await page.waitForTimeout(6_000);
    await body.scrollIntoViewIfNeeded();
    await expect(body).toHaveClass(/is-loading/);
    await page.waitForTimeout(1_000);
    await expect(body.locator('.lse-cal__bar')).toBeVisible();
    await expect(body.locator('.lse-cal__say')).toContainText('Loading Fahim’s calendar');
    await page.waitForTimeout(4_000);
    await expect(body.locator('.lse-cal__out a')).toBeHidden();
    await page.waitForTimeout(4_000);
    await expect(body.locator('.lse-cal__out a')).toBeVisible();
    await expect(body.locator('.lse-cal__say')).toContainText('Still loading?');
  });

  test('a blocked calendar shows the fallback and the form at once', async ({ page }) => {
    await page.goto(`${PROD}/contact-us/`);
    const body = page.locator('#book [data-calendly]');
    await body.scrollIntoViewIfNeeded();
    await expect(body).toHaveClass(/is-failed/, { timeout: 3_000 });
    await expect(body.locator('.lse-cal__say')).toContainText('Your browser blocked the calendar.');
    await expect(body.locator('.lse-cal__out a')).toBeVisible();
    await expect(body.locator('.lse-cal__alt a')).toHaveAttribute('href', '#contact-form');
    expect((await body.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(320);
  });

  test('the dialog counts its delay from the click, not from page load', async ({ page }) => {
    await holdCalendly(page);
    await page.goto(`${PROD}/seo-pricing/`);
    await page.waitForTimeout(10_000);
    await page.locator('header a[data-cal]').click();
    const body = page.locator('dialog[data-bookdlg] [data-calendly]');
    await expect(body).toHaveClass(/is-loading/);
    await page.waitForTimeout(1_000);
    await expect(body.locator('.lse-cal__bar')).toBeVisible();
    await expect(body.locator('.lse-cal__out a')).toBeHidden();
  });
});
