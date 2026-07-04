import { test, expect } from '@playwright/test';

test.describe('PWA: Web App Manifest', () => {
  test('manifest.json is reachable and valid JSON', async ({ page }) => {
    const response = await page.request.get('/subsidy-radar/manifest.json');
    expect(response.status()).toBe(200);

    const text = await response.text();
    const manifest = JSON.parse(text);

    expect(manifest.name).toBe('補助雷達');
    expect(manifest.short_name).toBe('補助雷達');
    expect(manifest.lang).toBe('zh-TW');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/subsidy-radar/');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1);
  });

  test('manifest.json has 192x192 and 512x512 PNG icons', async ({ page }) => {
    const response = await page.request.get('/subsidy-radar/manifest.json');
    const manifest = JSON.parse(await response.text());

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    const pngIcons = manifest.icons.filter((i: { type: string }) => i.type === 'image/png');
    expect(pngIcons.length).toBeGreaterThanOrEqual(2);
  });

  test('manifest link tag is present in HTML head', async ({ page }) => {
    await page.goto('/');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();
    const href = await manifestLink.getAttribute('href');
    expect(href).toContain('manifest.json');
  });

  test('theme-color meta tag is present', async ({ page }) => {
    await page.goto('/');
    const metaTheme = page.locator('meta[name="theme-color"]');
    await expect(metaTheme).toBeAttached();
    const content = await metaTheme.getAttribute('content');
    expect(content).toBe('#2563eb');
  });

  test('apple-mobile-web-app-capable meta is present', async ({ page }) => {
    await page.goto('/');
    const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleMeta).toBeAttached();
  });

  test('apple-mobile-web-app-title meta is present', async ({ page }) => {
    await page.goto('/');
    const appleTitle = page.locator('meta[name="apple-mobile-web-app-title"]');
    await expect(appleTitle).toBeAttached();
    const content = await appleTitle.getAttribute('content');
    expect(content).toBe('補助雷達');
  });

  test('PNG icon files are reachable', async ({ page }) => {
    const icon192 = await page.request.get('/subsidy-radar/icons/icon-192.png');
    expect(icon192.status()).toBe(200);
    expect(icon192.headers()['content-type']).toContain('image/png');

    const icon512 = await page.request.get('/subsidy-radar/icons/icon-512.png');
    expect(icon512.status()).toBe(200);
    expect(icon512.headers()['content-type']).toContain('image/png');
  });
});

test.describe('PWA: Service Worker', () => {
  test('service worker script is reachable', async ({ page }) => {
    const response = await page.request.get('/subsidy-radar/sw.js');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('CACHE_NAME');
    expect(text).toContain('install');
    expect(text).toContain('fetch');
  });

  test('service worker registers without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && msg.text().includes('SW registration failed')) {
        errors.push(msg.text());
      }
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('dataset (subsidies.json data) loads when page is online', async ({ page }) => {
    await page.goto('/');
    // Verify subsidy cards are present — they come from subsidies.json embedded at build time
    const cards = page.locator('.subsidy-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('PWA: Offline indicator', () => {
  test('offline indicator element is in DOM', async ({ page }) => {
    await page.goto('/');
    const indicator = page.locator('#offline-indicator');
    await expect(indicator).toBeAttached();
    // Should be hidden when online
    await expect(indicator).toBeHidden();
  });

  test('offline indicator appears when offline', async ({ page }) => {
    await page.goto('/');
    // Simulate offline
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    const indicator = page.locator('#offline-indicator');
    await expect(indicator).toBeVisible();
    // Restore online
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(indicator).toBeHidden();
  });
});

test.describe('PWA: Install banner', () => {
  test('install banner element is in DOM but hidden initially', async ({ page }) => {
    await page.goto('/');
    const banner = page.locator('#install-banner');
    await expect(banner).toBeAttached();
    // Hidden until beforeinstallprompt fires or pwa-install-dismissed is set
    await expect(banner).toBeHidden();
  });

  test('dismiss button hides the banner and persists dismissal', async ({ page }) => {
    await page.goto('/');
    // Force banner visible by removing hidden attribute
    await page.evaluate(() => {
      const el = document.getElementById('install-banner');
      if (el) el.removeAttribute('hidden');
    });
    const banner = page.locator('#install-banner');
    await expect(banner).toBeVisible();

    await page.locator('#install-dismiss').click();
    await expect(banner).toBeHidden();

    const dismissed = await page.evaluate(() => localStorage.getItem('pwa-install-dismissed'));
    expect(dismissed).toBe('1');
  });

  test('banner stays hidden when pwa-install-dismissed is set', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('pwa-install-dismissed', '1');
    });
    await page.goto('/');
    const banner = page.locator('#install-banner');
    // Banner should remain hidden even if beforeinstallprompt fires
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt');
      window.dispatchEvent(e);
    });
    await expect(banner).toBeHidden();
  });
});
