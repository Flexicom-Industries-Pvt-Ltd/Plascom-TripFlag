/**
 * Parse boolean values to canonical true/false.
 */

const TRUE_VALUES = new Set(['yes', 'y', 'true', '1', 'on']);
const FALSE_VALUES = new Set(['no', 'n', 'false', '0', 'off']);

export function parseBoolean(value) {
  if (value === null || value === undefined || value === '') {
    return { value: null, unit: null, raw: '', parseable: false };
  }

  const raw = String(value).trim();
  const str = raw.toLowerCase();

  if (TRUE_VALUES.has(str)) {
    return { value: true, unit: null, raw, parseable: true };
  }
  if (FALSE_VALUES.has(str)) {
    return { value: false, unit: null, raw, parseable: true };
  }
  if (typeof value === 'boolean') {
    return { value, unit: null, raw, parseable: true };
  }

  return { value: null, unit: null, raw, parseable: false };
}

export function parseBooleanRule(value) {
  return parseBoolean(value);
}
