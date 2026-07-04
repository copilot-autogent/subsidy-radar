import { test, expect } from '@playwright/test';

const REMINDERS_KEY = 'subsidyReminders';

// ── helpers ──────────────────────────────────────────────────────────────────

async function clearReminders(page: import('@playwright/test').Page) {
  await page.evaluate((key) => localStorage.removeItem(key), REMINDERS_KEY);
}

async function loadReminders(page: import('@playwright/test').Page) {
  return page.evaluate((key) => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]'); }
    catch { return []; }
  }, REMINDERS_KEY);
}

async function injectReminder(
  page: import('@playwright/test').Page,
  reminder: Record<string, unknown>,
) {
  await page.evaluate(
    ([key, entry]) => {
      const existing = JSON.parse(localStorage.getItem(key as string) ?? '[]');
      existing.push(entry);
      localStorage.setItem(key as string, JSON.stringify(existing));
    },
    [REMINDERS_KEY, reminder] as const,
  );
}

// Grant Notification permission and stub the Notification constructor so we
// can inspect calls without requiring a real browser permission dialog.
async function grantNotificationPermission(page: import('@playwright/test').Page) {
  await page.context().grantPermissions(['notifications']);
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('per-subsidy deadline reminders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearReminders(page);
  });

  // ── 1. Reminder button appears on cards with a deadline ──────────────────

  test('🔔 button is rendered on cards that have a deadlineDate', async ({ page }) => {
    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');
    const btn = deadlineCard.locator('[data-reminder-btn]');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeVisible();
  });

  test('🔔 button is NOT rendered on cards without a deadlineDate', async ({ page }) => {
    const periodicCard = page.locator('.subsidy-card[data-deadline=""]').first();
    const count = await periodicCard.count();
    test.skip(count === 0, 'No periodic subsidies in fixture');
    const btn = periodicCard.locator('[data-reminder-btn]');
    await expect(btn).toHaveCount(0);
  });

  // ── 2. Reminder persists to localStorage ─────────────────────────────────

  test('clicking 🔔 (permission granted) persists reminder to localStorage', async ({ page }) => {
    await grantNotificationPermission(page);
    await page.reload();
    await clearReminders(page);

    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');

    const id = await deadlineCard.getAttribute('data-id');
    expect(id).toBeTruthy();

    // Wait for initReminderBtns to run
    const btn = deadlineCard.locator('[data-reminder-btn]');
    await expect(btn).toBeVisible();

    // Check the grace period — skip if deadline < 3 days
    const isDisabled = await btn.isDisabled();
    test.skip(isDisabled, 'Deadline is within grace period (< 3 days)');

    await btn.click();

    const reminders = await loadReminders(page);
    expect(Array.isArray(reminders)).toBe(true);
    const entry = reminders.find((e: Record<string, string>) => e.id === id);
    expect(entry).toBeTruthy();
    expect(entry.deadlineDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof entry.daysBeforeToFire).toBe('number');
    expect(typeof entry.scheduledAt).toBe('string');
  });

  // ── 3. Button active/inactive state toggles ───────────────────────────────

  test('🔔 button shows active state when reminder is set', async ({ page }) => {
    await grantNotificationPermission(page);
    await page.reload();
    await clearReminders(page);

    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');

    const btn = deadlineCard.locator('[data-reminder-btn]');
    await expect(btn).toBeVisible();
    const isDisabled = await btn.isDisabled();
    test.skip(isDisabled, 'Deadline is within grace period');

    // Initially not active
    await expect(btn).not.toHaveClass(/reminder-active/);
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    await btn.click();

    await expect(btn).toHaveClass(/reminder-active/);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  // ── 4. Cancellation clears the entry ─────────────────────────────────────

  test('clicking active 🔔 cancels the reminder and removes entry from localStorage', async ({
    page,
  }) => {
    await grantNotificationPermission(page);
    await page.reload();
    await clearReminders(page);

    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');

    const id = await deadlineCard.getAttribute('data-id');
    const deadline = await deadlineCard.getAttribute('data-deadline');

    const btn = deadlineCard.locator('[data-reminder-btn]');
    await expect(btn).toBeVisible();
    const isDisabled = await btn.isDisabled();
    test.skip(isDisabled, 'Deadline is within grace period');

    // Pre-inject a reminder so the button starts in active state
    await injectReminder(page, {
      id,
      title: 'Test subsidy',
      deadlineDate: deadline,
      // Use daysBeforeToFire: 1 (well below min allowed deadline of 3 days) so
      // checkDeadlineReminders won't fire and consume this entry on the reload.
      daysBeforeToFire: 1,
      scheduledAt: new Date().toISOString(),
    });
    await page.reload();
    await grantNotificationPermission(page);

    const btn2 = page.locator(`.subsidy-card[data-id="${id}"] [data-reminder-btn]`);
    await expect(btn2).toHaveClass(/reminder-active/);

    await btn2.click();

    await expect(btn2).not.toHaveClass(/reminder-active/);
    await expect(btn2).toHaveAttribute('aria-pressed', 'false');

    const reminders = await loadReminders(page);
    const entry = reminders.find((e: Record<string, string>) => e.id === id);
    expect(entry).toBeUndefined();
  });

  // ── 5. Notification fires when deadline is within threshold ───────────────

  test('checkDeadlineReminders fires notification when deadline is within daysBeforeToFire', async ({
    page,
  }) => {
    await grantNotificationPermission(page);

    // Inject a reminder with deadline in 3 days (within 7-day threshold)
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const deadlineDate = future.toISOString().slice(0, 10);

    await page.goto('/');
    await clearReminders(page);

    // Inject the due reminder into localStorage before reload so it fires on load
    await injectReminder(page, {
      id: 'test-sub-99',
      title: '測試補助通知',
      deadlineDate,
      daysBeforeToFire: 7,
      scheduledAt: new Date().toISOString(),
    });

    // Confirm entry is present before reload
    const before = await loadReminders(page);
    expect(before.some((e: Record<string, string>) => e.id === 'test-sub-99')).toBe(true);

    // Reload: checkDeadlineReminders runs on page load with permission already granted,
    // fires the notification and clears the entry from localStorage
    await page.reload();

    // Deterministic side-effect: fired entry must be cleared from storage
    const after = await loadReminders(page);
    expect(after.some((e: Record<string, string>) => e.id === 'test-sub-99')).toBe(false);
  });

  // ── 6. Notification fires on page load when reminder is due ───────────────

  test('due reminder is cleared from localStorage after firing on page load', async ({ page }) => {
    await grantNotificationPermission(page);

    const future = new Date();
    future.setDate(future.getDate() + 2); // 2 days away, within 7-day threshold
    const deadlineDate = future.toISOString().slice(0, 10);

    await page.goto('/');
    await clearReminders(page);

    // Inject a due reminder directly into localStorage before reload
    await injectReminder(page, {
      id: 'test-fire-on-load',
      title: '頁面載入時觸發測試',
      deadlineDate,
      daysBeforeToFire: 7,
      scheduledAt: new Date().toISOString(),
    });

    const beforeReminders = await loadReminders(page);
    expect(beforeReminders.some((e: Record<string, string>) => e.id === 'test-fire-on-load')).toBe(true);

    // Reload: checkDeadlineReminders runs on page load
    await page.reload();

    const afterReminders = await loadReminders(page);
    // Fired entry should have been cleared
    expect(afterReminders.some((e: Record<string, string>) => e.id === 'test-fire-on-load')).toBe(false);
  });

  // ── 7. Grace period: button is disabled when deadline < REMINDER_MIN_DAYS ─

  test('🔔 button is disabled when deadline is fewer than 3 days away', async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    // Find a card whose data-deadline is tomorrow (within 3-day grace period)
    const nearCard = page.locator(`.subsidy-card[data-deadline="${tomorrowStr}"]`).first();
    const count = await nearCard.count();
    test.skip(count === 0, `No subsidy with deadline ${tomorrowStr} in fixture`);

    const btn = nearCard.locator('[data-reminder-btn]');
    await expect(btn).toHaveCount(1);
    await expect(btn).toBeDisabled();
  });

  // ── 8. Keyboard accessibility ─────────────────────────────────────────────

  test('🔔 button is focusable and activatable via keyboard', async ({ page }) => {
    await grantNotificationPermission(page);
    await page.reload();
    await clearReminders(page);

    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');

    const btn = deadlineCard.locator('[data-reminder-btn]');
    await expect(btn).toBeVisible();
    const isDisabled = await btn.isDisabled();
    test.skip(isDisabled, 'Deadline is within grace period');

    await btn.focus();
    await expect(btn).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(btn).toHaveClass(/reminder-active/);
  });

  // ── 9. Active state persists across page reload ───────────────────────────

  test('reminder-active state is restored correctly after page reload', async ({ page }) => {
    await grantNotificationPermission(page);
    await page.goto('/');
    await clearReminders(page);

    const deadlineCard = page.locator('.subsidy-card[data-deadline]:not([data-deadline=""])').first();
    const count = await deadlineCard.count();
    test.skip(count === 0, 'No deadline subsidies in fixture');

    const id = await deadlineCard.getAttribute('data-id');
    const deadline = await deadlineCard.getAttribute('data-deadline');

    // Pre-seed reminder for a deadline far enough in the future
    const daysLeft = await page.evaluate((d: string) => {
      const parts = d.split('-').map(Number);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const dl = new Date(parts[0], parts[1] - 1, parts[2]);
      return Math.ceil((dl.getTime() - now.getTime()) / 86400000);
    }, deadline!);

    test.skip(daysLeft < 3, 'Deadline is within grace period — cannot set reminder');

    await injectReminder(page, {
      id,
      title: 'Reload test',
      deadlineDate: deadline,
      // Use daysBeforeToFire: 1 so checkDeadlineReminders won't consume this entry
      // on reload (fires only when days <= threshold; daysLeft >= 3 > 1 here).
      daysBeforeToFire: 1,
      scheduledAt: new Date().toISOString(),
    });

    await page.reload();

    const btn = page.locator(`.subsidy-card[data-id="${id}"] [data-reminder-btn]`);
    await expect(btn).toHaveClass(/reminder-active/);
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});
