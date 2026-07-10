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
    // Runs in every frame before that frame's scripts. Scope side effects to
    // the top document so a cross-origin child frame can't throw a
    // SecurityError (or double-install the click probe).
    await page.addInitScript(() => {
      if (window !== window.top) return;
      // Start each first render from a clean, empty compare state.
      sessionStorage.removeItem('subsidy-compare-selection');
      // Capture-phase probe: records the element that receives a real,
      // browser-hit-tested click so a test can assert what the click landed on.
      (window as unknown as { __lastClickTarget: EventTarget | null }).__lastClickTarget = null;
      document.addEventListener(
        'click',
        (e) => {
          (window as unknown as { __lastClickTarget: EventTarget | null }).__lastClickTarget = e.target;
        },
        true,
      );
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

  test('a real click at the viewport center is not swallowed by the overlay', async ({ page }) => {
    // Use Playwright's real input pipeline (browser hit-testing + pointer-events),
    // NOT a synthetic dispatchEvent, so a full-screen overlay would genuinely
    // intercept the click when the bug is present.
    const { cx, cy } = await page.evaluate(() => ({
      cx: Math.floor(window.innerWidth / 2),
      cy: Math.floor(window.innerHeight / 2),
    }));
    await page.mouse.click(cx, cy);

    const clickHitOverlay = await page.evaluate(() => {
      const el = (window as unknown as { __lastClickTarget: Element | null })
        .__lastClickTarget;
      // No target recorded => the click was swallowed before reaching content.
      if (!el || typeof el.closest !== 'function') return true;
      return !!el.closest('.compare-overlay');
    });
    expect(clickHitOverlay).toBe(false);

    // And confirm a real interactive control can be toggled (pointer events are
    // not intercepted where they should not be). Guard against an empty render.
    const checkbox = page.locator('.compare-checkbox').first();
    await expect(page.locator('.compare-checkbox')).not.toHaveCount(0);
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
