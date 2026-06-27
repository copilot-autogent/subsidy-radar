import { test, expect } from '@playwright/test';

test.describe('JSON-LD structured data', () => {
  test('page contains application/ld+json script tag', async ({ page }) => {
    await page.goto('/');
    const scriptContent = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? el.textContent : null;
    });
    expect(scriptContent).not.toBeNull();
  });

  test('JSON-LD is valid JSON with ItemList type', async ({ page }) => {
    await page.goto('/');
    const scriptContent = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? el.textContent : null;
    });
    const data = JSON.parse(scriptContent!);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('ItemList');
    expect(data.name).toBe('台灣政府補助清單');
  });

  test('ItemList contains at least one ListItem with name and unique url', async ({ page }) => {
    await page.goto('/');
    const scriptContent = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? el.textContent : null;
    });
    const data = JSON.parse(scriptContent!);
    const items: { '@type': string; position: number; name: string; url: string }[] = data.itemListElement;
    expect(items.length).toBeGreaterThan(0);
    const first = items[0];
    expect(first['@type']).toBe('ListItem');
    expect(first.position).toBe(1);
    expect(typeof first.name).toBe('string');
    expect(first.name.length).toBeGreaterThan(0);
    expect(first.url).toContain('http');
    // Each item URL should be unique (fragment-based)
    const urls = new Set(items.map(i => i.url));
    expect(urls.size).toBe(items.length);
  });
});
