import { FIELD_ONTOLOGY, resolveSemanticField } from './field-ontology.js';

export const FIELD_TYPES = [
  'duration', 'distance', 'speed', 'datetime',
  'enum', 'boolean', 'number', 'coordinate', 'text',
];

export const UNITS_BY_TYPE = {
  duration: ['minutes', 'hours'],
  distance: ['km', 'mi', 'm'],
  speed: ['km/h', 'mph'],
  datetime: [],
  enum: [],
  boolean: [],
  number: [],
  coordinate: [],
  text: [],
};

export const OPERATORS_BY_TYPE = {
  duration:  ['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  distance:  ['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  speed:     ['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  number:    ['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  coordinate:['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  datetime:  ['gt', 'lt', 'gte', 'lte', 'equals', 'not_equals', 'between', 'is_empty', 'is_not_empty'],
  enum:      ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
  boolean:   ['equals', 'not_equals'],
  text:      ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'],
};

export const OPERATOR_LABELS = {
  equals: 'Equals',
  not_equals: 'Not Equals',
  contains: 'Contains',
  not_contains: 'Does Not Contain',
  gt: 'Greater Than (>)',
  lt: 'Less Than (<)',
  gte: 'Greater or Equal (>=)',
  lte: 'Less or Equal (<=)',
  between: 'Between',
  is_empty: 'Is Empty',
  is_not_empty: 'Is Not Empty',
};

export const ENUM_SUGGESTIONS = {
  status: ['STOPPAGE', 'DRIVING', 'moving', 'idling', 'stopped'],
  ignition: ['On', 'Off'],
};

export const ALL_OPERATORS = Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }));

/**
 * Get field metadata for rules UI from semantic key.
 */
export function getFieldMeta(semanticKey) {
  const def = FIELD_ONTOLOGY[semanticKey];
  if (!def) {
    return {
      key: semanticKey,
      type: 'text',
      label: semanticKey?.replace(/_/g, ' ') || 'Custom',
      units: [],
      operators: OPERATORS_BY_TYPE.text,
      defaultUnit: null,
      valuePlaceholder: 'Enter value',
    };
  }

  const type = def.type;
  return {
    key: semanticKey,
    type,
    label: semanticKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    units: UNITS_BY_TYPE[type] || [],
    operators: OPERATORS_BY_TYPE[type] || OPERATORS_BY_TYPE.text,
    defaultUnit: def.unit || UNITS_BY_TYPE[type]?.[0] || null,
    valuePlaceholder: getValuePlaceholder(type),
    enumSuggestions: def.enumCategory ? ENUM_SUGGESTIONS[def.enumCategory] : null,
  };
}

function getValuePlaceholder(type) {
  switch (type) {
    case 'duration': return 'e.g. 30';
    case 'distance': return 'e.g. 50';
    case 'speed': return 'e.g. 60';
    case 'enum': return 'e.g. STOPPAGE, idling';
    case 'boolean': return 'Yes / No / On / Off';
    case 'number': return 'e.g. 240';
    case 'datetime': return 'e.g. 2026-09-01 or 10:00 PM';
    default: return 'Enter value';
  }
}

/**
 * Validate a rule payload before save.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateRule(rule) {
  const errors = [];

  if (!rule.field_name?.trim() && !rule.semantic_field?.trim()) {
    errors.push('A field is required');
  }

  if (!rule.operator) {
    errors.push('Operator is required');
  }

  const semantic = rule.semantic_field || resolveSemanticField(rule.field_name);
  const fieldType = rule.field_type || (semantic ? FIELD_ONTOLOGY[semantic]?.type : 'text') || 'text';

  const allowedOps = OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.text;
  if (rule.operator && !allowedOps.includes(rule.operator)) {
    errors.push(`Operator "${rule.operator}" is not valid for ${fieldType} fields`);
  }

  const needsValue = !['is_empty', 'is_not_empty'].includes(rule.operator);
  if (needsValue && !String(rule.value ?? '').trim()) {
    errors.push('Value is required for this condition');
  }

  if (rule.operator === 'between') {
    if (!String(rule.value_end ?? '').trim()) {
      errors.push('End value is required for "between" conditions');
    }
  }

  const allowedUnits = UNITS_BY_TYPE[fieldType] || [];
  if (rule.unit && allowedUnits.length > 0 && !allowedUnits.includes(rule.unit)) {
    errors.push(`Unit "${rule.unit}" is not valid for ${fieldType}. Use: ${allowedUnits.join(', ')}`);
  }

  if (needsValue && ['duration', 'distance', 'speed', 'number', 'coordinate'].includes(fieldType)) {
    const num = parseFloat(String(rule.value).replace(/,/g, ''));
    if (isNaN(num)) {
      errors.push('Value must be a number for this field type');
    }
    if (rule.operator === 'between') {
      const endNum = parseFloat(String(rule.value_end).replace(/,/g, ''));
      if (isNaN(endNum)) errors.push('End value must be a number');
    }
  }

  if (fieldType === 'boolean' && needsValue) {
    const v = String(rule.value).toLowerCase().trim();
    if (!['yes', 'no', 'on', 'off', 'true', 'false', '1', '0'].includes(v)) {
      errors.push('Boolean value must be Yes/No or On/Off');
    }
  }

  return { valid: errors.length === 0, errors, fieldType, semantic };
}

/**
 * Normalize rule payload before save.
 */
export function normalizeRulePayload(body) {
  const semantic = body.semantic_field || resolveSemanticField(body.field_name);
  const meta = semantic ? getFieldMeta(semantic) : { type: body.field_type || 'text', defaultUnit: null, label: body.field_name };

  const fieldType = body.field_type || meta.type || 'text';
  const unit = body.unit || (UNITS_BY_TYPE[fieldType]?.length ? meta.defaultUnit : null);

  const fieldName = body.field_name?.trim() || meta.label || semantic?.replace(/_/g, ' ');

  const opLabel = OPERATOR_LABELS[body.operator] || body.operator;
  const unitStr = unit ? ` ${unit}` : '';
  const label = body.label?.trim() || `${fieldName} ${opLabel} ${body.value || ''}${body.value_end ? ` – ${body.value_end}` : ''}${unitStr}`.trim();

  return {
    field_name: fieldName,
    semantic_field: semantic || null,
    field_type: fieldType,
    operator: body.operator,
    value: body.value ?? '',
    value_end: body.operator === 'between' ? (body.value_end ?? null) : null,
    unit: UNITS_BY_TYPE[fieldType]?.length ? unit : null,
    severity: body.severity || 'warning',
    label,
    is_active: body.is_active !== false,
  };
}

/**
 * List fields for API / UI.
 */
export function listFieldsForUI() {
  return Object.entries(FIELD_ONTOLOGY).map(([key, def]) => ({
    key,
    type: def.type,
    label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    defaultUnit: def.unit || UNITS_BY_TYPE[def.type]?.[0] || null,
    units: UNITS_BY_TYPE[def.type] || [],
    operators: OPERATORS_BY_TYPE[def.type] || OPERATORS_BY_TYPE.text,
    aliases: def.aliases || [],
    valuePlaceholder: getValuePlaceholder(def.type),
    enumSuggestions: def.enumCategory ? ENUM_SUGGESTIONS[def.enumCategory] : null,
  }));
}
