import { test, expect } from '@playwright/test';

test.describe('依金額高低 sort button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('sort button is visible in the sort row', async ({ page }) => {
    const btn = page.getByRole('button', { name: '依金額高低' });
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  test('first click sorts cards high→low by amount', async ({ page }) => {
    const btn = page.getByRole('button', { name: /依金額高低|金額高→低/ });
    await btn.click();

    await expect(btn).toContainText('金額高→低');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');

    // Verify the card ranked #1 has a higher amount than the card ranked #2.
    // (CSS `order` assigns 1..N; DOM order is unchanged — use data-amount-value.)
    const allCards = page.locator('.subsidy-card');
    const count = await allCards.count();
    const orderValuePairs: { order: number; amount: number }[] = [];
    for (let i = 0; i < count; i++) {
      const card = allCards.nth(i);
      const order = await card.evaluate(el => Number((el as HTMLElement).style.order) || 0);
      const amount = await card.evaluate(el => Number((el as HTMLElement).dataset.amountValue ?? 0));
      orderValuePairs.push({ order, amount });
    }
    // All cards should have a numeric order assigned
    expect(orderValuePairs.every(p => p.order > 0)).toBe(true);
    // Order 1 (highest) should have an amount >= order 2
    const rank1 = orderValuePairs.find(p => p.order === 1)!;
    const rank2 = orderValuePairs.find(p => p.order === 2)!;
    expect(rank1.amount).toBeGreaterThanOrEqual(rank2.amount);
  });

  test('second click sorts cards low→high by amount', async ({ page }) => {
    const btn = page.getByRole('button', { name: /依金額高低|金額/ });
    await btn.click(); // high→low
    await btn.click(); // low→high

    await expect(btn).toContainText('金額低→高');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('third click resets sort to default', async ({ page }) => {
    const btn = page.getByRole('button', { name: /依金額高低|金額/ });
    await btn.click(); // high→low
    await btn.click(); // low→high
    await btn.click(); // reset

    await expect(btn).toHaveText('依金額高低');
    await expect(btn).toHaveAttribute('aria-pressed', 'false');

    // Cards should have no order style after reset
    const cards = page.locator('.subsidy-card');
    const order = await cards.first().evaluate(el => (el as HTMLElement).style.order);
    expect(order).toBe('');
  });

  test('activating amount sort deactivates difficulty sort', async ({ page }) => {
    const diffBtn = page.getByRole('button', { name: /依申請難度/ });
    const amountBtn = page.getByRole('button', { name: /依金額/ });

    await diffBtn.click(); // activate difficulty sort
    await expect(diffBtn).toHaveAttribute('aria-pressed', 'true');

    await amountBtn.click(); // activate amount sort
    await expect(diffBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(amountBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
