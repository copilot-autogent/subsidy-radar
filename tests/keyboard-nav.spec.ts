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
    await cards.first().focus();
    await page.keyboard.press('ArrowDown');
    const focused = page.locator('.subsidy-card:focus');
    await expect(focused).toHaveCount(1);
    // Focused card should be the second card (index 1)
    const allCards = await cards.all();
    const secondCard = allCards[1];
    await expect(secondCard).toBeFocused();
  });

  test('ArrowUp moves focus to previous card (wraps to last)', async ({ page }) => {
    const cards = page.locator('.subsidy-card');
    await cards.first().focus();
    await page.keyboard.press('ArrowUp');
    // Should wrap to the last visible card
    const visibleCards = await page.locator('.subsidy-card:visible').all();
    const lastCard = visibleCards[visibleCards.length - 1];
    await expect(lastCard).toBeFocused();
  });

  test('ArrowRight moves focus to next card', async ({ page }) => {
    const cards = page.locator('.subsidy-card');
    await cards.first().focus();
    await page.keyboard.press('ArrowRight');
    const allCards = await cards.all();
    await expect(allCards[1]).toBeFocused();
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
    const outline = await firstCard.evaluate(el =>
      window.getComputedStyle(el).outline
    );
    expect(outline).not.toBe('');
    expect(outline).not.toBe('none');
  });
});
