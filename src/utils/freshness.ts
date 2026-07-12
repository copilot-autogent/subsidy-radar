/**
 * Data-freshness badge utilities.
 *
 * NOTE: The badge label uses "已更新" (last updated) rather than "已核實"
 * (officially verified) because the date reflects when our data was last
 * updated, not an independent official verification.  Users should always
 * follow the official source link to confirm current details.
 */

export function calendarMonthsAgo(
  verifiedYear: number,
  verifiedMonth: number,
  verifiedDay: number,
  ref: Date = new Date(),
): number {
  let months =
    (ref.getFullYear() - verifiedYear) * 12 +
    (ref.getMonth() + 1 - verifiedMonth);
  if (ref.getDate() < verifiedDay) months -= 1;
  return months;
}

/** Returns { cls, label } for the data freshness badge. */
export function getFreshnessBadge(
  lastVerifiedDate: string | null | undefined,
  referenceDate?: Date,
): { cls: string; label: string } {
  if (!lastVerifiedDate) {
    return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  }
  const ref = referenceDate ?? (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
  const parts = lastVerifiedDate.split('-').map(Number);
  const [y, m, d] = parts;
  const verified = new Date(y, m - 1, d);
  const isValid =
    parts.length === 3 &&
    Number.isFinite(y) &&
    Number.isFinite(m) &&
    Number.isFinite(d) &&
    m >= 1 &&
    m <= 12 &&
    d >= 1 &&
    d <= 31 &&
    verified.getFullYear() === y &&
    verified.getMonth() === m - 1 &&
    verified.getDate() === d &&
    verified <= ref;
  if (!isValid) {
    return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  }
  const monthsAgo = calendarMonthsAgo(y, m, d, ref);
  const label = `✓ 已更新 ${String(y)}-${String(m).padStart(2, '0')}`;
  if (monthsAgo < 3) return { cls: 'freshness-fresh', label };
  if (monthsAgo <= 6) return { cls: 'freshness-stale', label };
  return { cls: 'freshness-outdated', label: `⚠️ ${label}` };
}
