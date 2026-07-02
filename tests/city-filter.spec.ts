import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface SubsidyEntry {
  id: string;
  title: string;
  counties?: string[];
}

test.describe('city/county filter — data integrity', () => {
  let subsidies: SubsidyEntry[];

  test.beforeAll(() => {
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    const raw: unknown = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(raw)) throw new Error('subsidies.json root must be an array');
    subsidies = raw as SubsidyEntry[];
  });

  test('city-specific entries have a non-empty counties array with valid strings', () => {
    const citySpecific = subsidies.filter(
      s => Array.isArray(s.counties) && s.counties.length > 0
    );
    // At least the two seed entries (social-housing-priority-points, senior-emergency-response-device)
    expect(citySpecific.length).toBeGreaterThan(0);
    for (const s of citySpecific) {
      for (const c of s.counties!) {
        expect(typeof c).toBe('string');
        expect(c.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('national entries have counties field absent or empty array', () => {
    const national = subsidies.filter(
      s => !Array.isArray(s.counties) || s.counties.length === 0
    );
    expect(national.length).toBeGreaterThan(0);
    // Every national entry either has no counties field or has an empty array
    for (const s of national) {
      const c = (s as any).counties;
      expect(c == null || (Array.isArray(c) && c.length === 0)).toBe(true);
    }
  });
});

test.describe('city/county filter — UI behaviour', () => {
  // senior-emergency-response-device has counties: ['台北市','新北市','基隆市','桃園市','台中市','台南市','高雄市','新竹市','新竹縣']
  // It does NOT include 花蓮縣 → selecting 花蓮縣 must hide it while national entries remain visible.

  test('county filter hides city-specific entry when selected county not in its counties list', async ({ page }) => {
    await page.goto('/');

    // Confirm the card is initially visible
    const targetCard = page.locator('#senior-emergency-response-device');
    await expect(targetCard).toBeVisible();

    // Select 花蓮縣 (not in the card's counties list)
    const countySelect = page.locator('#countySelect');
    await countySelect.selectOption('花蓮縣');
    await page.waitForTimeout(100);

    // The city-specific card should now be hidden
    const display = await targetCard.evaluate(el => (el as HTMLElement).style.display);
    expect(display).toBe('none');
  });

  test('county filter shows city-specific entry when selected county IS in its counties list', async ({ page }) => {
    await page.goto('/');

    const countySelect = page.locator('#countySelect');
    await countySelect.selectOption('台北市');
    await page.waitForTimeout(100);

    // senior-emergency-response-device includes 台北市 → must be visible
    const targetCard = page.locator('#senior-emergency-response-device');
    await expect(targetCard).toBeVisible();
  });

  test('national entries (empty counties) remain visible regardless of selected county', async ({ page }) => {
    await page.goto('/');

    const countySelect = page.locator('#countySelect');
    // youth-job-support has no counties field → national, always shown
    const nationalCard = page.locator('#youth-job-support');

    await countySelect.selectOption('台北市');
    await page.waitForTimeout(100);
    await expect(nationalCard).toBeVisible();

    await countySelect.selectOption('花蓮縣');
    await page.waitForTimeout(100);
    await expect(nationalCard).toBeVisible();
  });

  test('clearing county filter restores city-specific entry visibility', async ({ page }) => {
    await page.goto('/');

    const countySelect = page.locator('#countySelect');
    const targetCard = page.locator('#senior-emergency-response-device');

    // Hide it first
    await countySelect.selectOption('花蓮縣');
    await page.waitForTimeout(100);
    const hiddenDisplay = await targetCard.evaluate(el => (el as HTMLElement).style.display);
    expect(hiddenDisplay).toBe('none');

    // Clear filter (select empty option)
    await countySelect.selectOption('');
    await page.waitForTimeout(100);
    await expect(targetCard).toBeVisible();
  });
});
