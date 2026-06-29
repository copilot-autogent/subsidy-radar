import { test, expect } from '@playwright/test';

// Helper: count visible subsidy cards on the page
async function countVisibleCards(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('.subsidy-card').evaluateAll(cards =>
    cards.filter(c => (c as HTMLElement).style.display !== 'none').length
  );
}

test.describe('URL-based shareable filter state', () => {
  test('navigating to ?cat=住宅 pre-applies category filter and shows only 住宅 cards', async ({ page }) => {
    await page.goto('/?cat=住宅');

    // The 住宅 filter button should be active
    const catBtn = page.locator('.filter-btn[data-category="住宅"]');
    await expect(catBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(catBtn).toHaveClass(/active/);

    // Only 住宅-category cards should be visible
    const visibleCount = await countVisibleCards(page);
    expect(visibleCount).toBeGreaterThan(0);

    const nonHousingVisible = await page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => {
        const el = c as HTMLElement;
        return el.style.display !== 'none' && el.dataset.category !== '住宅';
      }).length
    );
    expect(nonHousingVisible).toBe(0);

    // URL should contain the cat param
    expect(page.url()).toContain('cat=%E4%BD%8F%E5%AE%85');
  });

  test('navigating to ?sort=difficulty pre-applies difficulty sort', async ({ page }) => {
    await page.goto('/?sort=difficulty');

    const sortBtn = page.getByRole('button', { name: /簡單優先/ });
    await expect(sortBtn).toBeVisible();
    await expect(sortBtn).toHaveAttribute('aria-pressed', 'true');

    // Cards should have CSS order values reflecting difficulty (easy < medium < hard)
    const allCards = page.locator('.subsidy-card');
    const count = await allCards.count();
    const orderDiffPairs: { order: number; diff: string }[] = [];
    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i);
      const order = await card.evaluate(el => Number((el as HTMLElement).style.order) || 999);
      const diff = await card.evaluate(el => (el as HTMLElement).dataset.difficulty ?? 'medium');
      orderDiffPairs.push({ order, diff });
    }
    const diffOrder: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
    orderDiffPairs.sort((a, b) => a.order - b.order);
    // Verify difficulty is non-decreasing as order increases
    for (let i = 0; i < orderDiffPairs.length - 1; i++) {
      const a = diffOrder[orderDiffPairs[i].diff] ?? 2;
      const b = diffOrder[orderDiffPairs[i + 1].diff] ?? 2;
      expect(a).toBeLessThanOrEqual(b);
    }
  });

  test('navigating to ?q=租金 pre-applies search query and filters cards', async ({ page }) => {
    await page.goto('/?q=%E7%A7%9F%E9%87%91');

    // Search input should contain the query
    const searchInput = page.locator('#searchInput');
    await expect(searchInput).toHaveValue('租金');

    // Some cards should be visible (租金 matches at least one subsidy)
    const visibleCount = await countVisibleCards(page);
    expect(visibleCount).toBeGreaterThan(0);

    // URL should retain the q param
    expect(page.url()).toContain('q=');
  });

  test('changing a category filter updates the URL', async ({ page }) => {
    await page.goto('/');

    const housingBtn = page.locator('.filter-btn[data-category="住宅"]');
    await housingBtn.click();

    // Wait for URL to be updated
    await page.waitForFunction(() => window.location.search.includes('cat='));
    expect(page.url()).toContain('cat=');
    expect(decodeURIComponent(page.url())).toContain('cat=住宅');
  });

  test('clearing filters resets URL to clean root', async ({ page }) => {
    await page.goto('/?cat=住宅&sort=difficulty');

    // Trigger a clear filters action via no-results button if visible,
    // or via the filter button click to restore 全部
    const allBtn = page.locator('.filter-btn[data-category="全部"]');
    await allBtn.click();
    // Also deactivate sort
    const sortDiffBtn = page.getByRole('button', { name: /簡單優先/ });
    if (await sortDiffBtn.isVisible()) {
      await sortDiffBtn.click();
    }

    // cat param should be removed
    await page.waitForFunction(() => !window.location.search.includes('cat='));
    expect(decodeURIComponent(page.url())).not.toContain('cat=住宅');
  });

  test('share URL → open in fresh browser context → correct cards visible (end-to-end)', async ({ page, baseURL }) => {
    // Navigate to a shared URL (simulates a recipient opening a shared filter link)
    await page.goto('/?cat=%E4%BD%8F%E5%AE%85');

    // The 住宅 category button should be active
    const catBtn = page.locator('.filter-btn[data-category="住宅"]');
    await expect(catBtn).toHaveAttribute('aria-pressed', 'true');

    // Only 住宅 cards should be visible
    const visibleCount = await countVisibleCards(page);
    expect(visibleCount).toBeGreaterThan(0);

    const nonHousingVisible = await page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => {
        const el = c as HTMLElement;
        return el.style.display !== 'none' && el.dataset.category !== '住宅';
      }).length
    );
    expect(nonHousingVisible).toBe(0);
  });

  test('invalid/unknown param values are silently ignored', async ({ page }) => {
    // Navigate with an unknown category value
    await page.goto('/?cat=INVALID_CATEGORY&sort=INVALID_SORT');

    // Should show all cards (unknown cat ignored → defaults to 全部)
    const allBtn = page.locator('.filter-btn[data-category="全部"]');
    await expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    // All cards should be visible
    const visibleCount = await countVisibleCards(page);
    const totalCount = await page.locator('.subsidy-card').count();
    expect(visibleCount).toBe(totalCount);

    // No error state
    await expect(page.locator('#noResults')).toBeHidden();
  });
});
