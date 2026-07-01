import { test, expect } from '@playwright/test';

test.describe('LINE share button', () => {
  test('each subsidy card has a LINE share button', async ({ page }) => {
    await page.goto('/');

    const lineShareBtns = page.locator('a.line-share-btn');
    const count = await lineShareBtns.count();
    expect(count).toBeGreaterThan(0);

    // Every visible card should have exactly one LINE share button
    const cards = page.locator('.subsidy-card');
    const cardCount = await cards.count();
    expect(count).toBe(cardCount);
  });

  test('LINE share button has correct href pointing to LINE social plugin', async ({ page }) => {
    await page.goto('/');

    const firstBtn = page.locator('a.line-share-btn').first();
    const href = await firstBtn.getAttribute('href');

    expect(href).toBeTruthy();
    expect(href).toContain('https://social-plugins.line.me/lineit/share?url=');
    // The encoded URL should be a valid URL pointing to the subsidy-radar site with an anchor
    const parsed = new URL(href!);
    const sharedUrl = parsed.searchParams.get('url');
    expect(sharedUrl).toBeTruthy();
    expect(sharedUrl).toContain('copilot-autogent.github.io/subsidy-radar');
    expect(sharedUrl).toMatch(/#[a-z0-9-]+$/);
  });

  test('LINE share button is accessible with aria-label', async ({ page }) => {
    await page.goto('/');

    const firstBtn = page.locator('a.line-share-btn').first();
    const ariaLabel = await firstBtn.getAttribute('aria-label');

    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('分享到 LINE');
  });

  test('LINE share button opens in new tab', async ({ page }) => {
    await page.goto('/');

    const firstBtn = page.locator('a.line-share-btn').first();
    expect(await firstBtn.getAttribute('target')).toBe('_blank');
    expect(await firstBtn.getAttribute('rel')).toContain('noopener');
  });

  test('LINE share button shows LINE text label', async ({ page }) => {
    await page.goto('/');

    const firstBtn = page.locator('a.line-share-btn').first();
    const text = await firstBtn.locator('.line-share-text').textContent();
    expect(text?.trim()).toBe('LINE');
  });
});
