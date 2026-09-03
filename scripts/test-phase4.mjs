/**
 * Phase 4 verification — rule schema validation
 * Run: node scripts/test-phase4.mjs
 */
import { validateRule, normalizeRulePayload, getFieldMeta } from '../lib/rule-schema.js';
import { getCellFlagsByField } from '../lib/flag-display.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓', label); }
  else { failed++; console.log('  ✗', label); }
}

console.log('\n=== Field Metadata ===');
const durMeta = getFieldMeta('duration');
assert(durMeta.type === 'duration', 'duration meta type');
assert(durMeta.units.includes('minutes'), 'duration has minutes unit');
assert(durMeta.operators.includes('gt'), 'duration has gt operator');

const statusMeta = getFieldMeta('status');
assert(statusMeta.type === 'enum', 'status is enum');
assert(statusMeta.enumSuggestions?.includes('STOPPAGE'), 'status has STOPPAGE suggestion');

console.log('\n=== Rule Validation ===');
const validDuration = validateRule({
  field_name: 'Duration',
  semantic_field: 'duration',
  field_type: 'duration',
  operator: 'gt',
  value: '30',
  unit: 'minutes',
});
assert(validDuration.valid, 'Valid duration rule passes');

const invalidOp = validateRule({
  field_name: 'Duration',
  semantic_field: 'duration',
  field_type: 'duration',
  operator: 'contains',
  value: '30',
  unit: 'minutes',
});
assert(!invalidOp.valid, 'contains rejected for duration');

const invalidUnit = validateRule({
  field_name: 'Distance',
  semantic_field: 'distance',
  field_type: 'distance',
  operator: 'gt',
  value: '50',
  unit: 'liters',
});
assert(!invalidUnit.valid, 'Invalid unit rejected for distance');

const missingValue = validateRule({
  field_name: 'Duration',
  semantic_field: 'duration',
  field_type: 'duration',
  operator: 'gt',
  value: '',
  unit: 'minutes',
});
assert(!missingValue.valid, 'Missing value rejected');

const betweenInvalid = validateRule({
  field_name: 'Distance',
  semantic_field: 'distance',
  field_type: 'distance',
  operator: 'between',
  value: '10',
  value_end: '',
  unit: 'km',
});
assert(!betweenInvalid.valid, 'Between without end value rejected');

console.log('\n=== Rule Normalization ===');
const normalized = normalizeRulePayload({
  semantic_field: 'distance',
  operator: 'gt',
  value: '50',
  unit: 'km',
});
assert(normalized.field_name === 'Distance', 'Auto field name from semantic');
assert(normalized.field_type === 'distance', 'Auto field type');
assert(normalized.semantic_field === 'distance', 'Preserves semantic field');
assert(normalized.label.includes('50'), 'Auto-generates label');

console.log('\n=== Multi-rule severity (same field) ===');
const multiFlags = [
  { field: 'Duration', severity: 'warning', reason: 'Duration above 30 minutes' },
  { field: 'Duration', severity: 'critical', reason: 'Duration above 100 minutes' },
];
const cellFlags = getCellFlagsByField(multiFlags);
assert(cellFlags.Duration.severity === 'critical', 'Cell uses highest severity (critical) when both rules fire');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
