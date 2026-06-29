import { test, expect } from '@playwright/test';

test.describe('print filtered list button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('print-list button is present in the DOM', async ({ page }) => {
    const btn = page.locator('#printListBtn');
    await expect(btn).toBeAttached();
  });

  test('print-list button has correct aria-label', async ({ page }) => {
    const btn = page.locator('#printListBtn');
    await expect(btn).toHaveAttribute('aria-label', '列印目前補助清單');
  });

  test('print-list button is visible on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const btn = page.locator('#printListBtn');
    await expect(btn).toBeVisible();
  });

  test('print-list button is hidden on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const btn = page.locator('#printListBtn');
    await expect(btn).toBeHidden();
  });

  test('print-filtered-header is not visible in normal view', async ({ page }) => {
    const header = page.locator('#printFilteredHeader');
    await expect(header).toBeHidden();
  });

  test('clicking print-list button adds print-filtered class to body and calls window.print()', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Mock window.print and setTimeout to prevent dialog and skip cleanup delay
    await page.evaluate(() => {
      (window as any).__printCalled = false;
      (window as any).__origSetTimeout = window.setTimeout;
      window.setTimeout = (() => 0) as any;
      window.print = () => { (window as any).__printCalled = true; };
    });
    await page.locator('#printListBtn').click();
    const printCalled = await page.evaluate(() => (window as any).__printCalled);
    const hasPrintFiltered = await page.evaluate(() => document.body.classList.contains('print-filtered'));
    expect(printCalled).toBe(true);
    expect(hasPrintFiltered).toBe(true);
  });

  test('afterprint removes print-filtered body class and print-filtered-hidden card classes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Apply a filter so some cards are hidden
    const firstFilterBtn = page.locator('.filter-btn').nth(1);
    await firstFilterBtn.click();
    // Mock print and suppress the setTimeout fallback cleanup
    await page.evaluate(() => {
      window.print = () => {};
      window.setTimeout = (() => 0) as any;
    });
    await page.locator('#printListBtn').click();

    // Verify body.print-filtered is set (cleanup not yet run without real afterprint)
    const hasPrintFiltered = await page.evaluate(() => document.body.classList.contains('print-filtered'));
    expect(hasPrintFiltered).toBe(true);

    // Manually dispatch afterprint to simulate browser cleanup
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

    // Verify cleanup ran
    const hasPrintFilteredAfter = await page.evaluate(() => document.body.classList.contains('print-filtered'));
    const hiddenCount = await page.evaluate(() => document.querySelectorAll('.print-filtered-hidden').length);
    expect(hasPrintFilteredAfter).toBe(false);
    expect(hiddenCount).toBe(0);
  });

  test('re-entrancy: second click clears stale print-filtered-hidden before re-marking', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Mock to prevent actual print and disable setTimeout cleanup
    await page.evaluate(() => {
      window.print = () => {};
      window.setTimeout = (() => 0) as any;
    });

    // Apply a filter first so that some cards are hidden (first count > 0)
    const filterBtn = page.locator('.filter-btn').nth(1);
    await filterBtn.click();
    await page.waitForFunction(() => {
      const cards = document.querySelectorAll<HTMLElement>('.subsidy-card');
      return [...cards].some(c => getComputedStyle(c).display === 'none');
    });

    // First click
    await page.locator('#printListBtn').click();
    const firstCount = await page.evaluate(() => document.querySelectorAll('.print-filtered-hidden').length);
    expect(firstCount).toBeGreaterThan(0);

    // Second click without afterprint (simulates browser that did not fire afterprint)
    await page.locator('#printListBtn').click();
    const secondCount = await page.evaluate(() => document.querySelectorAll('.print-filtered-hidden').length);
    // Re-entrancy guard must clear and re-mark — count stays the same, no duplication
    expect(secondCount).toBe(firstCount);
  });
});
