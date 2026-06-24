import { test, expect } from '@playwright/test';

test.describe('empty-state message — no results after search + filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('empty-state is hidden on initial load', async ({ page }) => {
    const emptyState = page.locator('#noResults');
    await expect(emptyState).toBeHidden();
  });

  test('empty-state appears when nonsense query returns 0 results', async ({ page }) => {
    const input = page.locator('#searchInput');
    await input.fill('zzzzz');
    const emptyState = page.locator('#noResults');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('沒有找到符合的補助');
  });

  test('empty-state contains 清除篩選 and 測驗 buttons', async ({ page }) => {
    await page.locator('#searchInput').fill('zzzzz');
    const emptyState = page.locator('#noResults');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator('#clearFiltersBtn')).toBeVisible();
    await expect(emptyState.locator('#startQuizBtn')).toBeVisible();
  });

  test('清除篩選 button resets search and shows all cards', async ({ page }) => {
    const input = page.locator('#searchInput');
    await input.fill('zzzzz');
    await expect(page.locator('#noResults')).toBeVisible();

    await page.locator('#clearFiltersBtn').click();
    await expect(page.locator('#noResults')).toBeHidden();
    // Input should be cleared
    await expect(input).toHaveValue('');
    // At least one card should be visible
    await expect(page.locator('.subsidy-card').first()).toBeVisible();
  });

  test('empty-state disappears when search is cleared manually', async ({ page }) => {
    const input = page.locator('#searchInput');
    await input.fill('zzzzz');
    await expect(page.locator('#noResults')).toBeVisible();

    await input.fill('');
    await expect(page.locator('#noResults')).toBeHidden();
  });

  test('empty-state hidden when at least 1 card matches', async ({ page }) => {
    // Type partial text that should match something
    const input = page.locator('#searchInput');
    await input.fill('補助');
    const emptyState = page.locator('#noResults');
    // At least one card should still be visible (補助 is in many titles)
    const visibleCards = page.locator('.subsidy-card:visible');
    const count = await visibleCards.count();
    if (count > 0) {
      await expect(emptyState).toBeHidden();
    }
  });
});
