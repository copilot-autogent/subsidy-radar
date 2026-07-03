import { test, expect } from '@playwright/test';

async function setTrackerItem(page: import('@playwright/test').Page, id: string, status: string) {
  await page.evaluate(([k, v]) => {
    const TRACKER_KEY = 'subsidy-tracker-v1';
    const tracker = JSON.parse(localStorage.getItem(TRACKER_KEY) ?? '{}');
    tracker[k] = v;
    localStorage.setItem(TRACKER_KEY, JSON.stringify(tracker));
  }, [id, status] as [string, string]);
}

async function clearTracker(page: import('@playwright/test').Page) {
  await page.evaluate(() => localStorage.removeItem('subsidy-tracker-v1'));
}

test.describe('CSV export button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearTracker(page);
  });

  test('export button is hidden when no subsidies are tracked', async ({ page }) => {
    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeHidden();
  });

  test('export button appears when a tracked subsidy is visible', async ({ page }) => {
    const card = page.locator('.subsidy-card').first();
    const id = await card.getAttribute('data-id');
    expect(id).toBeTruthy();

    await setTrackerItem(page, id!, '申請中');
    await page.reload();

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeVisible();
  });

  test('export button appears dynamically without reload when tracker status is updated via UI', async ({ page }) => {
    const trackerSelect = page.locator('.subsidy-card').first().locator('.tracker-select');
    await trackerSelect.selectOption('申請中');

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeVisible();
  });

  test('downloaded CSV has BOM prefix and correct zh-TW column headers', async ({ page }) => {
    const card = page.locator('.subsidy-card').first();
    const id = await card.getAttribute('data-id');
    expect(id).toBeTruthy();

    await setTrackerItem(page, id!, '申請中');
    await page.reload();

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    expect(download.suggestedFilename()).toBe('subsidy-tracker.csv');

    const path = await download.path();
    const { readFileSync } = await import('fs');
    const raw = readFileSync(path!);

    // BOM is UTF-8: 0xEF 0xBB 0xBF
    expect(raw[0]).toBe(0xef);
    expect(raw[1]).toBe(0xbb);
    expect(raw[2]).toBe(0xbf);

    const content = raw.toString('utf-8');
    expect(content).toContain('補助名稱');
    expect(content).toContain('類別');
    expect(content).toContain('申請狀態');
    expect(content).toContain('截止日期');
    expect(content).toContain('官方說明連結');
  });

  test('exported CSV contains the tracked subsidy row with correct status', async ({ page }) => {
    const card = page.locator('.subsidy-card').first();
    const id = await card.getAttribute('data-id');
    expect(id).toBeTruthy();

    await setTrackerItem(page, id!, '已核准');
    await page.reload();

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    const path = await download.path();
    const { readFileSync } = await import('fs');
    const content = readFileSync(path!, 'utf-8');

    expect(content).toContain('已核准');
  });

  test('export button is hidden when tracker filter hides all tracked cards', async ({ page }) => {
    // Track a card in a non-default category so a category filter can hide it
    const firstCategoryCard = page.locator('.subsidy-card[data-category]').first();
    const id = await firstCategoryCard.getAttribute('data-id');
    const category = await firstCategoryCard.getAttribute('data-category');
    expect(id).toBeTruthy();
    expect(category).toBeTruthy();

    await setTrackerItem(page, id!, '申請中');
    await page.reload();

    // Find a different category filter button to hide this card
    const otherCategoryBtn = page.locator(`.filter-btn[data-category]:not([data-category="${category}"]):not([data-category="全部"])`).first();
    const otherCategoryCount = await otherCategoryBtn.count();
    test.skip(otherCategoryCount === 0, 'No other category button available — skipping');

    await otherCategoryBtn.click();

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeHidden();
  });

  test('exported CSV only includes currently visible tracked subsidies', async ({ page }) => {
    // Track two cards in different categories
    const allCards = page.locator('.subsidy-card[data-category]');
    const firstCard = allCards.first();
    const firstId = await firstCard.getAttribute('data-id');
    const firstCategory = await firstCard.getAttribute('data-category');

    // Find a card in a different category
    const otherCard = page.locator(`.subsidy-card[data-category]:not([data-category="${firstCategory}"])`).first();
    const otherCount = await otherCard.count();
    test.skip(otherCount === 0, 'No card in a different category found — skipping');

    const otherId = await otherCard.getAttribute('data-id');
    expect(firstId).toBeTruthy();
    expect(otherId).toBeTruthy();

    await setTrackerItem(page, firstId!, '申請中');
    await setTrackerItem(page, otherId!, '已核准');
    await page.reload();

    // Apply firstCategory filter — hides the otherCard
    const categoryBtn = page.locator(`.filter-btn[data-category="${firstCategory}"]`).first();
    await categoryBtn.click();

    const btn = page.locator('#csvExportBtn');
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    const path = await download.path();
    const { readFileSync } = await import('fs');
    const content = readFileSync(path!, 'utf-8');

    // First card (visible) should be in the CSV
    expect(content).toContain('申請中');
    // Only 1 data row should be present — count non-empty lines that are not the header
    // (avoid naive \r\n split which breaks on quoted multi-line fields)
    const headerIdx = content.indexOf('補助名稱');
    const afterHeader = content.slice(headerIdx + content.slice(headerIdx).indexOf('\n') + 1).trim();
    // afterHeader should contain exactly one data row (no second \r\n-terminated line with tracked data)
    const dataLines = afterHeader.split('\r\n').filter(l => l.trim() !== '');
    expect(dataLines).toHaveLength(1);
  });
});
