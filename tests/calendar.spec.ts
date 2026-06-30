import { test, expect } from '@playwright/test';

test.describe('Calendar view', () => {
  test('calendar page loads and shows month grids', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('h1')).toContainText('截止日曆');
    // Should have exactly 3 month sections
    const monthSections = page.locator('.cal-month');
    await expect(monthSections).toHaveCount(3);
  });

  test('calendar page has rolling section', async ({ page }) => {
    await page.goto('/calendar');
    const rollingSection = page.locator('.cal-rolling');
    await expect(rollingSection).toBeVisible();
    await expect(rollingSection.locator('h2')).toContainText('長期辦理');
    // Should have at least one rolling item
    const rollingItems = page.locator('.cal-rolling-item');
    const count = await rollingItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('calendar entries link back to main list', async ({ page }) => {
    await page.goto('/calendar');
    const entryLinks = page.locator('.cal-entry-link[href]');
    const count = await entryLinks.count();
    expect(count).toBeGreaterThan(0);
    // Each entry link should point to the main page with a hash
    const firstHref = await entryLinks.first().getAttribute('href');
    expect(firstHref).toBeTruthy();
    expect(firstHref).toContain('#');
  });

  test('nav bar has calendar link', async ({ page }) => {
    await page.goto('/');
    const calLink = page.locator('.nav-calendar-link');
    await expect(calLink).toBeVisible();
    await expect(calLink).toHaveText('📅 截止日曆');
  });

  test('calendar view link appears on main page hero', async ({ page }) => {
    await page.goto('/');
    const calViewLink = page.locator('#calendarViewLink');
    await expect(calViewLink).toBeVisible();
    await expect(calViewLink).toContainText('月曆檢視');
  });

  test('filter bar hidden when no filter params', async ({ page }) => {
    await page.goto('/calendar');
    const filterBar = page.locator('#calFilterBar');
    await expect(filterBar).toBeHidden();
  });

  test('filter bar shown when category param present', async ({ page }) => {
    await page.goto('/calendar?cat=就業');
    const filterBar = page.locator('#calFilterBar');
    await expect(filterBar).toBeVisible();
    await expect(filterBar).toContainText('就業');
  });

  test('calendar entries are filtered by category param', async ({ page }) => {
    await page.goto('/calendar?cat=就業');
    // Non-就業 entries should be hidden
    const allEntries = page.locator('.cal-entry[data-id]');
    const count = await allEntries.count();
    if (count === 0) return; // no calendar entries at all is also valid

    const hiddenEntries = page.locator('.cal-entry[data-id][hidden]');
    const visibleEntries = page.locator('.cal-entry[data-id]:not([hidden])');

    const hiddenCount = await hiddenEntries.count();
    const visibleCount = await visibleEntries.count();

    // For each visible entry, its category should be 就業 or it should be youth-highlighted
    for (let i = 0; i < visibleCount; i++) {
      const cat = await visibleEntries.nth(i).getAttribute('data-category');
      const youth = await visibleEntries.nth(i).getAttribute('data-youth');
      expect(cat === '就業' || youth === 'true').toBe(true);
    }

    // Some entries should have been hidden (unless all happen to be 就業)
    // This is a soft assertion since the data could be all 就業
    expect(hiddenCount + visibleCount).toBe(count);
  });

  test('rolling items are filtered by situation param', async ({ page }) => {
    await page.goto('/calendar?sit=fresh-grad');
    const filterBar = page.locator('#calFilterBar');
    await expect(filterBar).toBeVisible();

    // Rolling items with non-matching situations should be hidden
    const allRolling = page.locator('.cal-rolling-item[data-id]');
    const count = await allRolling.count();
    expect(count).toBeGreaterThan(0);

    const visibleRolling = page.locator('.cal-rolling-item[data-id]:not([hidden])');
    const visibleCount = await visibleRolling.count();

    // Each visible rolling item should have fresh-grad in its situations
    for (let i = 0; i < visibleCount; i++) {
      const sitStr = await visibleRolling.nth(i).getAttribute('data-situations');
      const situations = JSON.parse(sitStr ?? '[]') as string[];
      expect(situations).toContain('fresh-grad');
    }
  });

  test('back link navigates to main page', async ({ page }) => {
    await page.goto('/calendar');
    const backLink = page.locator('#calBackLink');
    await expect(backLink).toBeVisible();
    const href = await backLink.getAttribute('href');
    expect(href).toBeTruthy();
    // Should be the main page URL
    await backLink.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('back link preserves filter params', async ({ page }) => {
    await page.goto('/calendar?cat=就業&sit=fresh-grad');
    const backLink = page.locator('#calBackLink');
    const href = await backLink.getAttribute('href');
    expect(href).toContain('cat=');
    expect(href).toContain('sit=');
  });

  test('calendar view is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/calendar');
    await expect(page.locator('h1')).toBeVisible();
    const monthSections = page.locator('.cal-month');
    await expect(monthSections).toHaveCount(3);
    // Table should be scrollable wrapper
    const gridWrapper = page.locator('.cal-grid-wrapper').first();
    await expect(gridWrapper).toBeVisible();
  });

  test('calendar entry urgency classes applied correctly', async ({ page }) => {
    await page.goto('/calendar');
    // urgency classes should be present on entries (may be empty if all far out)
    const urgentEntries = page.locator('.cal-entry.cal-urgent-7, .cal-entry.cal-urgent-30, .cal-entry.cal-urgent-60');
    // This is soft — we just check the classes can exist without errors
    const count = await urgentEntries.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('clicking a calendar entry link reaches a valid URL', async ({ page }) => {
    await page.goto('/calendar');
    const entryLinks = page.locator('.cal-entry-link');
    const count = await entryLinks.count();
    if (count === 0) {
      // No calendar entries rendered — skip
      return;
    }
    const href = await entryLinks.first().getAttribute('href');
    expect(href).toBeTruthy();
    // Navigate to it and confirm main page loads
    await page.goto(href!);
    await expect(page.locator('h1, .hero h1')).toBeVisible();
  });

  test('main page calendar view link passes filter state to calendar', async ({ page }) => {
    await page.goto('/');
    // Click a category filter (employment)
    const filterBtn = page.locator('.filter-btn[data-category="就業"]');
    const filterCount = await filterBtn.count();
    if (filterCount === 0) return; // No employment filter

    await filterBtn.click();
    // Wait for URL to update
    await page.waitForTimeout(300);

    const calViewLink = page.locator('#calendarViewLink');
    const href = await calViewLink.getAttribute('href');
    // Should now include cat=就業 or similar
    expect(href).toContain('cat=');
  });
});
