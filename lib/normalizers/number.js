/**
 * Parse plain numeric values.
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: null, raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const num = parseFloat(raw.replace(/,/g, ''));

  if (!isNaN(num)) {
    return { value: num, unit: null, raw, parseable: true };
  }

  return { value: null, unit: null, raw, parseable: false };
}

export function parseNumberRule(value) {
  return parseNumber(value);
}
