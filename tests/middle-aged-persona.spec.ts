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

test.describe('middle-aged persona — data & filter logic', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  // ── 1. Chip render: middle-aged persona chip has supporting data ──────────
  // Verified indirectly through data — the personas array in index.astro
  // includes { key: 'middle-aged', icon: '👨‍💼', label: '中高齡(45+)' }, which
  // renders a .persona-btn[data-persona="middle-aged"] chip. We confirm the
  // supporting data exists and is non-empty so the chip is meaningful.
  test('middle-aged situation exists on at least 1 subsidy (chip has data to show)', () => {
    const middleAgedSubsidies = subsidies.filter(s => s.situations?.includes('middle-aged'));
    expect(middleAgedSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. New middle-aged entries present with required fields ───────────────
  test('all new middle-aged entries have required fields and middle-aged situation', () => {
    const newIds = [
      'middle-aged-on-job-training',
      'middle-aged-entrepreneur-subsidy',
      'employer-hire-middle-aged-incentive',
    ];
    for (const id of newIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have middle-aged situation`).toContain('middle-aged');
      expect(entry!.title, `${id} should have a title`).toBeTruthy();
      expect(entry!.category, `${id} should have a category`).toBeTruthy();
    }
  });

  // ── 3. Existing entries correctly tagged ──────────────────────────────────
  test('employment-promotion-subsidy tagged with middle-aged', () => {
    const entry = subsidies.find(s => s.id === 'employment-promotion-subsidy');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('middle-aged');
  });

  test('mid-age-employment-reward tagged with middle-aged', () => {
    const entry = subsidies.find(s => s.id === 'mid-age-employment-reward');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('middle-aged');
  });

  test('micro-phoenix-loan tagged with middle-aged (cross-cohort program)', () => {
    const entry = subsidies.find(s => s.id === 'micro-phoenix-loan');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('middle-aged');
  });

  // ── 4. Total entry count target ───────────────────────────────────────────
  test('middle-aged entries reach the issue-145 target (at least 5)', () => {
    const middleAgedEntries = subsidies.filter(s => s.situations?.includes('middle-aged'));
    expect(middleAgedEntries.length, 'Expected at least 5 middle-aged-tagged entries').toBeGreaterThanOrEqual(5);
  });

  // ── 5. Middle-aged + worker overlap ──────────────────────────────────────
  // Middle-aged workers also qualify for worker subsidies
  test('middle-aged-on-job-training tagged with both middle-aged and worker', () => {
    const entry = subsidies.find(s => s.id === 'middle-aged-on-job-training');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('middle-aged');
    expect(entry!.situations).toContain('worker');
  });

  // ── 6. Scope: distinct from senior ────────────────────────────────────────
  test('new middle-aged entries are NOT tagged as senior (45–64 ≠ 65+)', () => {
    const newIds = [
      'middle-aged-on-job-training',
      'middle-aged-entrepreneur-subsidy',
      'employer-hire-middle-aged-incentive',
    ];
    for (const id of newIds) {
      const entry = subsidies.find(s => s.id === id);
      if (entry?.situations) {
        expect(entry.situations, `${id} should not be tagged senior`).not.toContain('senior');
      }
    }
  });
});
