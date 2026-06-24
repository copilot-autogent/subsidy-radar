import { test, expect } from '@playwright/test';

test.describe('expired subsidy — 已截止 badge and dimmed card', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('expired card shows 已截止 badge (grey, not countdown)', async ({ page }) => {
    const expiredCard = page.locator('#youth-startup-loan-2025');
    await expect(expiredCard).toBeVisible();

    const badge = expiredCard.locator('[data-deadline-badge]');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('已截止');
    await expect(badge).toHaveClass(/countdown-expired/);
    // Must NOT have any countdown-urgent/soon/ok class
    await expect(badge).not.toHaveClass(/countdown-urgent|countdown-soon|countdown-ok/);
  });

  test('expired card has card-expired class (dimmed)', async ({ page }) => {
    const expiredCard = page.locator('#youth-startup-loan-2025');
    await expect(expiredCard).toHaveClass(/card-expired/);
  });

  test('expired card is still visible (not hidden)', async ({ page }) => {
    const expiredCard = page.locator('#youth-startup-loan-2025');
    await expect(expiredCard).toBeVisible();
  });

  test('non-expired cards with deadlineDate do NOT have card-expired class', async ({ page }) => {
    // youth-job-support has deadlineDate 2026-12-31 (active)
    const activeCard = page.locator('#youth-job-support');
    await expect(activeCard).toBeVisible();
    await expect(activeCard).not.toHaveClass(/card-expired/);
  });

  test('non-expired card countdown badge shows days remaining, not 已截止', async ({ page }) => {
    const badge = page.locator('#youth-job-support [data-deadline-badge]');
    await expect(badge).toBeVisible();
    await expect(badge).not.toHaveText('已截止');
    await expect(badge).not.toHaveClass(/countdown-expired/);
  });
});
