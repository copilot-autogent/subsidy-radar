import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category: string;
  situations?: string[];
  difficulty?: string;
  steps?: string[];
}

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

function getRelatedSubsidies(subsidy: Subsidy, all: Subsidy[], max = 3): Subsidy[] {
  const mySituations = new Set(subsidy.situations ?? []);
  if (mySituations.size === 0) return [];
  return all
    .filter(s => s.id !== subsidy.id)
    .map(s => ({ s, shared: (s.situations ?? []).filter(sit => mySituations.has(sit)).length }))
    .filter(({ shared }) => shared > 0)
    .sort((a, b) =>
      b.shared - a.shared ||
      (DIFFICULTY_ORDER[a.s.difficulty ?? 'medium'] ?? 1) -
      (DIFFICULTY_ORDER[b.s.difficulty ?? 'medium'] ?? 1)
    )
    .map(({ s }) => s)
    .slice(0, max);
}

test.describe('Related subsidies panel — build-time algorithm', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    const dataPath = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');
    const raw: unknown = JSON.parse(readFileSync(dataPath, 'utf-8'));
    if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
    subsidies = raw as Subsidy[];
  });

  test('algorithm returns at most 3 related subsidies', () => {
    for (const s of subsidies) {
      const related = getRelatedSubsidies(s, subsidies);
      expect(related.length).toBeLessThanOrEqual(3);
    }
  });

  test('algorithm never returns the card itself', () => {
    for (const s of subsidies) {
      const related = getRelatedSubsidies(s, subsidies);
      expect(related.map(r => r.id)).not.toContain(s.id);
    }
  });

  test('algorithm only returns cards sharing at least one situation tag', () => {
    for (const s of subsidies) {
      const mySituations = new Set(s.situations ?? []);
      const related = getRelatedSubsidies(s, subsidies);
      for (const r of related) {
        const shared = (r.situations ?? []).some(sit => mySituations.has(sit));
        expect(shared).toBe(true);
      }
    }
  });

  test('card with no situations returns empty related list', () => {
    const noSituation = subsidies.find(s => !s.situations || s.situations.length === 0);
    if (!noSituation) return; // skip if all cards have situations
    const related = getRelatedSubsidies(noSituation, subsidies);
    expect(related).toHaveLength(0);
  });

  test('results are ordered by shared-situation count descending', () => {
    const multi = subsidies.find(s => (s.situations ?? []).length >= 2);
    if (!multi) return;
    const related = getRelatedSubsidies(multi, subsidies);
    const mySituations = new Set(multi.situations ?? []);
    const shareCounts = related.map(r => (r.situations ?? []).filter(sit => mySituations.has(sit)).length);
    for (let i = 0; i < shareCounts.length - 1; i++) {
      expect(shareCounts[i]).toBeGreaterThanOrEqual(shareCounts[i + 1]);
    }
  });

  test('ties are broken by difficulty (easy before medium before hard)', () => {
    // Find a card whose related results contain a tie in share count
    for (const s of subsidies) {
      const mySituations = new Set(s.situations ?? []);
      const withCounts = subsidies
        .filter(x => x.id !== s.id)
        .map(x => ({ x, shared: (x.situations ?? []).filter(sit => mySituations.has(sit)).length }))
        .filter(({ shared }) => shared > 0);
      // Look for a tie
      const counts = withCounts.map(({ shared }) => shared);
      const hasTie = counts.length > 1 && counts.some((c, i) => i > 0 && c === counts[i - 1]);
      if (!hasTie) continue;
      const related = getRelatedSubsidies(s, subsidies);
      // Check that within tied groups, easier difficulty comes first
      const mySituationsArr = Array.from(mySituations);
      const relatedWithCounts = related.map(r => ({
        shared: (r.situations ?? []).filter(sit => mySituationsArr.includes(sit)).length,
        diffOrder: DIFFICULTY_ORDER[r.difficulty ?? 'medium'] ?? 1,
      }));
      for (let i = 0; i < relatedWithCounts.length - 1; i++) {
        const a = relatedWithCounts[i];
        const b = relatedWithCounts[i + 1];
        if (a.shared === b.shared) {
          expect(a.diffOrder).toBeLessThanOrEqual(b.diffOrder);
        }
      }
      return; // tested at least one tie case
    }
  });

  test('built HTML contains related-subsidies panels for cards with situations', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    // Count cards that have situations and at least 1 match
    let expectedPanelCount = 0;
    for (const s of subsidies) {
      const related = getRelatedSubsidies(s, subsidies);
      if (related.length > 0) expectedPanelCount++;
    }
    const panelCount = (html.match(/class="related-subsidies"/g) ?? []).length;
    expect(panelCount).toBe(expectedPanelCount);
  });

  test('built HTML: related view links are anchor hrefs pointing to card ids', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    const ids = new Set(subsidies.map(s => s.id));
    const hrefRe = /href="#([^"]+)" class="related-view-btn"/g;
    let m: RegExpExecArray | null;
    while ((m = hrefRe.exec(html)) !== null) {
      expect(ids.has(m[1])).toBe(true);
    }
  });

  test('built HTML: card with no situations has no related panel', () => {
    const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/index.html');
    const html = readFileSync(htmlPath, 'utf-8');
    const noSituation = subsidies.find(s => !s.situations || s.situations.length === 0);
    if (!noSituation) return;
    const cardIdx = html.indexOf(`id="${noSituation.id}"`);
    expect(cardIdx).toBeGreaterThan(-1);
    // Find the next card boundary
    const nextCardIdx = html.indexOf('<article', cardIdx + 1);
    const cardSlice = nextCardIdx > -1 ? html.slice(cardIdx, nextCardIdx) : html.slice(cardIdx);
    expect(cardSlice).not.toContain('related-subsidies');
  });
});
