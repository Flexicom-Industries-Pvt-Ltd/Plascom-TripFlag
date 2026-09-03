/**
 * Parse duration values to canonical minutes.
 * Handles: h:mm, hh:mm:ss, Xh Ym Zs, X hrs Y min, plain minutes, Excel serial fractions.
 */
export function parseDuration(value, hints = {}) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: 'minutes', raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const str = raw.toLowerCase();

  // "45 hrs :7 min" / "45 hrs 7 min"
  let match = str.match(/^(\d+)\s*hrs?\s*:?\s*(\d+)\s*min/i);
  if (match) {
    const minutes = +match[1] * 60 + +match[2];
    return { value: minutes, unit: 'minutes', raw, parseable: true };
  }

  // "1h 8m 25s", "1h 8m", "24m 54s", "36m", "1m" (PDF / fleet formats)
  match = str.match(/^(?:(\d+)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$/i);
  if (match && (match[1] || match[2] || match[3])) {
    const minutes = (+match[1] || 0) * 60 + (+match[2] || 0) + (+match[3] || 0) / 60;
    return { value: minutes, unit: 'minutes', raw, parseable: true };
  }

  // "00:17:57" (hh:mm:ss)
  match = str.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    const minutes = +match[1] * 60 + +match[2] + +match[3] / 60;
    return { value: minutes, unit: 'minutes', raw, parseable: true };
  }

  // "0:28", "17:50", "5:3" (h:mm — fleet default)
  match = str.match(/^(\d+):(\d{1,2})$/);
  if (match) {
    const minutes = +match[1] * 60 + +match[2];
    return { value: minutes, unit: 'minutes', raw, parseable: true };
  }

  // "30 mins", "30 minutes", "30 min"
  match = str.match(/^(\d+(?:\.\d+)?)\s*min(?:ute)?s?$/i);
  if (match) {
    return { value: +match[1], unit: 'minutes', raw, parseable: true };
  }

  // Excel serial time fraction of day (0.5 = 12 hours)
  if (hints.cellType === 'n' || /^-?\d*\.\d+$/.test(str)) {
    const n = parseFloat(str);
    if (!isNaN(n) && n >= 0 && n < 1) {
      return { value: n * 24 * 60, unit: 'minutes', raw, parseable: true };
    }
    if (!isNaN(n)) {
      return { value: n, unit: 'minutes', raw, parseable: true };
    }
  }

  // "2 hours", "2 hrs", "2h"
  match = str.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?$/i);
  if (match) {
    return { value: +match[1] * 60, unit: 'minutes', raw, parseable: true };
  }

  // Plain number assumed minutes
  const plain = parseFloat(str);
  if (!isNaN(plain)) {
    return { value: plain, unit: 'minutes', raw, parseable: true };
  }

  return { value: null, unit: 'minutes', raw, parseable: false };
}

export function parseDurationRule(value, unit) {
  const hints = {};
  const combined = unit ? `${value} ${unit}` : String(value);
  return parseDuration(combined, hints);
}
