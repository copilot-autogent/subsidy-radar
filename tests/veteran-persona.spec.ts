import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

interface Subsidy {
  id: string;
  title: string;
  category?: string;
  situations?: string[];
}

const DATA_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/subsidies.json');

function loadSubsidies(): Subsidy[] {
  const raw: unknown = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  if (!Array.isArray(raw)) throw new Error('subsidies.json must be an array');
  return raw as Subsidy[];
}

test.describe('veteran persona — data & filter logic', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  // ── 1. Chip render: veteran situation exists on at least 1 entry ──────────
  test('veteran situation exists on at least 1 subsidy (chip has data to show)', () => {
    const veteranSubsidies = subsidies.filter(s => s.situations?.includes('veteran'));
    expect(veteranSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. New veteran entries present ────────────────────────────────────────
  test('all new veteran entries have required fields and veteran situation', () => {
    const veteranIds = [
      'vac-veteran-employment-subsidy',
      'vac-veteran-housing-placement',
      'vac-veteran-spouse-living-subsidy',
    ];
    for (const id of veteranIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have veteran situation`).toContain('veteran');
    }
  });

  // ── 3. Existing entries tagged with veteran ───────────────────────────────
  test('social-housing tagged with veteran', () => {
    const entry = subsidies.find(s => s.id === 'social-housing');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
  });

  test('social-housing-priority-points tagged with veteran', () => {
    const entry = subsidies.find(s => s.id === 'social-housing-priority-points');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
  });

  // ── 4. Total veteran entry count ─────────────────────────────────────────
  test('veteran entries reach the target (at least 4)', () => {
    const veteranEntries = subsidies.filter(s => s.situations?.includes('veteran'));
    expect(veteranEntries.length, 'Expected at least 4 veteran-tagged entries').toBeGreaterThanOrEqual(4);
  });

  // ── 5. Veteran + senior overlap (榮民配偶住宅安置) ────────────────────────
  test('vac-veteran-housing-placement tagged with both veteran and senior', () => {
    const entry = subsidies.find(s => s.id === 'vac-veteran-housing-placement');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
    expect(entry!.situations).toContain('senior');
  });

  // ── 6. No duplicate IDs introduced ───────────────────────────────────────
  test('no duplicate subsidy IDs', () => {
    const ids = subsidies.map(s => s.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });
});
