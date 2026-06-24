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

  test('active cards with future deadlines do NOT have card-expired class', async ({ page }) => {
    // Locate any card whose data-deadline attribute is in the future
    const allCards = page.locator('.subsidy-card[data-deadline]');
    const count = await allCards.count();

    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i);
      const deadline = await card.getAttribute('data-deadline');
      if (!deadline) continue;
      const [y, m, d] = deadline.split('-').map(Number);
      const dl = new Date(y, m - 1, d);
      if (dl >= new Date()) {
        // This card's deadline is still in the future — must not be expired
        await expect(card).not.toHaveClass(/card-expired/);
        const badge = card.locator('[data-deadline-badge]');
        if (await badge.count() > 0) {
          await expect(badge).not.toHaveText('已截止');
        }
        break; // one sample is enough
      }
    }
  });
});
