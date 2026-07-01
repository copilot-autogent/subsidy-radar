import { test, expect } from '@playwright/test';

const TRACKER_KEY = 'subsidy-tracker-v1';

async function clearTracker(page: import('@playwright/test').Page) {
  await page.evaluate((key) => localStorage.removeItem(key), TRACKER_KEY);
}

async function setTrackerItem(page: import('@playwright/test').Page, id: string, status: string) {
  await page.evaluate(([key, k, v]) => {
    const tracker = JSON.parse(localStorage.getItem(key) ?? '{}');
    tracker[k] = v;
    localStorage.setItem(key, JSON.stringify(tracker));
  }, [TRACKER_KEY, id, status] as [string, string, string]);
}

async function getTrackerItem(page: import('@playwright/test').Page, id: string): Promise<string | undefined> {
  return page.evaluate(([key, k]) => {
    const tracker = JSON.parse(localStorage.getItem(key) ?? '{}');
    return tracker[k];
  }, [TRACKER_KEY, id] as [string, string]);
}

test.describe('Tracker application status (申請狀態)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear before goto so the page always initialises from a clean localStorage
    await page.addInitScript(() => localStorage.removeItem('subsidy-tracker-v1'));
    await page.goto('/');
  });

  test('(a) status persists across reload — localStorage round-trip', async ({ page }) => {
    // Pick the first subsidy card
    const card = page.locator('.subsidy-card').first();
    const id = await card.getAttribute('data-id');
    expect(id).toBeTruthy();

    // Select "申請中" via the tracker select
    const sel = card.locator('.tracker-select');
    await sel.selectOption('申請中');

    // Verify the select shows the new value immediately
    await expect(sel).toHaveValue('申請中');

    // Reload the page and verify the status is restored from localStorage
    await page.reload();

    const selAfterReload = page.locator(`.subsidy-card[data-id="${id}"] .tracker-select`);
    await expect(selAfterReload).toHaveValue('申請中');

    // Also verify directly in localStorage
    const stored = await getTrackerItem(page, id!);
    expect(stored).toBe('申請中');
  });

  test('(b) tracker summary count updates on status change', async ({ page }) => {
    const summaryBanner = page.locator('#trackerSummaryBanner');
    const summaryCount = page.locator('#trackerSummaryCount');
    const breakdown = page.locator('#trackerStatusBreakdown');

    // Initially no tracked items
    await expect(summaryBanner).toBeHidden();

    // Pick two cards
    const cards = page.locator('.subsidy-card');
    const card1 = cards.nth(0);
    const card2 = cards.nth(1);

    // Change card1 to 申請中
    await card1.locator('.tracker-select').selectOption('申請中');
    await expect(summaryBanner).toBeVisible();
    await expect(summaryCount).toHaveText('1');
    await expect(breakdown).toContainText('申請中 1');

    // Change card2 to 已核准
    await card2.locator('.tracker-select').selectOption('已核准');
    await expect(summaryCount).toHaveText('2');
    await expect(breakdown).toContainText('申請中 1');
    await expect(breakdown).toContainText('已核准 1');

    // Reset card1 to 未申請
    await card1.locator('.tracker-select').selectOption('未申請');
    await expect(summaryCount).toHaveText('1');
    await expect(breakdown).not.toContainText('申請中');
    await expect(breakdown).toContainText('已核准 1');

    // Reset card2 — banner should hide
    await card2.locator('.tracker-select').selectOption('未申請');
    await expect(summaryBanner).toBeHidden();
  });

  test('status badge has correct colour class after change', async ({ page }) => {
    const card = page.locator('.subsidy-card').first();
    const sel = card.locator('.tracker-select');

    // Default: ts-none (灰)
    await expect(sel).toHaveClass(/ts-none/);

    await sel.selectOption('申請中');
    await expect(sel).toHaveClass(/ts-applying/);

    await sel.selectOption('已核准');
    await expect(sel).toHaveClass(/ts-approved/);

    await sel.selectOption('已領取');
    await expect(sel).toHaveClass(/ts-received/);

    await sel.selectOption('不符資格');
    await expect(sel).toHaveClass(/ts-ineligible/);

    await sel.selectOption('未申請');
    await expect(sel).toHaveClass(/ts-none/);
  });

  test('backward-compatible: old localStorage values are migrated to nearest new status', async ({ page }) => {
    const card = page.locator('.subsidy-card').first();
    const id = await card.getAttribute('data-id');
    expect(id).toBeTruthy();

    // Seed with old status values and verify migration
    // 已申請 → 申請中, 進行中 → 申請中, 已完成 → 已領取
    await setTrackerItem(page, id!, '已申請');
    await page.reload();

    const sel = page.locator(`.subsidy-card[data-id="${id}"] .tracker-select`);
    await expect(sel).toHaveValue('申請中');

    // Summary banner should show (申請中 is tracked)
    await expect(page.locator('#trackerSummaryBanner')).toBeVisible();
    await expect(page.locator('#trackerStatusBreakdown')).toContainText('申請中 1');

    // Test 進行中 → 申請中
    await setTrackerItem(page, id!, '進行中');
    await page.reload();
    await expect(page.locator(`.subsidy-card[data-id="${id}"] .tracker-select`)).toHaveValue('申請中');

    // Test 已完成 → 已領取
    await setTrackerItem(page, id!, '已完成');
    await page.reload();
    await expect(page.locator(`.subsidy-card[data-id="${id}"] .tracker-select`)).toHaveValue('已領取');
  });
});
