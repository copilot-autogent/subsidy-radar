import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pure badge-class logic (mirrors index.astro getFreshnessBadge) ─────────
function getFreshnessBadge(
  lastVerifiedDate: string | null | undefined,
  referenceDate: Date,
): { cls: string; label: string } {
  if (!lastVerifiedDate) {
    return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  }
  const [y, m, d] = lastVerifiedDate.split('-').map(Number);
  const verified = new Date(y, m - 1, d);
  const monthsAgo =
    (referenceDate.getTime() - verified.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  const label = `✓ 已核實 ${String(y)}-${String(m).padStart(2, '0')}`;
  if (monthsAgo < 3) return { cls: 'freshness-fresh', label };
  if (monthsAgo < 6) return { cls: 'freshness-stale', label };
  return { cls: 'freshness-outdated', label: `⚠️ ${label}` };
}

const REF = new Date(2026, 6, 2); // 2026-07-02

test.describe('data freshness badge colour', () => {
  test('fresh: verified within 3 months → freshness-fresh', () => {
    const result = getFreshnessBadge('2026-06-01', REF);
    expect(result.cls).toBe('freshness-fresh');
    expect(result.label).toContain('已核實');
    expect(result.label).toContain('✓');
  });

  test('stale: verified 3–6 months ago → freshness-stale', () => {
    // 2026-07-02 minus 4 months = 2026-03-02
    const result = getFreshnessBadge('2026-03-01', REF);
    expect(result.cls).toBe('freshness-stale');
    expect(result.label).toContain('已核實');
  });

  test('outdated: verified >6 months ago → freshness-outdated', () => {
    // 2026-07-02 minus 7 months = 2025-12-02
    const result = getFreshnessBadge('2025-11-01', REF);
    expect(result.cls).toBe('freshness-outdated');
    expect(result.label).toContain('⚠️');
  });

  test('missing lastVerifiedDate → freshness-outdated with 未核實', () => {
    expect(getFreshnessBadge(undefined, REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未核實',
    });
    expect(getFreshnessBadge(null, REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未核實',
    });
    expect(getFreshnessBadge('', REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未核實',
    });
  });

  test('all subsidies.json entries have lastVerifiedDate and source fields', () => {
    const dataPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../src/data/subsidies.json',
    );
    const subsidies = JSON.parse(readFileSync(dataPath, 'utf-8')) as Array<{
      id: string;
      lastVerifiedDate?: unknown;
      source?: unknown;
    }>;

    const missing = subsidies.filter(
      s => typeof s.lastVerifiedDate !== 'string' || typeof s.source !== 'string',
    );
    if (missing.length > 0) {
      throw new Error(
        `${missing.length} entr(ies) missing lastVerifiedDate or source: ${missing.map(s => s.id).join(', ')}`,
      );
    }
    expect(missing.length).toBe(0);
  });
});
