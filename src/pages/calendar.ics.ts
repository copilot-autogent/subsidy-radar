/**
 * iCal feed for subsidy application deadlines.
 * RFC 5545 compliant: CRLF line endings, 75-octet line folding,
 * property-value escaping for SUMMARY/DESCRIPTION/LOCATION/URL.
 */
import subsidiesRaw from '../data/subsidies.json';

type Subsidy = typeof subsidiesRaw[number] & { deadlineDate?: string };
const subsidies = subsidiesRaw as Subsidy[];

const CRLF = '\r\n';

// RFC 5545 §3.3.11 — escape backslash, semicolon, comma, newline in TEXT values.
function escapeText(text: string): string {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// RFC 5545 §3.3.13 — URI values: only backslash needs escaping per RFC; however
// most consumers tolerate (and some require) escaping of ; and , as well, since
// they are property-value separators. Escape conservatively.
function escapeUri(uri: string): string {
  return String(uri ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

// RFC 5545 §3.1 — fold long content lines at 75 OCTETS (not characters).
// Continuation lines begin with a single space.
function foldLine(line: string): string {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const bytes = enc.encode(line);
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let limit = 75;
  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Avoid splitting a multi-byte UTF-8 sequence: walk back to a valid boundary.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(dec.decode(bytes.slice(offset, end)));
    offset = end;
    limit = 74; // continuation lines reserve 1 octet for the leading space
  }
  return parts.join(CRLF + ' ');
}

function addDays(dateStr: string, days: number): string {
  // YYYY-MM-DD → date-only YYYYMMDD shifted by `days` days.
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatUtcStamp(date: Date): string {
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export async function GET() {
  const now = new Date();
  const dtstamp = formatUtcStamp(now);
  const prodId = '-//補助雷達//Subsidy Deadlines//ZH';

  const withDeadlines = subsidies.filter(s => typeof s.deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.deadlineDate));

  const eventLines: string[] = [];
  for (const subsidy of withDeadlines) {
    const startDate = subsidy.deadlineDate!.replace(/-/g, '');
    // For DTSTART;VALUE=DATE, DTEND is exclusive — set to next day so the all-day
    // event covers the deadline day in clients that require an explicit DTEND.
    const endDate = addDays(subsidy.deadlineDate!, 1);

    const title = String(subsidy.title ?? '(未命名補助)');
    const summary = escapeText(`📅 ${title} - 申請截止`);
    const eligibility = Array.isArray(subsidy.eligibility) ? subsidy.eligibility : [];
    const descBody = [
      String(subsidy.summary ?? ''),
      '',
      '申請條件：',
      ...eligibility.map(e => `- ${e}`),
      '',
      `立即申請：${subsidy.applicationUrl ?? ''}`,
    ].join('\n');
    const description = escapeText(descBody);
    const location = escapeText(subsidy.agency ?? '');
    const url = escapeUri(subsidy.applicationUrl ?? '');
    const uid = `subsidy-${subsidy.id}@subsidy-radar.copilot-autogent.github.io`;

    const lines = [
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      foldLine(`SUMMARY:${summary}`),
      foldLine(`DESCRIPTION:${description}`),
      foldLine(`LOCATION:${location}`),
    ];
    if (url) lines.push(foldLine(`URL:${url}`));
    lines.push('STATUS:CONFIRMED');
    lines.push('BEGIN:VALARM');
    lines.push('TRIGGER:-P7D');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:${escapeText(`${title} 申請即將截止（還有 7 天）`)}`));
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
    eventLines.push(...lines);
  }

  const calendarLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    foldLine(`PRODID:${prodId}`),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:補助雷達 - 申請截止日曆'),
    'X-WR-TIMEZONE:Asia/Taipei',
    foldLine('X-WR-CALDESC:台灣政府補助申請截止日期提醒'),
    ...eventLines,
    'END:VCALENDAR',
    '', // trailing CRLF after END:VCALENDAR per RFC 5545 §3.4
  ];

  const ical = calendarLines.join(CRLF);

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="subsidies-deadlines.ics"',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
