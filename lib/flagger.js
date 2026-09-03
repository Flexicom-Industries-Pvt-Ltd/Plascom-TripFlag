import Fuse from 'fuse.js';
import { normalizeValue, normalizeRuleValue, getSemanticNormalized } from './normalizers/index';
import { inferFieldTypeFromName } from './column-inference';
import {
  resolveRuleToColumn,
  resolveSemanticField,
  getSemanticTypeMeta,
} from './field-ontology';

/**
 * Run all active rules against parsed trip data rows.
 * Uses semantic field mapping + typed normalization for cross-format comparisons.
 */
export function runFlagging(rows, rules, columnHeaders, columnTypes = {}, normalizedRows = null, fieldMap = {}) {
  if (!rows || !rules || rules.length === 0) {
    return rows.map(r => ({ ...r, flags: [] }));
  }

  const fuseColumns = new Fuse(columnHeaders, {
    threshold: 0.4,
    distance: 100,
    includeScore: true,
  });

  const flaggedRows = rows.map((row, rowIndex) => {
    const flags = [];
    const rowNormalized = normalizedRows?.[rowIndex] || null;

    for (const rule of rules) {
      if (!rule.is_active) continue;

      const { column: matchedColumn, semantic } = resolveRuleColumn(
        rule, columnHeaders, fieldMap, fuseColumns
      );
      if (!matchedColumn) continue;

      const semanticKey = semantic || rule.semantic_field || resolveSemanticField(rule.field_name);
      const columnMeta = columnTypes[matchedColumn] || getSemanticTypeMeta(semanticKey) || { type: 'text' };
      const fieldType = rule.field_type
        || (semanticKey ? getSemanticTypeMeta(semanticKey).type : null)
        || inferFieldTypeFromName(rule.field_name, rule.unit)
        || columnMeta.type;

      const cellValue = row[matchedColumn];
      const normalizedCell = getSemanticNormalized(rowNormalized, semanticKey, matchedColumn)
        || normalizeValue(cellValue, { ...columnMeta, type: fieldType });

      const isFlagged = evaluateTypedRule(rule, normalizedCell, cellValue, fieldType, columnMeta);

      if (isFlagged) {
        const displayActual = normalizedCell.parseable && normalizedCell.value !== null
          ? formatNormalizedDisplay(normalizedCell, fieldType)
          : String(cellValue ?? '');

        const semanticLabel = semanticKey ? semanticKey.replace(/_/g, ' ') : matchedColumn;
        let reasonStr = rule.label || `${semanticLabel} ${rule.operator} ${rule.value}`;
        if (!rule.label && rule.unit) reasonStr += ` ${rule.unit}`;

        flags.push({
          field: matchedColumn,
          semantic_field: semanticKey,
          rule_id: rule.id,
          rule_field: rule.field_name,
          operator: rule.operator,
          expected: rule.value,
          actual: displayActual,
          raw_actual: cellValue,
          severity: rule.severity,
          reason: reasonStr,
          field_type: fieldType,
        });
      }
    }

    return { ...row, flags };
  });

  return flaggedRows;
}

function resolveRuleColumn(rule, columnHeaders, fieldMap, fuseColumns) {
  const resolved = resolveRuleToColumn(rule, columnHeaders, fieldMap);
  if (resolved.column) return resolved;

  // Fuse.js fallback for unknown / custom fields
  const normalized = rule.field_name?.toLowerCase().trim();
  const exact = columnHeaders.find(h => h.toLowerCase().trim() === normalized);
  if (exact) {
    return { column: exact, semantic: resolveSemanticField(rule.field_name) };
  }

  const results = fuseColumns.search(rule.field_name);
  if (results.length > 0 && results[0].score < 0.4) {
    const col = results[0].item;
    return { column: col, semantic: resolveSemanticField(col) || resolveSemanticField(rule.field_name) };
  }

  return { column: null, semantic: null };
}

function formatNormalizedDisplay(normalized, fieldType) {
  if (fieldType === 'duration') {
    const mins = normalized.value;
    if (mins < 60) return `${Math.round(mins * 10) / 10} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  }
  if (fieldType === 'distance') return `${normalized.value} km`;
  if (fieldType === 'speed') return `${normalized.value} km/h`;
  if (fieldType === 'datetime') return new Date(normalized.value).toISOString();
  if (fieldType === 'boolean') return normalized.value ? 'Yes' : 'No';
  return String(normalized.value ?? normalized.raw);
}

function evaluateTypedRule(rule, normalizedCell, rawValue, fieldType, columnMeta) {
  const { operator, value, value_end } = rule;

  if (operator === 'is_empty') {
    return rawValue === null || rawValue === undefined || String(rawValue).trim() === '';
  }

  if (operator === 'is_not_empty') {
    return rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '';
  }

  if (!normalizedCell.parseable && fieldType !== 'text') {
    return false;
  }

  const ruleNorm = normalizeRuleValue(
    { ...rule, field_type: fieldType },
    { ...columnMeta, type: fieldType }
  );

  switch (fieldType) {
    case 'duration':
    case 'distance':
    case 'speed':
    case 'number':
    case 'coordinate':
      return evaluateNumeric(operator, normalizedCell.value, ruleNorm.value, value_end, fieldType, rule);

    case 'datetime':
      return evaluateNumeric(operator, normalizedCell.value, ruleNorm.value, value_end, fieldType, rule);

    case 'boolean':
      return evaluateBoolean(operator, normalizedCell.value, ruleNorm.value);

    case 'enum':
      return evaluateEnum(operator, normalizedCell.value, ruleNorm.value, rawValue, value);

    case 'text':
    default:
      return evaluateText(operator, normalizedCell.raw || String(rawValue ?? ''), value);
  }
}

function evaluateNumeric(operator, cellVal, ruleVal, valueEnd, fieldType, rule) {
  if (cellVal === null || ruleVal === null || isNaN(cellVal) || isNaN(ruleVal)) return false;

  let endVal = null;
  if (operator === 'between' && valueEnd != null) {
    const endNorm = normalizeRuleValue(
      { ...rule, value: valueEnd, field_type: fieldType },
      { type: fieldType }
    );
    endVal = endNorm.value;
    if (endVal === null || isNaN(endVal)) return false;
  }

  switch (operator) {
    case 'equals': return cellVal === ruleVal;
    case 'not_equals': return cellVal !== ruleVal;
    case 'gt': return cellVal > ruleVal;
    case 'lt': return cellVal < ruleVal;
    case 'gte': return cellVal >= ruleVal;
    case 'lte': return cellVal <= ruleVal;
    case 'between': return cellVal >= ruleVal && cellVal <= endVal;
    default: return false;
  }
}

function evaluateBoolean(operator, cellVal, ruleVal) {
  if (cellVal === null || ruleVal === null) return false;
  switch (operator) {
    case 'equals': return cellVal === ruleVal;
    case 'not_equals': return cellVal !== ruleVal;
    default: return false;
  }
}

function evaluateEnum(operator, cellVal, ruleVal, rawValue, ruleStr) {
  const raw = String(rawValue ?? '').toLowerCase().trim();
  const target = String(ruleStr ?? '').toLowerCase().trim();

  switch (operator) {
    case 'equals': return cellVal === ruleVal || raw === target;
    case 'not_equals': return cellVal !== ruleVal && raw !== target;
    case 'contains': return raw.includes(target) || (cellVal && cellVal.includes(ruleVal));
    case 'not_contains': return !raw.includes(target);
    default: return false;
  }
}

function evaluateText(operator, cellStr, ruleStr) {
  const cell = String(cellStr).toLowerCase().trim();
  const rule = String(ruleStr).toLowerCase().trim();

  switch (operator) {
    case 'equals':
      return cell === rule || cell.includes(rule);
    case 'not_equals':
      return cell !== rule && !cell.includes(rule);
    case 'contains': {
      const fuseCellCheck = new Fuse([cell], { threshold: 0.3 });
      return cell.includes(rule) || fuseCellCheck.search(rule).length > 0;
    }
    case 'not_contains':
      return !cell.includes(rule);
    default:
      return false;
  }
}
