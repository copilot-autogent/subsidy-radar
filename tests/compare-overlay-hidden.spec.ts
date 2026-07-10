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
    // Clear the compare selection BEFORE any page script runs, so the very
    // first render is guaranteed to start from a clean, empty state (no
    // stale sessionStorage side effects on first paint). Not wrapped in a
    // swallow-all catch: if storage access unexpectedly throws, the test
    // SHOULD fail loudly rather than silently proceed on a dirty state.
    await page.addInitScript(() => {
      sessionStorage.removeItem('subsidy-compare-selection');
    });
    await page.goto('/subsidy-radar/');
  });

  test.afterEach(async ({ page }) => {
    // Some tests toggle a compare checkbox, which writes to sessionStorage.
    // Reset it so state never leaks between tests.
    await page.evaluate(() =>
      sessionStorage.removeItem('subsidy-compare-selection'),
    );
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
    await expect(bar).toHaveAttribute('hidden', '');
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

  test('the element at the viewport center is clickable (not overlay-blocked)', async ({ page }) => {
    // Directly exercise the reported outage: dispatch a REAL click at the
    // exact viewport center and capture which element actually receives it.
    // When the bug is present, the overlay covers the whole page and is the
    // click target; when fixed, the click lands on real page content.
    const clickHitOverlay = await page.evaluate(() => {
      const cx = Math.floor(window.innerWidth / 2);
      const cy = Math.floor(window.innerHeight / 2);
      const target = document.elementFromPoint(cx, cy);
      if (!target) return true; // nothing hittable => something is covering it

      let received: EventTarget | null = null;
      const handler = (e: Event) => {
        received = e.target;
      };
      document.addEventListener('click', handler, true);
      target.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy }),
      );
      document.removeEventListener('click', handler, true);

      const el = received as Element | null;
      return !el || !!el.closest('.compare-overlay');
    });
    expect(clickHitOverlay).toBe(false);

    // And confirm a real interactive control can be toggled (pointer events
    // are not being intercepted where they should not be).
    const checkbox = page.locator('.compare-checkbox').first();
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
