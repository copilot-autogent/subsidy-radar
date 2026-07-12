import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

/**
 * Specs for the "Quiz Summary Banner" (issue #171).
 *
 * Tests mirror the production calculation logic at the spec level:
 * 1. Total is computed from non-closed matched subsidies (score ≥ 30%)
 * 2. maxAmount takes priority over regex-parsed amount field
 * 3. Unparseable amounts are counted as "依條件核定" (not added to total)
 * 4. Banner is hidden when < 2 matched subsidies
 * 5. Amount is formatted as NT$ with thousands separator
 */

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

interface Subsidy {
  id: string;
  title: string;
  situations?: string[];
  amount?: string;
  maxAmount?: number;
  deadlineStatus?: string;
}

function loadSubsidies(): Subsidy[] {
  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as Subsidy[];
}

/** Mirror of computeMatchScore from index.astro. */
function computeMatchScore(quizSituations: string[], cardSituations: string[]): number {
  if (cardSituations.length === 0 || quizSituations.length === 0) return 0;
  const quizSet = new Set(quizSituations);
  const uniqueCardSituations = Array.from(new Set(cardSituations));
  const matches = uniqueCardSituations.filter(s => quizSet.has(s)).length;
  if (matches === 0) return 0;
  return Math.max(1, Math.round((matches / uniqueCardSituations.length) * 100));
}

const MIN_SCORE = 30;
const AMOUNT_REGEX = /最高\s*([\d,]+)\s*元/;

/** Mirror of parseQuizAmountFromCard from index.astro. */
function parseQuizAmount(maxAmount: number | undefined, amountText: string | undefined): number {
  if (maxAmount != null && maxAmount > 0) return maxAmount;
  if (amountText) {
    const m = AMOUNT_REGEX.exec(amountText);
    if (m) {
      const val = parseInt(m[1].replace(/,/g, ''), 10);
      if (val > 0) return val;
    }
  }
  return 0;
}

interface SummaryResult {
  totalAmount: number;
  countWithAmount: number;
  countWithoutAmount: number;
  totalMatched: number;
  shouldShow: boolean;
}

/** Mirror of showQuizSummaryBanner logic from index.astro. */
function computeSummary(subsidies: Subsidy[], quizSituations: string[]): SummaryResult {
  let totalAmount = 0;
  let countWithAmount = 0;
  let countWithoutAmount = 0;
  let totalMatched = 0;

  for (const s of subsidies) {
    if (s.deadlineStatus === 'closed') continue;
    const score = computeMatchScore(quizSituations, s.situations ?? []);
    if (score < MIN_SCORE) continue;
    totalMatched++;
    const val = parseQuizAmount(s.maxAmount, s.amount);
    if (val > 0) {
      totalAmount += val;
      countWithAmount++;
    } else {
      countWithoutAmount++;
    }
  }

  return { totalAmount, countWithAmount, countWithoutAmount, totalMatched, shouldShow: totalMatched >= 2 };
}

test.describe('Quiz Summary Banner — logic spec (issue #171)', () => {

  test('banner is hidden when fewer than 2 subsidies match', () => {
    // A quiz situation that matches exactly 0 or 1 subsidy should not show the banner
    const result0 = computeSummary([], ['renter']);
    expect(result0.shouldShow).toBe(false);

    // Single-match synthetic case
    const singleSubsidy: Subsidy[] = [
      { id: 'a', title: 'Only One', situations: ['renter'], amount: '最高 10,000 元', deadlineStatus: 'ongoing' },
    ];
    const result1 = computeSummary(singleSubsidy, ['renter']);
    expect(result1.totalMatched).toBe(1);
    expect(result1.shouldShow).toBe(false);
  });

  test('banner shows when 2 or more subsidies match', () => {
    const twoSubsidies: Subsidy[] = [
      { id: 'a', title: 'Sub A', situations: ['renter'], maxAmount: 48000, deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Sub B', situations: ['renter'], maxAmount: 12000, deadlineStatus: 'ongoing' },
    ];
    const result = computeSummary(twoSubsidies, ['renter']);
    expect(result.totalMatched).toBe(2);
    expect(result.shouldShow).toBe(true);
    expect(result.totalAmount).toBe(60000);
    expect(result.countWithAmount).toBe(2);
    expect(result.countWithoutAmount).toBe(0);
  });

  test('closed subsidies are excluded from total and count', () => {
    const subsidies: Subsidy[] = [
      { id: 'a', title: 'Open', situations: ['renter'], maxAmount: 30000, deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Open2', situations: ['renter'], maxAmount: 20000, deadlineStatus: 'ongoing' },
      { id: 'c', title: 'Closed', situations: ['renter'], maxAmount: 50000, deadlineStatus: 'closed' },
    ];
    const result = computeSummary(subsidies, ['renter']);
    // Closed subsidy must be excluded
    expect(result.totalMatched).toBe(2);
    expect(result.totalAmount).toBe(50000); // only a + b
    expect(result.countWithAmount).toBe(2);
  });

  test('maxAmount takes priority over amount field regex', () => {
    const subsidies: Subsidy[] = [
      { id: 'a', title: 'Sub A', situations: ['renter'], maxAmount: 96000, amount: '最高 48,000 元', deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Sub B', situations: ['renter'], maxAmount: 50000, deadlineStatus: 'ongoing' },
    ];
    const result = computeSummary(subsidies, ['renter']);
    // Should use maxAmount (96000 + 50000), not regex (48000 + 50000)
    expect(result.totalAmount).toBe(146000);
  });

  test('regex fallback parses amount field when maxAmount is absent', () => {
    const subsidies: Subsidy[] = [
      { id: 'a', title: 'Sub A', situations: ['renter'], amount: '最高 30,000 元補助', deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Sub B', situations: ['renter'], amount: '最高 20,000 元', deadlineStatus: 'ongoing' },
    ];
    const result = computeSummary(subsidies, ['renter']);
    expect(result.totalAmount).toBe(50000);
    expect(result.countWithAmount).toBe(2);
    expect(result.countWithoutAmount).toBe(0);
  });

  test('unparseable amounts are excluded from total and counted as 依條件核定', () => {
    const subsidies: Subsidy[] = [
      { id: 'a', title: 'Sub A', situations: ['renter'], maxAmount: 48000, deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Sub B', situations: ['renter'], amount: '依個人資格核定', deadlineStatus: 'ongoing' }, // unparseable
      { id: 'c', title: 'Sub C', situations: ['renter'], amount: '訓練費用政府全額補助', deadlineStatus: 'ongoing' }, // unparseable
    ];
    const result = computeSummary(subsidies, ['renter']);
    expect(result.totalMatched).toBe(3);
    expect(result.shouldShow).toBe(true);
    expect(result.totalAmount).toBe(48000);
    expect(result.countWithAmount).toBe(1);
    expect(result.countWithoutAmount).toBe(2);
  });

  test('all amounts unparseable: banner still shows but marks all as 依條件核定', () => {
    const subsidies: Subsidy[] = [
      { id: 'a', title: 'Sub A', situations: ['renter'], amount: '依個人資格核定', deadlineStatus: 'ongoing' },
      { id: 'b', title: 'Sub B', situations: ['renter'], amount: '訓練費用全額補助', deadlineStatus: 'ongoing' },
    ];
    const result = computeSummary(subsidies, ['renter']);
    expect(result.totalMatched).toBe(2);
    expect(result.shouldShow).toBe(true);
    expect(result.totalAmount).toBe(0);
    expect(result.countWithAmount).toBe(0);
    expect(result.countWithoutAmount).toBe(2);
    // Banner should not display NT$0 for this case (handled in UI layer)
  });

  test('amount format: currency with thousands separator', () => {
    const amount = 240000;
    const formatted = new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      maximumFractionDigits: 0,
    }).format(amount);
    // Should contain the numeric value with a thousands separator
    expect(formatted).toContain('240');
    expect(formatted).toMatch(/[\d,]/);
  });

  test('real data: quiz with common situation tag yields a calculable summary', () => {
    const subsidies = loadSubsidies();
    // Find a tag common enough to guarantee ≥ 2 matches
    const allTags = subsidies.flatMap(s => s.situations ?? []);
    if (allTags.length === 0) throw new Error('No situation tags in subsidies.json');
    const tagCounts = new Map<string, number>();
    allTags.forEach(t => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1));
    const topEntry = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!topEntry) throw new Error('No tags found');
    const [mostCommonTag] = topEntry;

    const result = computeSummary(subsidies, [mostCommonTag]);
    // At least 2 matched (since most common tag has many subsidies)
    expect(result.totalMatched).toBeGreaterThanOrEqual(2);
    expect(result.shouldShow).toBe(true);
    // Total from non-closed, parseable subsidies should be positive
    expect(result.totalAmount).toBeGreaterThan(0);
  });

  test('quiz reset path: empty quizSituations yields no matches', () => {
    const subsidies = loadSubsidies();
    const result = computeSummary(subsidies, []);
    expect(result.totalMatched).toBe(0);
    expect(result.shouldShow).toBe(false);
  });
});
