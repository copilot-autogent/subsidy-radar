import { test, expect } from '@playwright/test';

/**
 * Regression test for issue #167 (P0 outage):
 * `.compare-overlay { display: flex }` overrode the browser default
 * `[hidden] { display: none }`, so the comparison overlay rendered on every
 * fresh page load (empty sessionStorage, 0 items selected) and covered the
 * whole viewport at z-index 600, intercepting ALL clicks. Same anti-pattern
 * also affected `.compare-bar` (display: flex, toggled via the hidden attr).
 */
test.describe('Comparison overlay is hidden on fresh load (#167)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/subsidy-radar/');
    // Guarantee a clean state, then reload so the page initializes fresh.
    await page.evaluate(() => sessionStorage.removeItem('subsidy-compare-selection'));
    await page.reload();
  });

  test('overlay has computed display none on fresh load', async ({ page }) => {
    const overlay = page.locator('#compareOverlay');
    await expect(overlay).toHaveAttribute('hidden', '');
    await expect(overlay).toBeHidden();

    const display = await overlay.evaluate(
      (el) => getComputedStyle(el).display,
    );
    expect(display).toBe('none');
  });

  test('compare bar has computed display none on fresh load', async ({ page }) => {
    const bar = page.locator('#compareBar');
    await expect(bar).toBeHidden();

    const display = await bar.evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('none');
  });

  test('element at viewport center is NOT inside the compare overlay', async ({ page }) => {
    const insideOverlay = await page.evaluate(() => {
      const el = document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2,
      );
      return !!(el && el.closest('.compare-overlay'));
    });
    expect(insideOverlay).toBe(false);
  });

  test('a central interactive element is clickable on fresh load', async ({ page }) => {
    // Pick a compare checkbox (present on every card) and confirm the overlay
    // does not intercept the click. If the overlay were covering the viewport,
    // this click would time out / hit the overlay instead.
    const checkbox = page.locator('.compare-checkbox').first();
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
