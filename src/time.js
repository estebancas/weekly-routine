import { TIMEZONE } from './config.js';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const labelFormatter = new Intl.DateTimeFormat('es-CR', {
  timeZone: TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Current instant expressed in the configured timezone, never the device's.
 * @returns {{ dateKey: string, weekday: number, minutesOfDay: number, hour: number, minute: number, dateLabel: string }}
 */
export function nowInZone(date = resolveNow()) {
  const parts = {};
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday],
    minutesOfDay: hour * 60 + minute,
    hour,
    minute,
    dateLabel: labelFormatter.format(date).replace(/\./g, ''),
  };
}

/**
 * Dev only: `?now=2026-09-29T19:05` fakes the clock, interpreted as Costa Rica local time
 * (fixed UTC-6, no DST). Ignored in production builds.
 */
function resolveNow() {
  if (import.meta.env.DEV) {
    const raw = new URLSearchParams(window.location.search).get('now');
    if (raw) {
      const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00-06:00` : raw;
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}
