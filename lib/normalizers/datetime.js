/**
 * Parse datetime values to canonical epoch milliseconds.
 */

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parse12hTime(h, m, ampm) {
  let hour = parseInt(h, 10);
  const min = parseInt(m, 10);
  if (ampm) {
    const ap = ampm.toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
  }
  return { hour, min };
}

export function parseDateTime(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: 'iso', raw: '', parseable: false };
  }

  const raw = String(value).trim();

  // Native Date parse (ISO, etc.)
  const native = Date.parse(raw);
  if (!isNaN(native) && !/^\d+:\d+/.test(raw)) {
    return { value: native, unit: 'iso', raw, parseable: true };
  }

  // "29-08-2026 04:24:57 PM" (DD-MM-YYYY)
  let match = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    const { hour, min } = parse12hTime(match[4], match[5], match[7]);
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const d = new Date(+match[3], +match[2] - 1, +match[1], hour, min, sec);
    return { value: d.getTime(), unit: 'iso', raw, parseable: true };
  }

  // "01 Sep 2026 09:59" (DD Mon YYYY HH:MM)
  match = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
    if (month !== undefined) {
      const { hour, min } = parse12hTime(match[4], match[5], match[7]);
      const sec = match[6] ? parseInt(match[6], 10) : 0;
      const d = new Date(+match[3], month, +match[1], hour, min, sec);
      return { value: d.getTime(), unit: 'iso', raw, parseable: true };
    }
  }

  // "09:00 PM" time-only — use epoch offset from midnight today
  match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match) {
    const { hour, min } = parse12hTime(match[1], match[2], match[3]);
    const d = new Date(2000, 0, 1, hour, min, 0);
    return { value: d.getTime(), unit: 'iso', raw, parseable: true };
  }

  return { value: null, unit: 'iso', raw, parseable: false };
}

export function parseDateTimeRule(value) {
  return parseDateTime(value);
}
