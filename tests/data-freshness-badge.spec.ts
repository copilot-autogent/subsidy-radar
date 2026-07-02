import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pure badge-class logic (mirrors index.astro getFreshnessBadge) ─────────
function calendarMonthsAgo(verifiedYear: number, verifiedMonth: number, ref: Date): number {
  return (ref.getFullYear() - verifiedYear) * 12 + (ref.getMonth() + 1 - verifiedMonth);
}

function getFreshnessBadge(
  lastVerifiedDate: string | null | undefined,
  referenceDate: Date,
): { cls: string; label: string } {
  if (!lastVerifiedDate) {
    return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  }
  const parts = lastVerifiedDate.split('-').map(Number);
  const [y, m, d] = parts;
  const verified = new Date(y, m - 1, d);
  const isValid =
    parts.length === 3 &&
    Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) &&
    m >= 1 && m <= 12 && d >= 1 && d <= 31 &&
    verified.getFullYear() === y && verified.getMonth() === m - 1 && verified.getDate() === d &&
    verified <= referenceDate;
  if (!isValid) {
    return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  }
  const monthsAgo = calendarMonthsAgo(y, m, referenceDate);
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

  test('invalid or future date → freshness-outdated with 未核實', () => {
    // Future date
    expect(getFreshnessBadge('2027-01-01', REF).cls).toBe('freshness-outdated');
    expect(getFreshnessBadge('2027-01-01', REF).label).toBe('⚠️ 未核實');
    // Malformed
    expect(getFreshnessBadge('not-a-date', REF).cls).toBe('freshness-outdated');
    // Month 13
    expect(getFreshnessBadge('2026-13-01', REF).cls).toBe('freshness-outdated');
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
