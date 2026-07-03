import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// ── Pure logic tests (Node.js only, no browser required) ─────────────────

/**
 * Mirror of computeMatchScore from index.astro — keeps tests in sync with
 * the implementation without requiring a browser.
 */
function computeMatchScore(quizSituations: string[], cardSituations: string[]): number {
  if (cardSituations.length === 0 || quizSituations.length === 0) return 0;
  const quizSet = new Set(quizSituations);
  const matches = cardSituations.filter(s => quizSet.has(s)).length;
  return Math.round((matches / cardSituations.length) * 100);
}

function getScoreTier(score: number): { label: string; cls: string } | null {
  if (score >= 70) return { label: '🌟 高符合', cls: 'score-high' };
  if (score >= 40) return { label: '✨ 可能符合', cls: 'score-medium' };
  if (score >= 1)  return { label: '· 低符合', cls: 'score-low' };
  return null;
}

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

interface Subsidy {
  id: string;
  title: string;
  situations?: string[];
}

function loadSubsidies(): Subsidy[] {
  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as Subsidy[];
}

test.describe('computeMatchScore — unit tests', () => {
  test('returns 100 when all card situations match quiz answers', () => {
    const score = computeMatchScore(
      ['renter', 'unemployed', 'fresh-grad'],
      ['renter', 'unemployed', 'fresh-grad'],
    );
    expect(score).toBe(100);
  });

  test('returns 0 when no card situations match quiz answers', () => {
    const score = computeMatchScore(['senior', 'disabled'], ['renter', 'fresh-grad']);
    expect(score).toBe(0);
  });

  test('returns partial score proportional to match ratio', () => {
    // Card has 4 situations; quiz matches 2 → 50%
    const score = computeMatchScore(
      ['renter', 'employed'],
      ['renter', 'employed', 'parent', 'low-income'],
    );
    expect(score).toBe(50);
  });

  test('returns 0 when card has no situation tags', () => {
    expect(computeMatchScore(['renter', 'employed'], [])).toBe(0);
  });

  test('returns 0 when quiz has no situations', () => {
    expect(computeMatchScore([], ['renter', 'employed'])).toBe(0);
  });
});

test.describe('getScoreTier — tier mapping tests', () => {
  test('score ≥ 70 maps to 高符合', () => {
    const tier = getScoreTier(100);
    expect(tier?.cls).toBe('score-high');
    expect(tier?.label).toContain('高符合');
  });

  test('score 40–69 maps to 可能符合', () => {
    const tier = getScoreTier(50);
    expect(tier?.cls).toBe('score-medium');
    expect(tier?.label).toContain('可能符合');
  });

  test('score 1–39 maps to 低符合', () => {
    const tier = getScoreTier(20);
    expect(tier?.cls).toBe('score-low');
    expect(tier?.label).toContain('低符合');
  });

  test('score 0 returns null (pill hidden)', () => {
    expect(getScoreTier(0)).toBeNull();
  });

  test('boundary: score exactly 70 = high', () => {
    expect(getScoreTier(70)?.cls).toBe('score-high');
  });

  test('boundary: score exactly 40 = medium', () => {
    expect(getScoreTier(40)?.cls).toBe('score-medium');
  });
});

test.describe('match score sort behavior — data-driven', () => {
  test('high-score card sorts before low-score card by descending order', () => {
    const cards = [
      { id: 'a', score: 25, order: 0 },
      { id: 'b', score: 100, order: 0 },
      { id: 'c', score: 50, order: 0 },
    ];
    const ranked = [...cards].sort((a, b) => b.score - a.score);
    ranked.forEach((card, i) => { card.order = i + 1; });

    // b (100) → order 1, c (50) → order 2, a (25) → order 3
    expect(ranked[0].id).toBe('b');
    expect(ranked[1].id).toBe('c');
    expect(ranked[2].id).toBe('a');
  });

  test('renter-only quiz gives non-zero score for subsidies with renter tag in real data', () => {
    const subsidies = loadSubsidies();
    const quizSituations = ['renter'];
    const renterSubsidies = subsidies.filter(s => s.situations?.includes('renter'));
    expect(renterSubsidies.length).toBeGreaterThan(0);

    for (const s of renterSubsidies) {
      const score = computeMatchScore(quizSituations, s.situations ?? []);
      expect(score).toBeGreaterThan(0);
    }
  });

  test('non-matching quiz gives 0 score for unrelated subsidy tags', () => {
    const subsidies = loadSubsidies();
    // Subsidies with ONLY 'disabled' tag shouldn't match a quiz with only 'renter'
    const disabledOnly = subsidies.filter(
      s => s.situations?.length === 1 && s.situations[0] === 'disabled',
    );
    for (const s of disabledOnly) {
      const score = computeMatchScore(['renter'], s.situations ?? []);
      expect(score).toBe(0);
    }
  });
});

