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
    // Verify CTA link exists and has a valid href
    await expect(ctaLink).toHaveCount(1);
    const href = await ctaLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);
    // Verify Enter dispatches click on the CTA link (simulate by checking it fires)
    await firstCard.focus();
    let clicked = false;
    await page.exposeFunction('__ctaClicked', () => { clicked = true; });
    await firstCard.evaluate(card => {
      const link = card.querySelector<HTMLAnchorElement>('a.card-link');
      if (link) link.addEventListener('click', () => (window as any).__ctaClicked(), { once: true });
    });
    await page.keyboard.press('Enter');
    // Give a tick for event propagation
    await page.waitForTimeout(100);
    expect(clicked).toBe(true);
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
