import subsidiesRaw from '../data/subsidies.json';

export type Situation =
  | 'renter' | 'homebuyer' | 'entrepreneur' | 'parent' | 'fresh-grad'
  | 'unemployed' | 'employed' | 'senior' | 'disabled' | 'new-immigrant'
  | 'indigenous' | 'low-income' | 'single-parent' | 'young-child' | 'student';

export type Subsidy = typeof subsidiesRaw[number] & {
  isYouthHighlight?: boolean;
  difficulty?: string;
  steps?: string[];
  deadlineDate?: string;
  addedDate?: string;
  situations?: Situation[];
  maxAmount?: number;
  counties?: string[];
  requiredDocs?: string[];
  officialUrl?: string;
  lastVerifiedDate?: string;
  source?: string;
};

export const subsidies = subsidiesRaw as Subsidy[];

// ── Freshness badge ────────────────────────────────────────────────────────

const BUILD_DATE = new Date();
BUILD_DATE.setHours(0, 0, 0, 0);

function calendarMonthsAgo(verifiedYear: number, verifiedMonth: number, verifiedDay: number): number {
  let months =
    (BUILD_DATE.getFullYear() - verifiedYear) * 12 +
    (BUILD_DATE.getMonth() + 1 - verifiedMonth);
  if (BUILD_DATE.getDate() < verifiedDay) months -= 1;
  return months;
}

export function getFreshnessBadge(lastVerifiedDate: string | null | undefined): { cls: string; label: string } {
  if (!lastVerifiedDate) return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  const parts = lastVerifiedDate.split('-').map(Number);
  const [y, m, d] = parts;
  const verified = new Date(y, m - 1, d);
  const isValid =
    parts.length === 3 &&
    Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d) &&
    m >= 1 && m <= 12 && d >= 1 && d <= 31 &&
    verified.getFullYear() === y && verified.getMonth() === m - 1 && verified.getDate() === d &&
    verified <= BUILD_DATE;
  if (!isValid) return { cls: 'freshness-outdated', label: '⚠️ 未核實' };
  const monthsAgo = calendarMonthsAgo(y, m, d);
  const label = `✓ 已核實 ${String(y)}-${String(m).padStart(2, '0')}`;
  if (monthsAgo < 3) return { cls: 'freshness-fresh', label };
  if (monthsAgo <= 6) return { cls: 'freshness-stale', label };
  return { cls: 'freshness-outdated', label: `⚠️ ${label}` };
}

// ── Related subsidies ──────────────────────────────────────────────────────

const DIFFICULTY_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

export function getRelatedSubsidies(subsidy: Subsidy, all: Subsidy[], max = 3): Subsidy[] {
  const mySituations = new Set<string>(subsidy.situations ?? []);
  if (mySituations.size === 0) return [];
  return all
    .filter(s => s.id !== subsidy.id)
    .map(s => ({ s, shared: (s.situations ?? []).filter(sit => mySituations.has(sit)).length }))
    .filter(({ shared }) => shared > 0)
    .sort(
      (a, b) =>
        b.shared - a.shared ||
        (DIFFICULTY_ORDER[a.s.difficulty ?? 'medium'] ?? 1) -
          (DIFFICULTY_ORDER[b.s.difficulty ?? 'medium'] ?? 1),
    )
    .map(({ s }) => s)
    .slice(0, max);
}

// ── URL safety ─────────────────────────────────────────────────────────────

export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trimStart();
  const lower = trimmed.toLowerCase();
  return lower.startsWith('https://') || lower.startsWith('http://') ? trimmed : undefined;
}

// ── Deadline status labels ─────────────────────────────────────────────────

export const deadlineLabel: Record<string, { text: string; cls: string }> = {
  open:     { text: '✅ 開放申請中', cls: 'status-open' },
  ongoing:  { text: '🔄 長期辦理',   cls: 'status-ongoing' },
  periodic: { text: '📅 定期開放',   cls: 'status-periodic' },
  closed:   { text: '⏸ 已截止',      cls: 'status-closed' },
};

// ── Difficulty labels ──────────────────────────────────────────────────────

export const difficultyLabel: Record<string, { text: string; cls: string; tooltip: string }> = {
  easy:   { text: '🟢 申請簡單', cls: 'diff-easy',   tooltip: '線上申請，約5-10分鐘可完成' },
  medium: { text: '🟡 需備文件', cls: 'diff-medium', tooltip: '需備齊紙本文件，約1-2週處理' },
  hard:   { text: '🔴 流程複雜', cls: 'diff-hard',   tooltip: '多步驟審核流程，建議先電話諮詢' },
};

// ── Situation display labels ───────────────────────────────────────────────

export const situationLabel: Record<string, { icon: string; label: string }> = {
  'renter':       { icon: '🏠', label: '找租屋' },
  'homebuyer':    { icon: '🏡', label: '想買房' },
  'entrepreneur': { icon: '💼', label: '想創業' },
  'parent':       { icon: '👶', label: '育兒家庭' },
  'fresh-grad':   { icon: '🎓', label: '應屆畢業生' },
  'unemployed':   { icon: '🔍', label: '求職中' },
  'employed':     { icon: '💪', label: '在職者' },
  'senior':       { icon: '👴', label: '長者' },
  'disabled':     { icon: '♿', label: '身障朋友' },
  'new-immigrant':{ icon: '🌏', label: '新住民' },
  'indigenous':   { icon: '🏔️', label: '原住民族' },
  'low-income':   { icon: '💰', label: '低/中低收入戶' },
  'single-parent':{ icon: '👩‍👧', label: '單親家庭' },
  'young-child':  { icon: '🍼', label: '育兒(0-6歲)' },
  'student':      { icon: '📚', label: '在學學生' },
};
