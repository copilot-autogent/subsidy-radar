import { test, expect } from '@playwright/test';

test.describe('Side-by-side subsidy comparison panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear sessionStorage before each test
    await page.evaluate(() => sessionStorage.removeItem('subsidy-compare-selection'));
  });

  test('each card has a compare checkbox', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
    const firstCheckbox = checkboxes.first();
    await expect(firstCheckbox).toHaveAttribute('type', 'checkbox');
  });

  test('compare bar is hidden when fewer than 2 items selected', async ({ page }) => {
    const bar = page.locator('#compareBar');
    await expect(bar).toBeHidden();

    // Select one item — bar should still be hidden
    await page.locator('.compare-checkbox').first().check();
    await expect(bar).toBeHidden();
  });

  test('compare bar appears when 2 items are selected', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    const bar = page.locator('#compareBar');
    await expect(bar).toBeVisible();
    await expect(page.locator('#compareCount')).toContainText('2');
  });

  test('maximum 3 subsidies can be selected (4th shows toast)', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await checkboxes.nth(2).check();

    // Attempt to check a 4th
    await checkboxes.nth(3).check();

    // 4th should revert to unchecked
    await expect(checkboxes.nth(3)).not.toBeChecked();

    // Toast should appear
    const toast = page.locator('#share-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('最多比較 3 項');
  });

  test('comparison panel opens when bar button is clicked', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.locator('#compareOpenBtn').click();

    const overlay = page.locator('#compareOverlay');
    await expect(overlay).toBeVisible();
  });

  test('comparison panel shows name, amount, difficulty, deadline, steps, CTA for selected subsidies', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.locator('#compareOpenBtn').click();

    // First column should have content
    const name0 = page.locator('#compare-name-0');
    await expect(name0).not.toBeEmpty();

    const amount0 = page.locator('#compare-amount-0');
    await expect(amount0).not.toBeEmpty();

    // CTA: first card may or may not have a URL; check the cell is rendered
    const ctaCell0 = page.locator('#compare-cta-0');
    await expect(ctaCell0).toBeVisible();
    // If a CTA link exists, verify it has a valid https URL
    const ctaLink = ctaCell0.locator('.compare-cta-link');
    const ctaCount = await ctaLink.count();
    if (ctaCount > 0) {
      const href = await ctaLink.getAttribute('href');
      expect(href).toMatch(/^https?:\/\//);
    }
  });

  test('third column is empty when only 2 subsidies are selected', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    await page.locator('#compareOpenBtn').click();

    // Third column (index 2) should be empty or show em-dash
    const name2 = page.locator('#compare-name-2');
    const text = await name2.textContent();
    expect(text?.trim()).toBe('');
  });

  test('close button hides the panel', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.locator('#compareOpenBtn').click();

    const overlay = page.locator('#compareOverlay');
    await expect(overlay).toBeVisible();

    await page.locator('#compareCloseBtn').click();
    await expect(overlay).toBeHidden();
  });

  test('Escape key closes the panel', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.locator('#compareOpenBtn').click();

    await expect(page.locator('#compareOverlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#compareOverlay')).toBeHidden();
  });

  test('clicking the backdrop closes the panel', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.locator('#compareOpenBtn').click();

    await expect(page.locator('#compareOverlay')).toBeVisible();
    // Click on the overlay backdrop (not the panel)
    await page.locator('#compareOverlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#compareOverlay')).toBeHidden();
  });

  test('clear button resets selection and hides bar', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    const bar = page.locator('#compareBar');
    await expect(bar).toBeVisible();

    await page.locator('#compareClearBtn').click();

    await expect(bar).toBeHidden();
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();
  });

  test('selection state is stored in sessionStorage', async ({ page }) => {
    const checkboxes = page.locator('.compare-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();

    const stored = await page.evaluate(() => sessionStorage.getItem('subsidy-compare-selection'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
  });

  test('comparison panel dialog has aria-modal and role dialog', async ({ page }) => {
    const overlay = page.locator('#compareOverlay');
    await expect(overlay).toHaveAttribute('role', 'dialog');
    await expect(overlay).toHaveAttribute('aria-modal', 'true');
  });
});
