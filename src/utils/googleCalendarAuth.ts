export interface CalendarEventInput {
  summary: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (24h)
  durationMinutes?: number;
}

/**
 * Helper to format a Date object as UTC YYYYMMDDTHHmmSSZ for Google Calendar URLs and .ics files
 */
const toGoogleCalendarUtcStamp = (dateObj: Date): string => {
  return dateObj.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Builds an official, zero-OAuth Google Calendar Event Template link
 * (`https://calendar.google.com/calendar/render?action=TEMPLATE...`)
 * Works in every browser for all public visitors without requiring OAuth app verification.
 */
export const buildGoogleCalendarTemplateUrl = (input: CalendarEventInput): string => {
  const timeStr = input.time && input.time.trim() ? input.time.trim() : '10:00';
  const durationMins = input.durationMinutes || 30;

  let startDateObj = new Date(`${input.date}T${timeStr}:00`);
  if (isNaN(startDateObj.getTime())) {
    startDateObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
    startDateObj.setHours(10, 0, 0, 0);
  }
  const endDateObj = new Date(startDateObj.getTime() + durationMins * 60 * 1000);

  const datesParam = `${toGoogleCalendarUtcStamp(startDateObj)}/${toGoogleCalendarUtcStamp(
    endDateObj
  )}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.summary || 'Gentle Step — untangle.',
    dates: datesParam,
    details: input.description || 'Scheduled gently via untangle-thoughts.',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generates and downloads a universal .ics calendar file for Apple Calendar, Outlook, or Google Calendar
 */
export const downloadIcsCalendarFile = (input: CalendarEventInput): void => {
  const timeStr = input.time && input.time.trim() ? input.time.trim() : '10:00';
  const durationMins = input.durationMinutes || 30;

  let startDateObj = new Date(`${input.date}T${timeStr}:00`);
  if (isNaN(startDateObj.getTime())) {
    startDateObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
    startDateObj.setHours(10, 0, 0, 0);
  }
  const endDateObj = new Date(startDateObj.getTime() + durationMins * 60 * 1000);

  const escapeIcsText = (str: string) =>
    str
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');

  const uid = `untangle-${Date.now()}@untangle-thoughts.app`;
  const nowStamp = toGoogleCalendarUtcStamp(new Date());
  const startStamp = toGoogleCalendarUtcStamp(startDateObj);
  const endStamp = toGoogleCalendarUtcStamp(endDateObj);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//untangle-thoughts//Gentle Worry Reflection//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeIcsText(input.summary || 'Gentle Step — untangle.')}`,
    `DESCRIPTION:${escapeIcsText(input.description || '')}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `untangle-step-${input.date || 'scheduled'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
