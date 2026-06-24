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

    // Verify card CSS order values decrease (highest-value card has order=1)
    const cards = page.locator('.subsidy-card');
    const firstOrder = await cards.first().evaluate(el => (el as HTMLElement).style.order);
    const secondOrder = await cards.nth(1).evaluate(el => (el as HTMLElement).style.order);
    expect(Number(firstOrder)).toBeLessThan(Number(secondOrder));
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
