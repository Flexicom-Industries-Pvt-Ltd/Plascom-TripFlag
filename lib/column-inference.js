import { matchHeaderToSemantic, getSemanticTypeMeta, resolveSemanticField } from './field-ontology.js';

/**
 * Header pattern rules for column type inference.
 * Order matters — first match wins.
 */
const HEADER_RULES = [
  { type: 'duration',  patterns: [/duration/i],                          format: 'h:mm' },
  { type: 'distance',  patterns: [/distance/i, /^km$/i, /travelled/i, /covered/i], unit: 'km' },
  { type: 'speed',     patterns: [/speed/i, /avg\s*speed/i],               unit: 'km/h' },
  { type: 'datetime',  patterns: [/timestamp/i, /from\s*time/i, /to\s*time/i, /start\s*time/i, /end\s*time/i, /date/i, /time/i] },
  { type: 'coordinate',patterns: [/latitude/i, /^lat$/i],                  unit: 'decimal' },
  { type: 'coordinate',patterns: [/longitude/i, /^lng$/i, /^lon$/i],      unit: 'decimal' },
  { type: 'enum',      patterns: [/vehicle\s*status/i, /^status$/i, /occurrence/i, /ignition/i], enumCategory: 'status' },
  { type: 'boolean',   patterns: [/wheelseye/i, /device/i],               },
  { type: 'number',    patterns: [/odometer/i, /^odo/i, /limit/i, /avg/i] },
  { type: 'text',      patterns: [/location/i, /vehicle\s*no/i, /reg\.?\s*no/i, /track/i, /vin/i] },
];

function extractUnitFromHeader(header) {
  const match = header.match(/\(([^)]+)\)/);
  if (!match) return null;
  const u = match[1].toLowerCase();
  if (u.includes('km/h') || u.includes('kmph')) return 'km/h';
  if (u.includes('km')) return 'km';
  if (u.includes('hh:mm:ss')) return 'hh:mm:ss';
  return u;
}

function matchHeaderRule(header) {
  const h = header.trim();
  for (const rule of HEADER_RULES) {
    if (rule.patterns.some(p => p.test(h))) {
      const unit = extractUnitFromHeader(h) || rule.unit || null;
      let format = rule.format || null;
      if (unit === 'hh:mm:ss') format = 'hh:mm:ss';
      return {
        type: rule.type,
        unit,
        format,
        enumCategory: rule.enumCategory || null,
      };
    }
  }
  return { type: 'text', unit: null, format: null, enumCategory: null };
}

function inferFromSamples(header, samples, baseMeta) {
  if (baseMeta.type !== 'text' && baseMeta.type !== 'number') return baseMeta;

  const nonEmpty = samples.filter(s => s !== null && s !== undefined && String(s).trim() !== '');
  if (nonEmpty.length === 0) return baseMeta;

  if (nonEmpty.some(s => {
    const t = String(s).trim();
    return /^\d+:\d{1,2}(:\d{2})?$/.test(t)
      || /^\d+\s*h(?:\s*\d+\s*m)?(?:\s*\d+\s*s)?$/i.test(t)
      || /^\d+\s*min(?:ute)?s?$/i.test(t)
      || /^\d+\s*hrs?\s/i.test(t);
  })) {
    const hasHms = nonEmpty.some(s => /^\d{1,2}:\d{2}:\d{2}$/.test(String(s).trim()));
    return { type: 'duration', unit: 'minutes', format: hasHms ? 'hh:mm:ss' : 'h:mm', enumCategory: null };
  }

  if (nonEmpty.every(s => /^(yes|no|on|off|true|false)$/i.test(String(s).trim()))) {
    return { type: 'boolean', unit: null, format: null, enumCategory: null };
  }

  if (nonEmpty.every(s => !isNaN(parseFloat(String(s).replace(/,/g, ''))))) {
    return { ...baseMeta, type: baseMeta.type === 'text' ? 'number' : baseMeta.type };
  }

  return baseMeta;
}

/**
 * Infer column types from headers and sample row data.
 */
export function inferColumnTypes(headers, sampleRows = []) {
  const columnTypes = {};

  for (const header of headers) {
    if (!header || String(header).trim() === '') continue;

    const baseMeta = matchHeaderRule(String(header));
    const samples = sampleRows.map(row => row[header]).filter(v => v !== undefined);
    const inferred = inferFromSamples(header, samples, baseMeta);

    const semanticField = matchHeaderToSemantic(header);
    const ontologyMeta = semanticField ? getSemanticTypeMeta(semanticField) : null;

    columnTypes[header] = {
      ...inferred,
      semanticField,
      // Prefer ontology type when semantic match is strong
      type: ontologyMeta?.type && semanticField ? ontologyMeta.type : inferred.type,
      unit: inferred.unit || ontologyMeta?.unit || null,
      enumCategory: inferred.enumCategory || ontologyMeta?.enumCategory || null,
    };
  }

  return columnTypes;
}

/**
 * Infer field type from a rule's field_name (for rules without explicit field_type).
 */
export function inferFieldTypeFromName(fieldName, unit = null) {
  if (!fieldName) return 'text';

  const semantic = resolveSemanticField(fieldName);
  if (semantic) return getSemanticTypeMeta(semantic).type;

  const meta = matchHeaderRule(fieldName);
  if (meta.type !== 'text') return meta.type;

  if (unit) {
    const u = unit.toLowerCase();
    if (u.includes('min')) return 'duration';
    if (u.includes('km/h') || u.includes('kph')) return 'speed';
    if (u.includes('km')) return 'distance';
  }
  return 'text';
}
