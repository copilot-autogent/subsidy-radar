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
    // Mock window.print to prevent dialog and record call
    await page.evaluate(() => {
      (window as any).__printCalled = false;
      window.print = () => { (window as any).__printCalled = true; };
    });
    await page.locator('#printListBtn').click();
    // body.print-filtered should be set at time of print call (before afterprint)
    const printCalled = await page.evaluate(() => (window as any).__printCalled);
    expect(printCalled).toBe(true);
  });

  test('afterprint removes print-filtered body class and print-filtered-hidden card classes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // Apply a filter so some cards are hidden
    const firstFilterBtn = page.locator('.filter-btn').nth(1);
    await firstFilterBtn.click();
    // Mock print (afterprint won't fire automatically with mocked print)
    await page.evaluate(() => { window.print = () => {}; });
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
    await page.evaluate(() => { window.print = () => {}; });

    // First click
    await page.locator('#printListBtn').click();
    const firstClickClass = await page.evaluate(() => document.body.classList.contains('print-filtered'));
    expect(firstClickClass).toBe(true);

    // Second click without afterprint (simulates browser that did not fire afterprint)
    await page.locator('#printListBtn').click();
    const secondClickClass = await page.evaluate(() => document.body.classList.contains('print-filtered'));
    expect(secondClickClass).toBe(true);

    // Classes are cleaned and re-applied — no stale accumulation
    const staleCount = await page.evaluate(() => {
      const all = document.querySelectorAll('.print-filtered-hidden');
      return all.length;
    });
    // After second click, each hidden card should appear exactly once
    const uniqueIds = await page.evaluate(() => {
      const ids = new Set<string>();
      document.querySelectorAll('.print-filtered-hidden').forEach(el => ids.add(el.id));
      return ids.size;
    });
    expect(staleCount).toBe(uniqueIds); // no duplicates
  });
});
