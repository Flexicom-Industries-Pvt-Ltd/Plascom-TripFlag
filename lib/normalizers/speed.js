/**
 * Parse speed values to canonical km/h.
 */
export function parseSpeed(value, hints = {}) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: 'km/h', raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const str = raw.toLowerCase();
  const defaultUnit = hints.unit || 'km/h';

  const unitMatch = str.match(/^([\d,]+(?:\.\d+)?)\s*(km\/h|kmph|kph|mph|m\/s)$/i);
  if (unitMatch) {
    const num = parseFloat(unitMatch[1].replace(/,/g, ''));
    const u = unitMatch[2].toLowerCase();
    let kmh = num;
    if (u === 'mph') kmh = num * 1.60934;
    if (u === 'm/s') kmh = num * 3.6;
    return { value: kmh, unit: 'km/h', raw, parseable: true };
  }

  const num = parseFloat(str.replace(/,/g, ''));
  if (!isNaN(num)) {
    return { value: num, unit: defaultUnit, raw, parseable: true };
  }

  return { value: null, unit: 'km/h', raw, parseable: false };
}

export function parseSpeedRule(value, unit) {
  return parseSpeed(unit ? `${value} ${unit}` : value, { unit: unit || 'km/h' });
}
