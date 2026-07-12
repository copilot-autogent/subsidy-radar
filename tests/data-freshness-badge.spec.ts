import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Pure badge-class logic (mirrors index.astro getFreshnessBadge) ─────────
function calendarMonthsAgo(verifiedYear: number, verifiedMonth: number, verifiedDay: number, ref: Date): number {
  let months = (ref.getFullYear() - verifiedYear) * 12 + (ref.getMonth() + 1 - verifiedMonth);
  if (ref.getDate() < verifiedDay) months -= 1;
  return months;
}

// NOTE: This mirrors src/utils/freshness.ts — keep in sync if the logic changes.
function getFreshnessBadge(
  lastVerifiedDate: string | null | undefined,
  referenceDate: Date,
): { cls: string; label: string } {
  if (!lastVerifiedDate) {
    return { cls: 'freshness-outdated', label: '⚠️ 未更新' };
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
    return { cls: 'freshness-outdated', label: '⚠️ 未更新' };
  }
  const monthsAgo = calendarMonthsAgo(y, m, d, referenceDate);
  // "已更新" (last updated) rather than "已核實" (officially verified)
  const label = `✓ 已更新 ${String(y)}-${String(m).padStart(2, '0')}`;
  if (monthsAgo < 3) return { cls: 'freshness-fresh', label };
  if (monthsAgo <= 6) return { cls: 'freshness-stale', label };
  return { cls: 'freshness-outdated', label: `⚠️ ${label}` };
}

const REF = new Date(2026, 6, 2); // 2026-07-02

test.describe('data freshness badge colour', () => {
  test('fresh: verified within 3 months → freshness-fresh', () => {
    const result = getFreshnessBadge('2026-06-01', REF);
    expect(result.cls).toBe('freshness-fresh');
    expect(result.label).toContain('已更新');
    expect(result.label).toContain('✓');
  });

  test('fresh: April 30 verified → July 1 is still fresh (day-of-month boundary)', () => {
    // April 30 to July 1: calendar months = 3, but day 1 < day 30 → adjusted to 2 → fresh
    const refJuly1 = new Date(2026, 6, 1); // 2026-07-01
    const result = getFreshnessBadge('2026-04-30', refJuly1);
    expect(result.cls).toBe('freshness-fresh');
  });

  test('stale: verified 3–6 months ago → freshness-stale', () => {
    // 2026-07-02 minus 4 months = 2026-03-02
    const result = getFreshnessBadge('2026-03-01', REF);
    expect(result.cls).toBe('freshness-stale');
    expect(result.label).toContain('已更新');
  });

  test('stale: exactly 6 calendar months old is still stale, not outdated', () => {
    // REF = 2026-07-02; verified = 2026-01-02 (exactly 6 calendar months)
    const result = getFreshnessBadge('2026-01-02', REF);
    expect(result.cls).toBe('freshness-stale');
  });

  test('outdated: 7+ calendar months → freshness-outdated', () => {
    // 2026-07-02 minus 7 months = 2025-12-02
    const result = getFreshnessBadge('2025-11-01', REF);
    expect(result.cls).toBe('freshness-outdated');
    expect(result.label).toContain('⚠️');
  });

  test('missing lastVerifiedDate → freshness-outdated with 未更新', () => {
    expect(getFreshnessBadge(undefined, REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未更新',
    });
    expect(getFreshnessBadge(null, REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未更新',
    });
    expect(getFreshnessBadge('', REF)).toEqual({
      cls: 'freshness-outdated',
      label: '⚠️ 未更新',
    });
  });

  test('invalid or future date → freshness-outdated with 未更新', () => {
    // Future date
    expect(getFreshnessBadge('2027-01-01', REF).cls).toBe('freshness-outdated');
    expect(getFreshnessBadge('2027-01-01', REF).label).toBe('⚠️ 未更新');
    // Malformed
    expect(getFreshnessBadge('not-a-date', REF).cls).toBe('freshness-outdated');
    // Month 13
    expect(getFreshnessBadge('2026-13-01', REF).cls).toBe('freshness-outdated');
  });

  test('all subsidies.json entries have valid lastVerifiedDate and non-empty source', () => {
    const dataPath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../src/data/subsidies.json',
    );
    const subsidies = JSON.parse(readFileSync(dataPath, 'utf-8')) as Array<{
      id: string;
      lastVerifiedDate?: unknown;
      source?: unknown;
    }>;

    const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

    const errors: string[] = [];
    for (const s of subsidies) {
      if (typeof s.lastVerifiedDate !== 'string' || !ISO_DATE_RE.test(s.lastVerifiedDate)) {
        errors.push(`${s.id}: invalid lastVerifiedDate="${s.lastVerifiedDate}"`);
      }
      if (typeof s.source !== 'string' || s.source.trim() === '') {
        errors.push(`${s.id}: missing or empty source`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Data integrity errors:\n${errors.join('\n')}`);
    }
    expect(errors.length).toBe(0);
  });
});
