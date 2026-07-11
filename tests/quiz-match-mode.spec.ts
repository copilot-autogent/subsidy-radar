import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

/**
 * Specs for quiz-to-match-mode integration (issue #169).
 *
 * After quiz completion the main list should:
 *  1. Show ONLY subsidies that match the user's answers (filtered)
 *  2. Sort visible cards by descending match score
 *  3. Show a match-mode banner with the correct count
 *  4. Allow the user to exit match mode and return to the full list
 *
 * These tests mirror the selection + sorting logic from index.astro at the
 * spec level (same intentional-mirror approach as match-score.spec.ts /
 * quiz-top3-panel.spec.ts — production code lives in a <script> tag and
 * cannot be imported from Node.js directly).
 */

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

interface Subsidy {
  id: string;
  title: string;
  situations?: string[];
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

/** Mirror of matchQuizToSituations from index.astro. */
function matchQuizToSituations(quizAnswers: Record<string, string>): string[] {
  const situations: string[] = [];
  const { age, employment, housing, disability } = quizAnswers;
  const singleParent = quizAnswers['single-parent'];
  const youngChild = quizAnswers['young-child'];
  const student = quizAnswers['student'];
  const worker = quizAnswers['worker'];
  const middleAged = quizAnswers['middle-aged'];
  const veteran = quizAnswers['veteran'];
  const farmer = quizAnswers['farmer'];

  if (age === 'senior') situations.push('senior');
  if (employment === 'fresh-grad') situations.push('fresh-grad');
  if (employment === 'unemployed') situations.push('unemployed');
  if (employment === 'employed') situations.push('employed');
  if (housing === 'renter') situations.push('renter');
  if (housing === 'homebuyer') situations.push('homebuyer');
  if (employment === 'entrepreneur' || housing === 'entrepreneur') situations.push('entrepreneur');
  if (housing === 'parent') situations.push('parent');
  if (disability === 'yes') situations.push('disabled');
  if (singleParent === 'yes') {
    situations.push('single-parent');
    if (!situations.includes('parent')) situations.push('parent');
  }
  if (youngChild === 'yes') {
    situations.push('young-child');
    if (!situations.includes('parent')) situations.push('parent');
  }
  if (student === 'yes') situations.push('student');
  if (worker === 'yes') situations.push('worker');
  if (middleAged === 'yes') situations.push('middle-aged');
  if (veteran === 'yes') situations.push('veteran');
  if (farmer === 'yes') situations.push('farmer');
  return situations;
}

/**
 * Mirror of applyQuizFilter visibility logic from index.astro.
 * Returns subsidies that should be visible after the quiz.
 */
function applyQuizFilter(
  subsidies: Subsidy[],
  quizSituations: string[],
  showClosed = false,
): Subsidy[] {
  return subsidies.filter(s => {
    const cardSituations = s.situations ?? [];
    const matchSituation =
      quizSituations.length === 0 || quizSituations.some(sit => cardSituations.includes(sit));
    const matchClosed = showClosed || s.deadlineStatus !== 'closed';
    return matchSituation && matchClosed;
  });
}

test.describe('Quiz match mode — logic spec (issue #169)', () => {

  test('after quiz, only matching subsidies are visible (filtered by situations)', () => {
    const subsidies = loadSubsidies();
    const quizAnswers = { age: 'youth', employment: 'fresh-grad', housing: 'renter',
      disability: 'no', 'single-parent': 'no', 'young-child': 'no',
      student: 'no', worker: 'no', 'middle-aged': 'no', veteran: 'no', farmer: 'no', county: 'other' };
    const quizSituations = matchQuizToSituations(quizAnswers);

    // At least one situation must be derived from these answers
    expect(quizSituations.length).toBeGreaterThan(0);
    expect(quizSituations).toContain('fresh-grad');
    expect(quizSituations).toContain('renter');

    const visible = applyQuizFilter(subsidies, quizSituations);

    // Every visible subsidy must have at least one matching situation tag
    for (const s of visible) {
      const cardSituations = s.situations ?? [];
      const hasMatch = quizSituations.some(sit => cardSituations.includes(sit));
      expect(hasMatch).toBe(true);
    }

    // Visible count must be < total (filter is not vacuous)
    expect(visible.length).toBeLessThan(subsidies.length);
    expect(visible.length).toBeGreaterThan(0);
  });

  test('visible subsidies are sorted by descending match score in quiz mode', () => {
    const subsidies = loadSubsidies();
    const quizSituations = ['renter', 'fresh-grad'];

    const visible = applyQuizFilter(subsidies, quizSituations);

    // Assign scores and sort
    const scored = visible.map(s => ({
      id: s.id,
      score: computeMatchScore(quizSituations, s.situations ?? []),
    }));
    scored.sort((a, b) => b.score - a.score);

    // Sorted order must be non-increasing (every score ≥ next score)
    for (let i = 0; i < scored.length - 1; i++) {
      expect(scored[i].score).toBeGreaterThanOrEqual(scored[i + 1].score);
    }

    // All visible subsidies have score > 0
    for (const entry of scored) {
      expect(entry.score).toBeGreaterThan(0);
    }
  });

  test('match-mode banner count equals the number of visible matching subsidies', () => {
    const subsidies = loadSubsidies();
    const quizAnswers = { age: 'senior', employment: 'unemployed', housing: 'renter',
      disability: 'no', 'single-parent': 'no', 'young-child': 'no',
      student: 'no', worker: 'no', 'middle-aged': 'no', veteran: 'no', farmer: 'no', county: 'other' };
    const quizSituations = matchQuizToSituations(quizAnswers);

    const visible = applyQuizFilter(subsidies, quizSituations);

    // The banner should display exactly this count
    expect(visible.length).toBeGreaterThan(0);

    // Verify count is correct: same as filtering with matchSituation logic
    const countViaFilter = subsidies.filter(s =>
      quizSituations.some(sit => (s.situations ?? []).includes(sit)) &&
      s.deadlineStatus !== 'closed',
    ).length;
    expect(visible.length).toBe(countViaFilter);
  });

  test('exit match mode (quiz reset) restores full list: all non-closed subsidies visible', () => {
    const subsidies = loadSubsidies();

    // In normal mode (not quiz active), all non-closed subsidies should be visible
    const nonClosed = subsidies.filter(s => s.deadlineStatus !== 'closed');
    // Count with showClosed = false and no quiz filter
    const allVisible = applyQuizFilter(subsidies, [], false);
    // With empty quizSituations, matchSituation is vacuously true → all non-closed items
    expect(allVisible.length).toBe(nonClosed.length);
  });

  test('situations derived from quiz answers cover all mapped question types', () => {
    // Verify all quiz answer → situation mappings work correctly
    expect(matchQuizToSituations({ age: 'senior' })).toContain('senior');
    expect(matchQuizToSituations({ employment: 'fresh-grad' })).toContain('fresh-grad');
    expect(matchQuizToSituations({ employment: 'unemployed' })).toContain('unemployed');
    expect(matchQuizToSituations({ employment: 'employed' })).toContain('employed');
    expect(matchQuizToSituations({ housing: 'renter' })).toContain('renter');
    expect(matchQuizToSituations({ housing: 'homebuyer' })).toContain('homebuyer');
    expect(matchQuizToSituations({ housing: 'parent' })).toContain('parent');
    expect(matchQuizToSituations({ disability: 'yes' })).toContain('disabled');
    expect(matchQuizToSituations({ 'single-parent': 'yes' })).toContain('single-parent');
    expect(matchQuizToSituations({ 'single-parent': 'yes' })).toContain('parent');
    expect(matchQuizToSituations({ 'young-child': 'yes' })).toContain('young-child');
    expect(matchQuizToSituations({ 'young-child': 'yes' })).toContain('parent');
    expect(matchQuizToSituations({ student: 'yes' })).toContain('student');
    expect(matchQuizToSituations({ worker: 'yes' })).toContain('worker');
    expect(matchQuizToSituations({ 'middle-aged': 'yes' })).toContain('middle-aged');
    expect(matchQuizToSituations({ veteran: 'yes' })).toContain('veteran');
    expect(matchQuizToSituations({ farmer: 'yes' })).toContain('farmer');

    // Negative: 'no' answers do not add situations
    expect(matchQuizToSituations({ disability: 'no' })).not.toContain('disabled');
    expect(matchQuizToSituations({ 'single-parent': 'no' })).not.toContain('single-parent');
    expect(matchQuizToSituations({ age: 'youth' })).not.toContain('senior');
  });

  test('full quiz with typical young-renter profile yields non-empty filtered list', () => {
    const subsidies = loadSubsidies();
    const quizAnswers = {
      age: 'youth',
      employment: 'employed',
      housing: 'renter',
      disability: 'no',
      'single-parent': 'no',
      'young-child': 'no',
      student: 'no',
      worker: 'yes',
      'middle-aged': 'no',
      veteran: 'no',
      farmer: 'no',
      county: 'other',
    };
    const quizSituations = matchQuizToSituations(quizAnswers);
    expect(quizSituations).toContain('renter');
    expect(quizSituations).toContain('employed');
    expect(quizSituations).toContain('worker');

    const visible = applyQuizFilter(subsidies, quizSituations);
    expect(visible.length).toBeGreaterThan(0);

    // Banner would show this count — must be a positive number < total
    expect(visible.length).toBeLessThan(subsidies.length);
  });
});
