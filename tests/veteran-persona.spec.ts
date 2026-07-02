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

  // ── 1. Chip render: veteran persona chip has supporting data ──────────────
  // Confirms the `veteran` situation tag exists on at least one entry so the
  // 🎖️ 榮民 chip in the persona strip is meaningful.
  test('veteran situation exists on at least 1 subsidy (chip has data to show)', () => {
    const veteranSubsidies = subsidies.filter(s => s.situations?.includes('veteran'));
    expect(veteranSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. New VAC entries exist and are tagged correctly ─────────────────────
  test('all new veteran entries have required fields', () => {
    const veteranIds = [
      'vac-veteran-employment-subsidy',
      'vac-veteran-housing',
      'vac-veteran-spouse-living',
    ];
    for (const id of veteranIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have veteran situation`).toContain('veteran');
    }
  });

  // ── 3. Cross-situation combinations ──────────────────────────────────────
  test('vac-veteran-employment-subsidy tagged with veteran + unemployed', () => {
    const entry = subsidies.find(s => s.id === 'vac-veteran-employment-subsidy');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
    expect(entry!.situations).toContain('unemployed');
  });

  test('vac-veteran-housing tagged with veteran + renter + senior', () => {
    const entry = subsidies.find(s => s.id === 'vac-veteran-housing');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
    expect(entry!.situations).toContain('renter');
    expect(entry!.situations).toContain('senior');
  });

  test('vac-veteran-spouse-living tagged with veteran + low-income', () => {
    const entry = subsidies.find(s => s.id === 'vac-veteran-spouse-living');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('veteran');
    expect(entry!.situations).toContain('low-income');
  });

  // ── 4. Total veteran count ────────────────────────────────────────────────
  test('veteran entries reach the issue-117 target', () => {
    const veteranEntries = subsidies.filter(s => s.situations?.includes('veteran'));
    expect(veteranEntries.length, 'Expected at least 3 veteran-tagged entries').toBeGreaterThanOrEqual(3);
  });

  // ── 5. Dedup: no new duplicate ids introduced ─────────────────────────────
  test('no duplicate ids after adding veteran entries', () => {
    const ids = subsidies.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
