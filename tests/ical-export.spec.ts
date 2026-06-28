import { test, expect } from '@playwright/test';

// Helpers to interact with localStorage tracker via page.evaluate
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

test.describe('iCal export button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearTracker(page);
  });

  test('export button is hidden when no subsidies are tracked', async ({ page }) => {
    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeHidden();
  });

  test('export button remains hidden when tracked subsidy has no deadlineDate', async ({ page }) => {
    // Find a card that has no data-deadline (periodic subsidy)
    const periodicCard = page.locator('.subsidy-card[data-deadline=""]').first();
    const count = await periodicCard.count();
    // Mark as skipped explicitly if the fixture has no periodic subsidies
    test.skip(count === 0, 'No periodic (no-deadline) subsidies in fixture — skipping');
    const periodicId = await periodicCard.getAttribute('data-id');
    if (!periodicId) return;

    await setTrackerItem(page, periodicId, '已申請');
    await page.reload();
    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeHidden();
  });

  test('export button appears when a tracked subsidy has a deadlineDate', async ({ page }) => {
    // Find a card with a deadlineDate
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    await expect(deadlineCard).toHaveCount(1);
    const id = await deadlineCard.getAttribute('data-id');
    expect(id).toBeTruthy();

    await setTrackerItem(page, id!, '已申請');
    await page.reload();
    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeVisible();
  });

  test('export button appears dynamically (without reload) when tracker status is updated via UI', async ({ page }) => {
    // Find a card with a deadline and click its tracker button twice to get to 已申請
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    await expect(deadlineCard).toHaveCount(1);

    const trackerBtn = deadlineCard.locator('.tracker-btn');
    // Click to cycle from 未申請 → 已申請
    await trackerBtn.click();
    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeVisible();
  });

  test('export button is keyboard-accessible (Tab-focusable and Enter-activates)', async ({ page }) => {
    // Seed a tracked subsidy with a deadline
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const id = await deadlineCard.getAttribute('data-id');
    expect(id).toBeTruthy();
    await setTrackerItem(page, id!, '已申請');
    await page.reload();

    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeVisible();

    // Tab to focus the button
    await btn.focus();
    await expect(btn).toBeFocused();

    // Intercept download triggered by Enter
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.keyboard.press('Enter'),
    ]);
    expect(download.suggestedFilename()).toBe('subsidy-deadlines.ics');
  });

  test('downloaded .ics file contains VCALENDAR and VEVENT for the tracked subsidy', async ({ page }) => {
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const id = await deadlineCard.getAttribute('data-id');
    expect(id).toBeTruthy();
    const deadlineDate = await deadlineCard.getAttribute('data-deadline');
    expect(deadlineDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await setTrackerItem(page, id!, '已申請');
    await page.reload();

    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    const path = await download.path();
    const { readFileSync } = await import('fs');
    const content = readFileSync(path!, 'utf-8');

    expect(content).toContain('BEGIN:VCALENDAR');
    expect(content).toContain('END:VCALENDAR');
    expect(content).toContain('BEGIN:VEVENT');
    expect(content).toContain('END:VEVENT');
    // Deadline date should appear (YYYYMMDD format)
    const dateCompact = deadlineDate!.replace(/-/g, '');
    expect(content).toContain(`DTSTART;VALUE=DATE:${dateCompact}`);
    // Must include 申請截止 in the SUMMARY
    expect(content).toContain('申請截止');
    // VALARM reminder present
    expect(content).toContain('BEGIN:VALARM');
  });

  test('subsidies without deadlineDate are omitted from the .ics', async ({ page }) => {
    const periodicCard = page.locator('.subsidy-card[data-deadline=""]').first();
    const count = await periodicCard.count();
    if (count === 0) return; // no periodic subsidies in fixture — skip

    const periodicId = await periodicCard.getAttribute('data-id');
    if (!periodicId) return;

    // Also track a deadline subsidy to make the button visible
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const deadlineId = await deadlineCard.getAttribute('data-id');
    expect(deadlineId).toBeTruthy();

    await setTrackerItem(page, periodicId, '已申請');
    await setTrackerItem(page, deadlineId!, '已申請');
    await page.reload();

    const btn = page.locator('#icalExportBtn');
    await expect(btn).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      btn.click(),
    ]);

    const path = await download.path();
    const { readFileSync } = await import('fs');
    const content = readFileSync(path!, 'utf-8');

    // The periodic subsidy should NOT appear as a UID
    expect(content).not.toContain(`subsidy-${periodicId}@`);
    // The deadline subsidy should appear
    expect(content).toContain(`subsidy-${deadlineId}@`);
  });
});
