import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface TimelineSubsidy {
  id: string;
  title: string;
  situations?: string[];
  eligibilityStartEvent?: string;
  applyWithinMonths?: number | null;
  timelineNote?: string;
}

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

function loadSubsidies(): TimelineSubsidy[] {
  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as TimelineSubsidy[];
}

test.describe('timeline — data schema and ordering', () => {
  let subsidies: TimelineSubsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  test('birth-subsidy has eligibilityStartEvent=birth and applyWithinMonths=6', () => {
    const entry = subsidies.find(s => s.id === 'birth-subsidy');
    expect(entry, 'birth-subsidy should exist').toBeDefined();
    expect(entry!.eligibilityStartEvent).toBe('birth');
    expect(entry!.applyWithinMonths).toBe(6);
  });

  test('parental-leave-allowance has eligibilityStartEvent=parental-leave', () => {
    const entry = subsidies.find(s => s.id === 'parental-leave-allowance');
    expect(entry, 'parental-leave-allowance should exist').toBeDefined();
    expect(entry!.eligibilityStartEvent).toBe('parental-leave');
  });

  test('childcare-allowance has eligibilityStartEvent=birth', () => {
    const entry = subsidies.find(s => s.id === 'childcare-allowance');
    expect(entry, 'childcare-allowance should exist').toBeDefined();
    expect(entry!.eligibilityStartEvent).toBe('birth');
  });

  test('at least 3 subsidies have birth eligibilityStartEvent', () => {
    const birthSubsidies = subsidies.filter(s => s.eligibilityStartEvent === 'birth');
    expect(birthSubsidies.length).toBeGreaterThanOrEqual(3);
  });

  test('at least 1 subsidy has parental-leave eligibilityStartEvent', () => {
    const leaveSubsidies = subsidies.filter(s => s.eligibilityStartEvent === 'parental-leave');
    expect(leaveSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  test('at least 2 subsidies have child-enrollment eligibilityStartEvent', () => {
    const enrollmentSubsidies = subsidies.filter(s => s.eligibilityStartEvent === 'child-enrollment');
    expect(enrollmentSubsidies.length).toBeGreaterThanOrEqual(2);
  });

  test('subsidies with applyWithinMonths have a positive integer value', () => {
    const withDeadline = subsidies.filter(s => s.applyWithinMonths != null);
    expect(withDeadline.length).toBeGreaterThanOrEqual(1);
    for (const s of withDeadline) {
      expect(typeof s.applyWithinMonths, `${s.id} applyWithinMonths should be number`).toBe('number');
      expect(s.applyWithinMonths!, `${s.id} applyWithinMonths should be positive`).toBeGreaterThan(0);
    }
  });

  test('timeline ordering: subsidies with strict deadlines sort before open-ended ones', () => {
    // Simulate the timeline sort logic: items with applyWithinMonths (deadline) sort first
    const birthDate = new Date(2026, 7, 1); // Aug 2026 (mock)

    const birthItems = subsidies.filter(s => s.eligibilityStartEvent === 'birth');
    const withDeadline = birthItems.filter(s => s.applyWithinMonths != null && s.applyWithinMonths > 0);
    const withoutDeadline = birthItems.filter(s => !s.applyWithinMonths);

    // Sort: items with deadline by their deadline date, then ongoing items
    function getDeadline(s: TimelineSubsidy): Date | null {
      if (s.applyWithinMonths) {
        const d = new Date(birthDate);
        d.setMonth(d.getMonth() + s.applyWithinMonths);
        return d;
      }
      return null;
    }

    const sorted = [...birthItems].sort((a, b) => {
      const da = getDeadline(a);
      const db = getDeadline(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });

    // All items with deadline should come before items without deadline
    const firstWithoutDeadlineIdx = sorted.findIndex(s => !s.applyWithinMonths);
    const lastWithDeadlineIdx = sorted.reduce(
      (acc, s, i) => (s.applyWithinMonths ? i : acc),
      -1,
    );

    if (firstWithoutDeadlineIdx !== -1 && lastWithDeadlineIdx !== -1) {
      expect(lastWithDeadlineIdx).toBeLessThan(firstWithoutDeadlineIdx);
    } else if (withDeadline.length > 0) {
      // All have deadlines — just verify sort is ascending
      for (let i = 1; i < sorted.length; i++) {
        const prevDeadline = getDeadline(sorted[i - 1]);
        const currDeadline = getDeadline(sorted[i]);
        if (prevDeadline && currDeadline) {
          expect(prevDeadline.getTime()).toBeLessThanOrEqual(currDeadline.getTime());
        }
      }
    }

    // birth-subsidy (6 months) should sort before childcare-allowance (null deadline)
    const birthSubsidyIdx = sorted.findIndex(s => s.id === 'birth-subsidy');
    const childcareIdx = sorted.findIndex(s => s.id === 'childcare-allowance');
    if (birthSubsidyIdx !== -1 && childcareIdx !== -1) {
      expect(birthSubsidyIdx).toBeLessThan(childcareIdx);
    }
  });

  test('all timeline-annotated entries also have timelineNote', () => {
    const annotated = subsidies.filter(s => s.eligibilityStartEvent != null);
    for (const s of annotated) {
      expect(typeof s.timelineNote, `${s.id} should have timelineNote string`).toBe('string');
      expect(s.timelineNote!.length, `${s.id} timelineNote should be non-empty`).toBeGreaterThan(0);
    }
  });

  test('dedup guard: no duplicate ids after adding timeline metadata', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const s of subsidies) {
      if (seen.has(s.id)) dupes.push(s.id);
      seen.add(s.id);
    }
    expect(dupes, `Duplicate ids: ${dupes.join(', ')}`).toHaveLength(0);
  });

  test('all eligibilityStartEvent values are in the allowed enum', () => {
    const ALLOWED_EVENTS = new Set(['birth', 'parental-leave', 'child-enrollment']);
    const invalid = subsidies.filter(
      s => s.eligibilityStartEvent != null && !ALLOWED_EVENTS.has(s.eligibilityStartEvent),
    );
    if (invalid.length > 0) {
      const detail = invalid.map(s => `${s.id}: "${s.eligibilityStartEvent}"`).join(', ');
      throw new Error(`Invalid eligibilityStartEvent values (check for typos): ${detail}`);
    }
    expect(invalid.length).toBe(0);
  });

  test('applyWithinMonths is always a positive integer when present', () => {
    const invalid = subsidies.filter(
      s => s.applyWithinMonths != null && (!Number.isInteger(s.applyWithinMonths) || s.applyWithinMonths <= 0),
    );
    if (invalid.length > 0) {
      const detail = invalid.map(s => `${s.id}: ${s.applyWithinMonths}`).join(', ');
      throw new Error(`Invalid applyWithinMonths (must be positive integer): ${detail}`);
    }
    expect(invalid.length).toBe(0);
  });
});

test.describe('timeline page — renders', () => {
  test('timeline page loads and shows event groups', async ({ page }) => {
    await page.goto('/timeline');
    await expect(page.locator('h1')).toContainText('申請時程表');
    // At least one event group should be present
    const groupCount = await page.locator('.event-group').count();
    expect(groupCount).toBeGreaterThanOrEqual(1);
  });

  test('timeline page shows birth event group with at least 1 card', async ({ page }) => {
    await page.goto('/timeline');
    const birthGroup = page.locator('.event-group[data-event="birth"]');
    await expect(birthGroup).toBeVisible();
    const cardCount = await birthGroup.locator('.timeline-card').count();
    expect(cardCount).toBeGreaterThanOrEqual(1);
  });

  test('timeline personalized section appears after entering birth date', async ({ page }) => {
    await page.goto('/timeline');
    const birthInput = page.locator('#birthDateInput');
    await birthInput.fill('2026-09');
    // Trigger change event
    await birthInput.dispatchEvent('change');
    await expect(page.locator('#personalizedTimeline')).toBeVisible();
    const itemCount = await page.locator('.personalized-item').count();
    expect(itemCount).toBeGreaterThanOrEqual(1);
  });

  test('personalized timeline orders birth-subsidy before childcare-allowance', async ({ page }) => {
    await page.goto('/timeline');
    const birthInput = page.locator('#birthDateInput');
    await birthInput.fill('2026-09');
    await birthInput.dispatchEvent('change');

    const items = page.locator('.personalized-item');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Collect all titles in order
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const title = await items.nth(i).locator('.pi-title').textContent();
      if (title) titles.push(title.trim());
    }

    const birthSubsidyIdx = titles.findIndex(t => t.includes('生育補助'));
    const childcareIdx = titles.findIndex(t => t.includes('育兒津貼'));

    // birth-subsidy has a 6-month deadline, childcare is ongoing → birth-subsidy sorts first
    if (birthSubsidyIdx !== -1 && childcareIdx !== -1) {
      expect(birthSubsidyIdx).toBeLessThan(childcareIdx);
    }
  });

  test('timeline page has nav link back to main', async ({ page }) => {
    await page.goto('/timeline');
    const backLink = page.locator('.back-link');
    await expect(backLink).toBeVisible();
    await expect(backLink).toContainText('回補助列表');
  });
});
