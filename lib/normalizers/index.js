import { parseDuration, parseDurationRule } from './duration.js';
import { parseDistance, parseDistanceRule } from './distance.js';
import { parseSpeed, parseSpeedRule } from './speed.js';
import { parseDateTime, parseDateTimeRule } from './datetime.js';
import { parseEnum, parseEnumRule } from './enum.js';
import { parseBoolean, parseBooleanRule } from './boolean.js';
import { parseNumber, parseNumberRule } from './number.js';
import { parseCoordinate, parseCoordinateRule } from './coordinate.js';
import { parseText, parseTextRule } from './text.js';

export const FIELD_TYPES = [
  'duration', 'distance', 'speed', 'datetime',
  'enum', 'boolean', 'number', 'coordinate', 'text',
];

export const NORMALIZERS = {
  duration:  { parse: parseDuration,  parseRule: parseDurationRule,  canonicalUnit: 'minutes' },
  distance:  { parse: parseDistance,  parseRule: parseDistanceRule,  canonicalUnit: 'km' },
  speed:     { parse: parseSpeed,     parseRule: parseSpeedRule,     canonicalUnit: 'km/h' },
  datetime:  { parse: parseDateTime,  parseRule: parseDateTimeRule,  canonicalUnit: 'iso' },
  enum:      { parse: parseEnum,      parseRule: parseEnumRule,      canonicalUnit: null },
  boolean:   { parse: parseBoolean,   parseRule: parseBooleanRule,   canonicalUnit: null },
  number:    { parse: parseNumber,    parseRule: parseNumberRule,    canonicalUnit: null },
  coordinate:{ parse: parseCoordinate,parseRule: parseCoordinateRule,canonicalUnit: 'decimal' },
  text:      { parse: parseText,      parseRule: parseTextRule,      canonicalUnit: null },
};

/**
 * Normalize a single cell value given its column type metadata.
 */
export function normalizeValue(value, columnMeta = {}) {
  const type = columnMeta.type || 'text';
  const normalizer = NORMALIZERS[type] || NORMALIZERS.text;
  const hints = {
    unit: columnMeta.unit,
    format: columnMeta.format,
    enumCategory: columnMeta.enumCategory,
    cellType: columnMeta.cellType,
  };
  return normalizer.parse(value, hints);
}

/**
 * Normalize a rule threshold value.
 */
export function normalizeRuleValue(rule, columnMeta = {}) {
  const type = rule.field_type || columnMeta.type || 'text';
  const normalizer = NORMALIZERS[type] || NORMALIZERS.text;

  if (type === 'duration') return normalizer.parseRule(rule.value, rule.unit);
  if (type === 'distance') return normalizer.parseRule(rule.value, rule.unit);
  if (type === 'speed') return normalizer.parseRule(rule.value, rule.unit);
  if (type === 'datetime') return normalizer.parseRule(rule.value);
  if (type === 'enum') return normalizer.parseRule(rule.value);
  if (type === 'boolean') return normalizer.parseRule(rule.value);
  if (type === 'number') return normalizer.parseRule(rule.value);
  if (type === 'coordinate') return normalizer.parseRule(rule.value);
  return normalizer.parseRule(rule.value);
}

/**
 * Normalize all columns in a row.
 * Returns header-keyed values plus _semantic keyed canonical values.
 */
export function normalizeRow(row, columnTypes, fieldMap = null) {
  const normalized = {};
  const semantic = {};

  for (const [header, meta] of Object.entries(columnTypes)) {
    const rawValue = row[header];
    normalized[header] = normalizeValue(rawValue, meta);

    const semanticKey = meta.semanticField;
    if (semanticKey && !semantic[semanticKey]) {
      semantic[semanticKey] = normalized[header];
    }
  }

  // Fill semantic map from field_map if provided
  if (fieldMap) {
    for (const [semanticKey, header] of Object.entries(fieldMap)) {
      if (!semantic[semanticKey] && normalized[header]) {
        semantic[semanticKey] = normalized[header];
      }
    }
  }

  if (Object.keys(semantic).length > 0) {
    normalized._semantic = semantic;
  }

  return normalized;
}

/**
 * Extract semantic-keyed normalized values from a stored normalized row.
 */
export function getSemanticNormalized(normalizedRow, semanticKey, columnHeader) {
  if (!normalizedRow) return null;
  if (normalizedRow._semantic?.[semanticKey]) return normalizedRow._semantic[semanticKey];
  if (columnHeader && normalizedRow[columnHeader]) return normalizedRow[columnHeader];
  return null;
}

export { parseDuration, parseDistance, parseSpeed, parseDateTime, parseEnum, parseBoolean, parseNumber, parseCoordinate, parseText };
