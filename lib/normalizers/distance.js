/**
 * Parse distance values to canonical kilometers.
 */
export function parseDistance(value, hints = {}) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: 'km', raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const str = raw.toLowerCase();
  const defaultUnit = hints.unit || 'km';

  // "90.1 km", "0.5 mi", "1500 m"
  const unitMatch = str.match(/^([\d,]+(?:\.\d+)?)\s*(km|kilometers?|mi|miles?|m|meters?)$/i);
  if (unitMatch) {
    const num = parseFloat(unitMatch[1].replace(/,/g, ''));
    const u = unitMatch[2].toLowerCase();
    let km = num;
    if (u.startsWith('mi')) km = num * 1.60934;
    if (u === 'm' || u.startsWith('meter')) km = num / 1000;
    return { value: km, unit: 'km', raw, parseable: true };
  }

  const num = parseFloat(str.replace(/,/g, ''));
  if (!isNaN(num)) {
    return { value: num, unit: defaultUnit, raw, parseable: true };
  }

  return { value: null, unit: 'km', raw, parseable: false };
}

export function parseDistanceRule(value, unit) {
  return parseDistance(unit ? `${value} ${unit}` : value, { unit: unit || 'km' });
}
