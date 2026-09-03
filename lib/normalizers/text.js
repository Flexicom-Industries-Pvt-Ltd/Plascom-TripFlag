/**
 * Text values — no numeric normalization, preserve raw string.
 */
export function parseText(value) {
  if (value === null || value === undefined) {
    return { value: null, unit: null, raw: '', parseable: true };
  }

  const raw = String(value).trim();
  return { value: raw.toLowerCase(), unit: null, raw, parseable: true };
}

export function parseTextRule(value) {
  return parseText(value);
}
