import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
];

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('NO_ACCESS_TOKEN');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || '';
    const msg = error instanceof Error ? error.message : String(error);

    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('cancelled-popup-request')
    ) {
      throw new Error('POPUP_CLOSED');
    }

    if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
      throw new Error('POPUP_BLOCKED');
    }

    if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
      throw new Error('UNAUTHORIZED_DOMAIN');
    }

    console.warn('Google sign-in notice:', error);
    throw new Error('SIGN_IN_UNAVAILABLE');
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export interface CalendarEventInput {
  summary: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (24h)
  durationMinutes?: number;
}

export interface CalendarEventResponse {
  id: string;
  htmlLink?: string;
  summary?: string;
}

/**
 * Helper to format a Date object as UTC YYYYMMDDTHHmmSSZ for Google Calendar URLs and .ics files
 */
const toGoogleCalendarUtcStamp = (dateObj: Date): string => {
  return dateObj.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

/**
 * Builds an official, zero-OAuth-warning Google Calendar Event Template link
 * (`https://calendar.google.com/calendar/render?action=TEMPLATE...`)
 * Works in every browser without requiring OAuth app verification.
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
    details: input.description || 'Scheduled gently via untangle.',
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

  const uid = `untangle-${Date.now()}@tanyasingh.app`;
  const nowStamp = toGoogleCalendarUtcStamp(new Date());
  const startStamp = toGoogleCalendarUtcStamp(startDateObj);
  const endStamp = toGoogleCalendarUtcStamp(endDateObj);

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//untangle by Tanya Singh//Gentle Worry Reflection//EN',
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

export const createGoogleCalendarEvent = async (
  input: CalendarEventInput
): Promise<CalendarEventResponse> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('NEEDS_AUTH');
  }

  const timeStr = input.time && input.time.trim() ? input.time.trim() : '10:00';
  const durationMins = input.durationMinutes || 30;

  const startDateObj = new Date(`${input.date}T${timeStr}:00`);
  if (isNaN(startDateObj.getTime())) {
    throw new Error('Please choose a valid date and time.');
  }

  const endDateObj = new Date(startDateObj.getTime() + durationMins * 60 * 1000);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const eventBody = {
    summary: input.summary,
    description: input.description,
    start: {
      dateTime: startDateObj.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endDateObj.toISOString(),
      timeZone,
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    }
  );

  if (response.status === 401 || response.status === 403) {
    cachedAccessToken = null;
    throw new Error('NEEDS_AUTH');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message =
      errData?.error?.message || `Failed to create calendar event (${response.status})`;
    throw new Error(message);
  }

  return response.json();
};
