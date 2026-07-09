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

test.describe('farmer persona — data & filter logic', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  // ── 1. Chip render: farmer situation exists on at least 1 entry ──────────
  test('farmer situation exists on at least 1 subsidy (chip has data to show)', () => {
    const farmerSubsidies = subsidies.filter(s => s.situations?.includes('farmer'));
    expect(farmerSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. All new farmer entries present and correctly tagged ────────────────
  test('all new farmer entries have required fields and farmer situation', () => {
    const farmerIds = [
      'moa-agricultural-disaster-relief',
      'moa-agricultural-insurance-premium-subsidy',
      'moa-young-farmer-startup-subsidy',
      'moa-organic-farming-transition-subsidy',
      'moa-agricultural-machinery-subsidy',
    ];
    for (const id of farmerIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have farmer situation`).toContain('farmer');
    }
  });

  // ── 3. Total farmer entry count ───────────────────────────────────────────
  test('farmer entries reach the target (at least 5)', () => {
    const farmerEntries = subsidies.filter(s => s.situations?.includes('farmer'));
    expect(farmerEntries.length, 'Expected at least 5 farmer-tagged entries').toBeGreaterThanOrEqual(5);
  });

  // ── 4. Young farmer startup subsidy is cross-tagged with entrepreneur ─────
  test('moa-young-farmer-startup-subsidy tagged with farmer and entrepreneur', () => {
    const entry = subsidies.find(s => s.id === 'moa-young-farmer-startup-subsidy');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('farmer');
    expect(entry!.situations).toContain('entrepreneur');
  });

  // ── 5. No duplicate IDs introduced ───────────────────────────────────────
  test('no duplicate subsidy IDs', () => {
    const ids = subsidies.map(s => s.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  // ── 6. All farmer entries have expected fields ────────────────────────────
  test('all farmer entries have title, agency, and situations fields', () => {
    const farmerEntries = subsidies.filter(s => s.situations?.includes('farmer'));
    expect(farmerEntries.length, 'Expected at least 5 farmer entries').toBeGreaterThanOrEqual(5);
    for (const entry of farmerEntries) {
      expect(entry.id, 'Entry must have id').toBeTruthy();
      expect((entry as Record<string, unknown>).title, `${entry.id} must have title`).toBeTruthy();
      expect((entry as Record<string, unknown>).agency, `${entry.id} must have agency`).toBeTruthy();
      expect(entry.situations, `${entry.id} must have situations containing 'farmer'`).toContain('farmer');
    }
  });
});
