/**
 * iCal feed for subsidy application deadlines
 * Returns .ics file for calendar subscriptions
 */
import subsidiesRaw from '../data/subsidies.json';

type Subsidy = typeof subsidiesRaw[number] & { deadlineDate?: string };
const subsidies = subsidiesRaw as Subsidy[];

export async function GET() {
  const now = new Date();
  const prodId = '-//補助雷達//Subsidy Deadlines//ZH';
  
  // Filter subsidies with explicit deadlineDate
  const withDeadlines = subsidies.filter(s => s.deadlineDate);
  
  // Build iCal events
  const events = withDeadlines.map(subsidy => {
    const deadlineDate = new Date(subsidy.deadlineDate!);
    // Set deadline to 23:59 on the deadline date
    deadlineDate.setHours(23, 59, 59, 999);
    
    // Format dates as iCal format: YYYYMMDDTHHmmssZ
    const formatDate = (date: Date): string => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hour = String(date.getUTCHours()).padStart(2, '0');
      const minute = String(date.getUTCMinutes()).padStart(2, '0');
      const second = String(date.getUTCSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hour}${minute}${second}Z`;
    };
    
    const dtstart = formatDate(deadlineDate);
    const dtstamp = formatDate(now);
    const uid = `subsidy-${subsidy.id}@subsidy-radar.copilot-autogent.github.io`;
    
    // Escape special characters in iCal text fields
    const escape = (text: string): string => {
      return text
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
    };
    
    const summary = escape(`📅 ${subsidy.title} - 申請截止`);
    const description = escape(`${subsidy.summary}\n\n申請條件：\n${subsidy.eligibility.join('\n')}\n\n立即申請：${subsidy.applicationUrl}`);
    const location = escape(subsidy.agency);
    
    // Create reminder: 7 days before deadline
    const alarm = `BEGIN:VALARM
TRIGGER:-P7D
ACTION:DISPLAY
DESCRIPTION:${escape(subsidy.title)} 申請即將截止（還有 7 天）
END:VALARM`;
    
    return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART;VALUE=DATE:${subsidy.deadlineDate!.replace(/-/g, '')}
SUMMARY:${summary}
DESCRIPTION:${description}
LOCATION:${location}
URL:${subsidy.applicationUrl}
STATUS:CONFIRMED
${alarm}
END:VEVENT`;
  }).join('\n');
  
  const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:${prodId}
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:補助雷達 - 申請截止日曆
X-WR-TIMEZONE:Asia/Taipei
X-WR-CALDESC:台灣政府補助申請截止日期提醒
${events}
END:VCALENDAR`;

  return new Response(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="subsidies-deadlines.ics"',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
