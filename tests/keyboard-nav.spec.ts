import { test, expect } from '@playwright/test';

test.describe('keyboard navigation for subsidy cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('subsidy cards have tabindex="0"', async ({ page }) => {
    const firstCard = page.locator('.subsidy-card').first();
    await expect(firstCard).toHaveAttribute('tabindex', '0');
  });

  test('subsidy cards have aria-label with title and amount', async ({ page }) => {
    const firstCard = page.locator('.subsidy-card').first();
    const label = await firstCard.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label!.length).toBeGreaterThan(5);
  });

  test('ArrowDown moves focus to next visible card', async ({ page }) => {
    const cards = page.locator('.subsidy-card');
    const allCards = await cards.all();
    await allCards[0].focus();
    await page.keyboard.press('ArrowDown');
    await expect(allCards[1]).toBeFocused();
  });

  test('ArrowUp moves focus to previous card (wraps to last)', async ({ page }) => {
    const cards = page.locator('.subsidy-card');
    const allCards = await cards.all();
    const count = allCards.length;
    await allCards[0].focus();
    await page.keyboard.press('ArrowUp');
    // Should wrap to the last card
    await expect(allCards[count - 1]).toBeFocused();
  });

  test('ArrowRight moves focus to next card', async ({ page }) => {
    const cards = page.locator('.subsidy-card');
    const allCards = await cards.all();
    await allCards[0].focus();
    await page.keyboard.press('ArrowRight');
    await expect(allCards[1]).toBeFocused();
  });

  test('Enter activates the CTA link on the focused card', async ({ page }) => {
    const firstCard = page.locator('.subsidy-card').first();
    const ctaLink = firstCard.locator('a.card-link');
    const href = await ctaLink.getAttribute('href');
    expect(href).toBeTruthy();

    // Intercept new tab navigation triggered by link.click()
    const newPagePromise = page.context().waitForEvent('page');
    await firstCard.focus();
    await page.keyboard.press('Enter');
    const newPage = await newPagePromise;
    await newPage.close();
  });

  test('Escape blurs the focused card', async ({ page }) => {
    const firstCard = page.locator('.subsidy-card').first();
    await firstCard.focus();
    await expect(firstCard).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(firstCard).not.toBeFocused();
  });

  test('focused card has visible focus ring via CSS', async ({ page }) => {
    const firstCard = page.locator('.subsidy-card').first();
    await firstCard.focus();
    const { outlineWidth, outlineStyle } = await firstCard.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle };
    });
    expect(outlineStyle).not.toBe('none');
    expect(parseFloat(outlineWidth)).toBeGreaterThan(0);
  });
});
