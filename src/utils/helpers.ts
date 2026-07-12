/** Only allow http/https scheme URLs to prevent javascript: injection. */
export function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trimStart();
  const lower = trimmed.toLowerCase();
  return lower.startsWith('https://') || lower.startsWith('http://')
    ? trimmed
    : undefined;
}

/** Normalize full agency names to parent-ministry groups. */
export function normalizeAgency(agency: string): string {
  if (!agency) return '其他';
  if (agency.startsWith('衛生福利部')) return '衛福部';
  if (agency.startsWith('勞動部')) return '勞動部';
  if (agency.startsWith('教育部')) return '教育部';
  if (agency.startsWith('內政部') || agency.startsWith('國家住宅及都市更新中心'))
    return '內政部';
  if (agency.startsWith('原住民族')) return '原民會';
  if (agency.startsWith('國家科學及技術委員會')) return '國科會';
  if (agency.startsWith('經濟部')) return '經濟部';
  if (agency.startsWith('財政部')) return '財政部';
  if (agency.startsWith('農業部')) return '農業部';
  if (agency.startsWith('各縣市')) return '各縣市';
  return '其他';
}

/**
 * Build-time amount parser: extracts the best numeric value from an amount
 * string. Returns an integer (元), applying ×12 annualisation for monthly
 * (每月) amounts where appropriate.
 */
export function parseAmountValue(amount: string): number {
  if (!amount) return 0;
  const text = amount.replace(/,/g, '');
  let maxValue = 0;
  let foundWan = false;

  const wanRe = /(\d+(?:\.\d+)?)\s*萬/g;
  let m: RegExpExecArray | null;
  while ((m = wanRe.exec(text)) !== null) {
    const v = parseFloat(m[1]) * 10000;
    if (v > maxValue) maxValue = v;
    foundWan = true;
  }

  const yuanRe = /(\d+(?:\.\d+)?)\s*元/g;
  while ((m = yuanRe.exec(text)) !== null) {
    const v = parseFloat(m[1]);
    if (v > maxValue) maxValue = v;
  }

  if (maxValue === 0) return 0;

  const hasAnnual = /每年|年省|全年/.test(amount);
  const hasMonthly = /每月/.test(amount);
  if (hasMonthly && !hasAnnual && !foundWan) {
    const monthlyRe = /每月[^萬元]*?(\d[\d]*(?:\.\d+)?)\s*元/g;
    let monthlyMax = 0;
    let mm: RegExpExecArray | null;
    while ((mm = monthlyRe.exec(text)) !== null) {
      const v = parseFloat(mm[1]);
      if (v > monthlyMax) monthlyMax = v;
    }
    if (monthlyMax > 0 && monthlyMax >= maxValue) maxValue *= 12;
  }

  return Math.round(maxValue);
}

export const deadlineLabel: Record<string, { text: string; cls: string }> = {
  open:     { text: '✅ 開放申請中', cls: 'status-open' },
  ongoing:  { text: '🔄 長期辦理',   cls: 'status-ongoing' },
  periodic: { text: '📅 定期開放',   cls: 'status-periodic' },
  closed:   { text: '⏸ 已截止',      cls: 'status-closed' },
};

export const difficultyLabel: Record<
  string,
  { text: string; cls: string; tooltip: string }
> = {
  easy: {
    text: '🟢 申請簡單',
    cls: 'diff-easy',
    tooltip: '線上申請，約5-10分鐘可完成',
  },
  medium: {
    text: '🟡 需備文件',
    cls: 'diff-medium',
    tooltip: '需備齊紙本文件，約1-2週處理',
  },
  hard: {
    text: '🔴 流程複雜',
    cls: 'diff-hard',
    tooltip: '多步驟審核流程，建議先電話諮詢',
  },
};

export const personas = [
  { key: 'fresh-grad',   icon: '🎓', label: '應屆畢業生' },
  { key: 'student',      icon: '📚', label: '在學學生' },
  { key: 'worker',       icon: '👷', label: '勞工/就業' },
  { key: 'middle-aged',  icon: '👨‍💼', label: '中高齡(45+)' },
  { key: 'renter',       icon: '🏠', label: '找租屋' },
  { key: 'homebuyer',    icon: '🏡', label: '想買房' },
  { key: 'entrepreneur', icon: '💼', label: '想創業' },
  { key: 'parent',       icon: '👶', label: '育兒家庭' },
  { key: 'young-child',  icon: '🍼', label: '育兒(0-6歲)' },
  { key: 'single-parent',icon: '👩‍👧', label: '單親家庭' },
  { key: 'senior',       icon: '👴', label: '長者' },
  { key: 'indigenous',   icon: '🏔️', label: '原住民族' },
  { key: 'disabled',     icon: '♿', label: '身障朋友' },
  { key: 'low-income',   icon: '💰', label: '低/中低收入戶' },
  { key: 'veteran',      icon: '🎖️', label: '榮民' },
  { key: 'farmer',       icon: '🌾', label: '農民' },
] as const;
