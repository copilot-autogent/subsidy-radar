import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface SubsidyEntry {
  id: string;
  title: string;
  agency?: string;
}

/** Mirror of the build-time normalizeAgency function — must stay in sync. */
function normalizeAgency(agency: string): string {
  if (!agency) return '其他';
  if (agency.startsWith('衛生福利部')) return '衛福部';
  if (agency.startsWith('勞動部')) return '勞動部';
  if (agency.startsWith('教育部')) return '教育部';
  if (agency.startsWith('內政部') || agency.startsWith('國家住宅及都市更新中心')) return '內政部';
  if (agency.startsWith('原住民族')) return '原民會';
  if (agency.startsWith('國家科學及技術委員會')) return '國科會';
  if (agency.startsWith('經濟部')) return '經濟部';
  if (agency.startsWith('財政部')) return '財政部';
  if (agency.startsWith('各縣市')) return '各縣市';
  return '其他';
}

test.describe('agency filter — data integrity', () => {
  let subsidies: SubsidyEntry[];

  test.beforeAll(() => {
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    const raw: unknown = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(raw)) throw new Error('subsidies.json root must be an array');
    subsidies = raw as SubsidyEntry[];
  });

  test('all 61 entries have an agency field', () => {
    const missing = subsidies.filter(s => !s.agency || typeof s.agency !== 'string' || s.agency.trim() === '');
    expect(missing.map(s => s.id)).toEqual([]);
    expect(subsidies.length).toBeGreaterThan(0);
  });

  test('normalizeAgency maps every entry to a known group', () => {
    const VALID_GROUPS = new Set(['勞動部', '衛福部', '內政部', '教育部', '原民會', '國科會', '經濟部', '財政部', '各縣市', '其他']);
    for (const s of subsidies) {
      const group = normalizeAgency(s.agency ?? '');
      expect(VALID_GROUPS.has(group), `Unknown group "${group}" for agency "${s.agency}" (id: ${s.id})`).toBe(true);
    }
  });
});

test.describe('agency filter — UI behaviour', () => {
  // Helper: count visible subsidy cards on the page
  async function countVisibleCards(page: import('@playwright/test').Page): Promise<number> {
    return page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => (c as HTMLElement).style.display !== 'none').length
    );
  }

  test('agency chip strip renders a chip for each agency group present in dataset', async ({ page }) => {
    await page.goto('/');

    // Derive expected groups from the actual dataset (same logic as build-time)
    const dataPath = new URL('../src/data/subsidies.json', import.meta.url);
    const raw: unknown = JSON.parse(readFileSync(fileURLToPath(dataPath), 'utf-8'));
    const allSubsidies = raw as SubsidyEntry[];
    const groupsInData = new Set(allSubsidies.map(s => normalizeAgency(s.agency ?? '')).filter(g => g !== '其他'));

    for (const group of groupsInData) {
      const chip = page.locator(`.agency-chip[data-agency="${group}"]`);
      await expect(chip, `chip for group "${group}" should be visible`).toBeVisible();
    }
  });

  test('clicking 勞動部 chip filters cards to only 勞動部 entries', async ({ page }) => {
    await page.goto('/');

    const labourChip = page.locator('.agency-chip[data-agency="勞動部"]');
    await expect(labourChip).toBeVisible();
    await labourChip.click();
    await page.waitForTimeout(100);

    // Chip should be marked active
    await expect(labourChip).toHaveAttribute('aria-pressed', 'true');
    await expect(labourChip).toHaveClass(/active/);

    // All visible cards should have data-agency="勞動部"
    const visibleCount = await countVisibleCards(page);
    expect(visibleCount).toBeGreaterThan(0);

    const nonMatchingVisible = await page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => {
        const el = c as HTMLElement;
        return el.style.display !== 'none' && el.dataset.agency !== '勞動部';
      }).length
    );
    expect(nonMatchingVisible).toBe(0);
  });

  test('clicking active agency chip again clears filter', async ({ page }) => {
    await page.goto('/');

    const chip = page.locator('.agency-chip[data-agency="衛福部"]');
    await chip.click();
    await page.waitForTimeout(100);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    await chip.click();
    await page.waitForTimeout(100);
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    // All cards should be visible again
    const visibleCount = await countVisibleCards(page);
    const totalCards = await page.locator('.subsidy-card').count();
    expect(visibleCount).toBe(totalCards);
  });

  test('?agency=衛福部 URL param pre-applies agency filter on load', async ({ page }) => {
    await page.goto('/?agency=%E8%A1%9B%E7%A6%8F%E9%83%A8');

    const chip = page.locator('.agency-chip[data-agency="衛福部"]');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(chip).toHaveClass(/active/);

    const visibleCount = await countVisibleCards(page);
    expect(visibleCount).toBeGreaterThan(0);

    const nonMatchingVisible = await page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => {
        const el = c as HTMLElement;
        return el.style.display !== 'none' && el.dataset.agency !== '衛福部';
      }).length
    );
    expect(nonMatchingVisible).toBe(0);
  });

  test('clicking agency chip updates URL to include ?agency= param', async ({ page }) => {
    await page.goto('/');

    const chip = page.locator('.agency-chip[data-agency="教育部"]');
    await chip.click();
    await page.waitForFunction(() => window.location.search.includes('agency='));
    expect(decodeURIComponent(page.url())).toContain('agency=教育部');
  });

  test('agency filter interoperates with category filter', async ({ page }) => {
    await page.goto('/');

    // Apply agency filter first
    const agencyChip = page.locator('.agency-chip[data-agency="勞動部"]');
    await agencyChip.click();
    await page.waitForTimeout(100);

    const afterAgency = await countVisibleCards(page);
    expect(afterAgency).toBeGreaterThan(0);

    // Then apply 就業 category filter (guaranteed to exist since 勞動部 has 就業 entries)
    const catBtn = page.locator('.filter-btn[data-category="就業"]');
    await expect(catBtn).toBeVisible();
    await catBtn.click();
    await page.waitForTimeout(100);

    const afterBoth = await countVisibleCards(page);
    expect(afterBoth).toBeLessThanOrEqual(afterAgency);

    // All visible cards must match BOTH filters
    const bad = await page.locator('.subsidy-card').evaluateAll(cards =>
      cards.filter(c => {
        const el = c as HTMLElement;
        if (el.style.display === 'none') return false;
        return el.dataset.agency !== '勞動部' || el.dataset.category !== '就業';
      }).length
    );
    expect(bad).toBe(0);
  });
});
