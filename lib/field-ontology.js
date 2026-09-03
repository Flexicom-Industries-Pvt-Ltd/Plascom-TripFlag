/**
 * Semantic field ontology — maps canonical field keys to column name patterns.
 * Rules target semantic keys; field_map resolves them to actual headers per trip.
 */

export const FIELD_ONTOLOGY = {
  duration: {
    type: 'duration',
    unit: 'minutes',
    format: 'h:mm',
    aliases: ['duration', 'trip duration', 'stop duration', 'total trip duration'],
    patterns: [/duration/i],
  },
  distance: {
    type: 'distance',
    unit: 'km',
    aliases: ['distance', 'km', 'distance travelled', 'distance covered', 'distance travelled(km)', 'distance covered (km)'],
    patterns: [/^km$/i, /distance\s*travelled/i, /distance\s*covered/i, /^distance$/i],
  },
  speed: {
    type: 'speed',
    unit: 'km/h',
    aliases: ['speed', 'avg speed', 'average speed', 'vehicle speed', 'vehicle speed(km/hr)'],
    patterns: [/vehicle\s*speed/i, /avg\s*speed/i, /average\s*speed/i, /^speed$/i],
  },
  status: {
    type: 'enum',
    enumCategory: 'status',
    aliases: ['status', 'vehicle status'],
    patterns: [/^status$/i, /vehicle\s*status/i],
  },
  start_time: {
    type: 'datetime',
    aliases: ['from time', 'start time', 'timestamp'],
    patterns: [/from\s*time/i, /start\s*time/i, /^timestamp$/i],
  },
  end_time: {
    type: 'datetime',
    aliases: ['to time', 'end time'],
    patterns: [/to\s*time/i, /end\s*time/i],
  },
  vehicle_no: {
    type: 'text',
    aliases: ['vehicle no', 'vehicle number', 'reg. no.', 'registration', 'reg no'],
    patterns: [/vehicle\s*no/i, /reg\.?\s*no/i, /registration/i],
  },
  from_location: {
    type: 'text',
    aliases: ['from location', 'start location'],
    patterns: [/from\s*location/i, /start\s*location/i],
  },
  to_location: {
    type: 'text',
    aliases: ['to location', 'end location'],
    patterns: [/to\s*location/i, /end\s*location/i],
  },
  location: {
    type: 'text',
    aliases: ['location'],
    patterns: [/^location$/i, /location\s*\(/i],
  },
  latitude: {
    type: 'coordinate',
    unit: 'decimal',
    aliases: ['latitude', 'lat'],
    patterns: [/latitude/i, /^lat$/i],
  },
  longitude: {
    type: 'coordinate',
    unit: 'decimal',
    aliases: ['longitude', 'lng', 'lon'],
    patterns: [/longitude/i, /^lng$/i, /^lon$/i],
  },
  odometer: {
    type: 'number',
    aliases: ['odometer', 'odometer(km)'],
    patterns: [/odometer/i],
  },
  start_odo: {
    type: 'number',
    aliases: ['start odo', 'start odometer'],
    patterns: [/start\s*odo/i],
  },
  end_odo: {
    type: 'number',
    aliases: ['end odo', 'end odometer'],
    patterns: [/end\s*odo/i],
  },
  ignition: {
    type: 'enum',
    enumCategory: 'ignition',
    aliases: ['ignition', 'ignition status'],
    patterns: [/ignition/i],
  },
  limit: {
    type: 'number',
    aliases: ['limit'],
    patterns: [/^limit$/i],
  },
  occurrence: {
    type: 'enum',
    aliases: ['occurrence', 'event'],
    patterns: [/occurrence/i, /^event$/i],
  },
  wheelseye_device: {
    type: 'boolean',
    aliases: ['wheelseye device', 'device', 'wheelseye'],
    patterns: [/wheelseye/i],
  },
  fuel: {
    type: 'number',
    aliases: ['fuel', 'fuel level', 'fuel consumption'],
    patterns: [/fuel/i],
  },
  driver_name: {
    type: 'text',
    aliases: ['driver name', 'driver', 'driver_name'],
    patterns: [/driver/i],
  },
  weight: {
    type: 'number',
    aliases: ['weight', 'load weight'],
    patterns: [/weight/i],
  },
};

/** Ordered keys — more specific patterns should be checked first in buildFieldMap */
export const ONTOLOGY_MATCH_ORDER = [
  'start_odo', 'end_odo', 'start_time', 'end_time',
  'from_location', 'to_location',
  'duration', 'distance', 'speed', 'status',
  'vehicle_no', 'latitude', 'longitude', 'odometer',
  'ignition', 'limit', 'occurrence', 'wheelseye_device',
  'location', 'fuel', 'driver_name', 'weight',
];

function normalizeKey(str) {
  return String(str || '').toLowerCase().trim().replace(/[_\s]+/g, ' ');
}

/**
 * Score how well a header matches a semantic field definition.
 */
function scoreHeaderMatch(header, semanticKey, def) {
  const h = normalizeKey(header);
  const key = normalizeKey(semanticKey);

  if (h === key) return 100;
  if (def.aliases?.some(a => normalizeKey(a) === h)) return 95;

  for (const pattern of def.patterns || []) {
    if (pattern.test(header)) return 80;
  }

  if (def.aliases?.some(a => h.includes(normalizeKey(a)) || normalizeKey(a).includes(h))) {
    return 60;
  }

  return 0;
}

/**
 * Resolve any field name / alias / header to a canonical semantic key.
 */
export function resolveSemanticField(name) {
  if (!name) return null;
  const normalized = normalizeKey(name).replace(/\s+/g, '_');

  if (FIELD_ONTOLOGY[normalized]) return normalized;

  const spaced = normalizeKey(name);
  for (const [key, def] of Object.entries(FIELD_ONTOLOGY)) {
    if (def.aliases?.some(a => normalizeKey(a) === spaced)) return key;
    if (normalizeKey(key).replace(/_/g, ' ') === spaced) return key;
  }

  for (const key of ONTOLOGY_MATCH_ORDER) {
    const def = FIELD_ONTOLOGY[key];
    if (def.patterns?.some(p => p.test(name))) return key;
  }

  return null;
}

/**
 * Match a single header to its best semantic field.
 */
export function matchHeaderToSemantic(header) {
  let bestKey = null;
  let bestScore = 0;

  for (const key of ONTOLOGY_MATCH_ORDER) {
    const def = FIELD_ONTOLOGY[key];
    const score = scoreHeaderMatch(header, key, def);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestScore >= 60 ? bestKey : null;
}

/**
 * Build semantic → actual column header map for a trip.
 * @returns {{ fieldMap: Object, reverseMap: Object }}
 */
export function buildFieldMap(headers, columnTypes = {}) {
  const fieldMap = {};
  const reverseMap = {};
  const claimed = new Set();

  const scored = [];
  for (const header of headers) {
    if (!header || String(header).trim() === '') continue;
    const semantic = columnTypes[header]?.semanticField || matchHeaderToSemantic(header);
    if (!semantic) continue;
    const def = FIELD_ONTOLOGY[semantic];
    const score = scoreHeaderMatch(header, semantic, def);
    scored.push({ header, semantic, score });
  }

  scored.sort((a, b) => b.score - a.score);

  for (const { header, semantic, score } of scored) {
    if (claimed.has(semantic)) continue;
    if (score < 60) continue;
    fieldMap[semantic] = header;
    reverseMap[header] = semantic;
    claimed.add(semantic);
  }

  return { fieldMap, reverseMap };
}

/**
 * Resolve a rule to the actual column header for a given trip.
 */
export function resolveRuleToColumn(rule, columnHeaders, fieldMap = {}) {
  const semantic =
    rule.semantic_field ||
    resolveSemanticField(rule.field_name) ||
    null;

  if (semantic && fieldMap[semantic]) {
    const col = fieldMap[semantic];
    if (columnHeaders.includes(col)) return { column: col, semantic };
  }

  // Direct header match
  const normalized = normalizeKey(rule.field_name);
  const exact = columnHeaders.find(h => normalizeKey(h) === normalized);
  if (exact) {
    return { column: exact, semantic: fieldMap ? reverseLookup(fieldMap, exact) : null };
  }

  // Semantic key might match a header literally (legacy rules)
  if (semantic) {
    const literal = columnHeaders.find(h => normalizeKey(h).replace(/\s+/g, '_') === semantic);
    if (literal) return { column: literal, semantic };
  }

  return { column: null, semantic };
}

function reverseLookup(fieldMap, header) {
  for (const [semantic, col] of Object.entries(fieldMap)) {
    if (col === header) return semantic;
  }
  return null;
}

/**
 * Get type metadata for a semantic field from ontology.
 */
export function getSemanticTypeMeta(semanticKey) {
  const def = FIELD_ONTOLOGY[semanticKey];
  if (!def) return { type: 'text', unit: null, format: null, enumCategory: null };
  return {
    type: def.type,
    unit: def.unit || null,
    format: def.format || null,
    enumCategory: def.enumCategory || null,
    semanticField: semanticKey,
  };
}

/**
 * List all semantic fields for UI / documentation.
 */
export function listSemanticFields() {
  return Object.entries(FIELD_ONTOLOGY).map(([key, def]) => ({
    key,
    type: def.type,
    unit: def.unit || null,
    aliases: def.aliases || [],
  }));
}
