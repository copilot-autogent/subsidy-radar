import { test, expect } from '@playwright/test';

test.describe('Required documents checklist on subsidy cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('checklist button is present on cards that have requiredDocs', async ({ page }) => {
    // childcare-allowance has requiredDocs populated
    const card = page.locator('#childcare-allowance');
    await expect(card).toBeVisible();
    const docsToggle = card.locator('details.card-docs summary');
    await expect(docsToggle).toBeVisible();
    await expect(docsToggle).toContainText('查看申請文件');
  });

  test('checklist is collapsed by default', async ({ page }) => {
    const card = page.locator('#childcare-allowance');
    await expect(card).toBeVisible();
    // docs list should not be visible before any interaction
    const list = card.locator('ul.docs-list');
    await expect(list).not.toBeVisible();
  });

  test('clicking the button expands the checklist', async ({ page }) => {
    const card = page.locator('#childcare-allowance');
    await expect(card).toBeVisible();
    const summary = card.locator('details.card-docs summary');
    await summary.click();
    const list = card.locator('ul.docs-list');
    await expect(list).toBeVisible();
    // Should render at least 4 checklist items
    const items = list.locator('li');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('checklist is keyboard-operable via Enter key', async ({ page }) => {
    const card = page.locator('#childcare-allowance');
    await expect(card).toBeVisible();
    const summary = card.locator('details.card-docs summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    const list = card.locator('ul.docs-list');
    await expect(list).toBeVisible();
  });

  test('cards without requiredDocs show no checklist button', async ({ page }) => {
    // youth-vocational-training has no requiredDocs
    const card = page.locator('#youth-vocational-training');
    await expect(card).toBeVisible();
    const docsDetails = card.locator('details.card-docs');
    await expect(docsDetails).toHaveCount(0);
  });

  test('all 12 populated cards have the checklist', async ({ page }) => {
    // Asserts exact count so accidental data removals are caught immediately.
    const allDocsDetails = page.locator('.subsidy-card details.card-docs');
    const count = await allDocsDetails.count();
    expect(count).toBe(12);
  });

  test('disability-living-allowance checklist items are present and visible', async ({ page }) => {
    const card = page.locator('#disability-living-allowance');
    await expect(card).toBeVisible();
    const summary = card.locator('details.card-docs summary');
    await summary.click();
    const items = card.locator('ul.docs-list li');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
