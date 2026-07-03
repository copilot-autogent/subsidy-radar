import { test, expect } from '@playwright/test';

test.describe('dark mode', () => {
  test('toggle button is present and accessible', async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#theme-toggle');
    await expect(btn).toBeVisible();
    // Tap target: at least 44×44px
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('clicking toggle switches to dark mode', async ({ page }) => {
    // Start with light mode forced
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });

    const btn = page.locator('#theme-toggle');
    await btn.click();

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('dark');

    const saved = await page.evaluate(() => localStorage.getItem('theme'));
    expect(saved).toBe('dark');

    const icon = await btn.textContent();
    expect(icon!.trim()).toBe('☀️');
  });

  test('clicking toggle switches from dark back to light', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const btn = page.locator('#theme-toggle');
    await btn.click();

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');

    const saved = await page.evaluate(() => localStorage.getItem('theme'));
    expect(saved).toBe('light');

    const icon = await btn.textContent();
    expect(icon!.trim()).toBe('🌙');
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.goto('/');

    // Set dark via toggle
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.locator('#theme-toggle').click();

    // Reload the page
    await page.reload();

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('dark');
  });

  test('FAWT: data-theme set before body renders (inline script in head)', async ({ page }) => {
    // Seed localStorage BEFORE navigation so the FAWT head-script reads it on cold load
    await page.addInitScript(() => { localStorage.setItem('theme', 'dark'); });
    await page.emulateMedia({ colorScheme: 'light' }); // system = light, but saved = dark
    await page.goto('/');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('dark');
  });

  test('system default: light preference uses light theme', async ({ page }) => {
    await page.addInitScript(() => { localStorage.removeItem('theme'); });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');
  });

  test('saved "light" overrides dark system preference', async ({ page }) => {
    // Seed localStorage BEFORE navigation so FAWT head-script picks it up
    await page.addInitScript(() => { localStorage.setItem('theme', 'light'); });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(theme).toBe('light');
  });

  test('dark mode applies correct background color', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim()
    );
    expect(bgColor).toBe('#0d1117');
  });

  test('toggle is reachable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const btn = page.locator('#theme-toggle');
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
