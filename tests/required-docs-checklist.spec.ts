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
    const details = card.locator('details.card-docs');
    // details element should exist but not have the open attribute
    await expect(details).not.toHaveAttribute('open', '');
    // docs list should not be visible
    const list = card.locator('ul.docs-list');
    await expect(list).not.toBeVisible();
  });

  test('clicking the button expands the checklist', async ({ page }) => {
    const card = page.locator('#childcare-allowance');
    const summary = card.locator('details.card-docs summary');
    await summary.click();
    const list = card.locator('ul.docs-list');
    await expect(list).toBeVisible();
    // Should render checklist items
    const items = list.locator('li');
    await expect(items).toHaveCount(5);
  });

  test('checklist is keyboard-operable via Enter key', async ({ page }) => {
    const card = page.locator('#childcare-allowance');
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

  test('at least 10 cards have the checklist', async ({ page }) => {
    const allDocsDetails = page.locator('.subsidy-card details.card-docs');
    const count = await allDocsDetails.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('disability-living-allowance checklist items are present', async ({ page }) => {
    const card = page.locator('#disability-living-allowance');
    const summary = card.locator('details.card-docs summary');
    await summary.click();
    const items = card.locator('ul.docs-list li');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});
