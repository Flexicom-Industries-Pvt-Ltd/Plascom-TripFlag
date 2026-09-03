/**
 * Parse geographic coordinates (decimal degrees).
 */
export function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: 'decimal', raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const num = parseFloat(raw);

  if (!isNaN(num) && num >= -180 && num <= 180) {
    return { value: num, unit: 'decimal', raw, parseable: true };
  }

  return { value: null, unit: 'decimal', raw, parseable: false };
}

export function parseCoordinateRule(value) {
  return parseCoordinate(value);
}
