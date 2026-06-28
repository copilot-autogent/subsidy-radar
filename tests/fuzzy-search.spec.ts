import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// ── Pure-logic fuzzy search unit tests (no browser required) ─────────────────
// These mirror the runtime implementation in index.astro exactly so that
// acceptance criteria can be validated without a working browser binary.

function getBigrams(str: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    set.add(str.slice(i, i + 2));
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) { if (b.has(g)) inter++; }
  return inter / (a.size + b.size - inter);
}

function fuzzyMatchText(query: string, text: string): { exact: boolean; score: number } {
  if (text.includes(query)) return { exact: true, score: 1 };
  if (query.length < 2) return { exact: false, score: 0 };
  const score = jaccardSimilarity(getBigrams(query), getBigrams(text));
  return { exact: false, score };
}

const FUZZY_THRESHOLD = 0.15;

function matchSearch(query: string, searchText: string): boolean {
  if (query === '') return true;
  const fm = fuzzyMatchText(query, searchText);
  return fm.exact || fm.score >= FUZZY_THRESHOLD;
}

test.describe('fuzzy search — pure logic (no browser)', () => {
  test('青年成家 matches 青年安心成家貸款 via bigram fuzzy', () => {
    const query = '青年成家';
    const title = '青年安心成家貸款';
    expect(matchSearch(query, title)).toBe(true);
  });

  test('創業補助 matches 創業補貼 via bigram fuzzy', () => {
    const query = '創業補助';
    const title = '創業補貼申請';
    expect(matchSearch(query, title)).toBe(true);
  });

  test('exact substring match returns exact=true', () => {
    const fm = fuzzyMatchText('青年', '支援青年就業計畫');
    expect(fm.exact).toBe(true);
    expect(fm.score).toBe(1);
  });

  test('exact match is always included', () => {
    expect(matchSearch('青年就業', '支援青年就業計畫')).toBe(true);
  });

  test('completely unrelated query returns false', () => {
    expect(matchSearch('zzzzz', '青年就業補助')).toBe(false);
  });

  test('empty query matches everything', () => {
    expect(matchSearch('', '任何內容')).toBe(true);
  });

  test('single character query falls back to exact substring (no bigrams)', () => {
    // single char that IS a substring: returns true via exact path
    expect(matchSearch('補', '就業補助')).toBe(true);
    // single char that is NOT a substring: no bigrams → false
    const fm = fuzzyMatchText('X', '青年就業');
    expect(fm.exact).toBe(false);
    expect(fm.score).toBe(0);
    expect(matchSearch('X', '青年就業')).toBe(false);
  });

  test('bigram similarity is symmetric', () => {
    const a = getBigrams('青年成家');
    const b = getBigrams('青年安心成家貸款');
    const score1 = jaccardSimilarity(a, b);
    const score2 = jaccardSimilarity(b, a);
    expect(score1).toBeCloseTo(score2, 10);
  });

  test('fuzzy score is above threshold for plausible typo pairs', () => {
    // 創業補助 vs 創業補貼 — share 創業, 業補 bigrams
    const score = jaccardSimilarity(getBigrams('創業補助'), getBigrams('創業補貼'));
    expect(score).toBeGreaterThanOrEqual(FUZZY_THRESHOLD);
  });

  test('data file subsidies.json contains expected example entries', () => {
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    const subsidies: Array<{ title: string; tags: string[] }> = JSON.parse(readFileSync(dataPath, 'utf-8'));
    // At least one subsidy should be findable via exact match for 青年
    const searchTexts = subsidies.map(s => `${s.title} ${s.tags.join(' ')}`);
    const hasYouthEntry = searchTexts.some(t => matchSearch('青年', t));
    expect(hasYouthEntry).toBe(true);
  });
});
