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

test.describe('worker persona — data & filter logic', () => {
  let subsidies: Subsidy[];

  test.beforeAll(() => {
    subsidies = loadSubsidies();
  });

  // ── 1. Chip render: worker persona chip has supporting data ───────────────
  test('worker situation exists on at least 1 subsidy (chip has data to show)', () => {
    const workerSubsidies = subsidies.filter(s => s.situations?.includes('worker'));
    expect(workerSubsidies.length).toBeGreaterThanOrEqual(1);
  });

  // ── 2. New worker entries present ─────────────────────────────────────────
  test('all new worker entries have required fields and worker situation', () => {
    const workerIds = [
      'worker-training-voucher',
      'employment-insurance-maternity',
      'occupational-injury-subsidy',
    ];
    for (const id of workerIds) {
      const entry = subsidies.find(s => s.id === id);
      expect(entry, `Entry ${id} should exist`).toBeDefined();
      expect(entry!.situations, `${id} should have worker situation`).toContain('worker');
    }
  });

  // ── 3. Existing entries correctly tagged ─────────────────────────────────
  test('itraining-subsidy tagged with worker', () => {
    const entry = subsidies.find(s => s.id === 'itraining-subsidy');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('worker');
  });

  test('parental-leave-allowance tagged with worker', () => {
    const entry = subsidies.find(s => s.id === 'parental-leave-allowance');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('worker');
  });

  test('employment-promotion-subsidy tagged with worker', () => {
    const entry = subsidies.find(s => s.id === 'employment-promotion-subsidy');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('worker');
  });

  // ── 4. Total entry count target ──────────────────────────────────────────
  test('worker entries reach the issue-144 target (at least 5)', () => {
    const workerEntries = subsidies.filter(s => s.situations?.includes('worker'));
    expect(workerEntries.length, 'Expected at least 5 worker-tagged entries').toBeGreaterThanOrEqual(5);
  });

  // ── 5. Worker + young-child overlap (育嬰留職停薪) ────────────────────────
  test('parental-leave-allowance tagged with both worker and young-child', () => {
    const entry = subsidies.find(s => s.id === 'parental-leave-allowance');
    expect(entry).toBeDefined();
    expect(entry!.situations).toContain('worker');
    expect(entry!.situations).toContain('young-child');
  });
});
