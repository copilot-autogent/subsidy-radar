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

  test('all ListItems have required fields, correct positions, and unique fragment URLs', async ({ page }) => {
    await page.goto('/');
    const scriptContent = await page.evaluate(() => {
      const el = document.querySelector('script[type="application/ld+json"]');
      return el ? el.textContent : null;
    });
    const data = JSON.parse(scriptContent!);
    const items: { '@type': string; position: number; name: string; url: string }[] = data.itemListElement;
    expect(items.length).toBeGreaterThan(0);

    items.forEach((item, index) => {
      expect(item['@type']).toBe('ListItem');
      expect(item.position).toBe(index + 1);
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.url).toMatch(/^https?:\/\/.+#.+/);
    });

    // All URLs must be unique (each subsidy has its own fragment anchor)
    const urls = new Set(items.map(i => i.url));
    expect(urls.size).toBe(items.length);

    // Each fragment must correspond to an actual element id on the page
    const ids = items.map(i => new URL(i.url).hash.slice(1));
    for (const id of ids) {
      const el = await page.locator(`#${CSS.escape(id)}`).first();
      await expect(el).toBeAttached();
    }
  });
});
