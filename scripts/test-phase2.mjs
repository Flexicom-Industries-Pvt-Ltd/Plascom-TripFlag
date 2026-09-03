/**
 * Phase 2 verification — semantic field mapping across formats
 * Run: node scripts/test-phase2.mjs
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { inferColumnTypes } from '../lib/column-inference.js';
import { buildFieldMap, resolveSemanticField, matchHeaderToSemantic } from '../lib/field-ontology.js';
import { normalizeRow } from '../lib/normalizers/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓', label); }
  else { failed++; console.log('  ✗', label); }
}

console.log('\n=== Semantic Field Resolution ===');
assert(resolveSemanticField('Distance') === 'distance', 'Distance → distance');
assert(resolveSemanticField('Km') === 'distance', 'Km → distance');
assert(resolveSemanticField('Distance Travelled(km)') === 'distance', 'Distance Travelled(km) → distance');
assert(resolveSemanticField('Duration (hh:mm:ss)') === 'duration', 'Duration (hh:mm:ss) → duration');
assert(resolveSemanticField('Vehicle Speed(km/hr)') === 'speed', 'Vehicle Speed(km/hr) → speed');
assert(resolveSemanticField('Avg Speed') === 'speed', 'Avg Speed → speed');
assert(resolveSemanticField('Vehicle Status') === 'status', 'Vehicle Status → status');
assert(matchHeaderToSemantic('From Location') === 'from_location', 'From Location → from_location');

console.log('\n=== Cross-Format: distance > 50 km (semantic normalized) ===');
const formats = [
  { headers: ['Distance', 'Duration'], row: { Distance: '34.98', Duration: '0:28' }, expect: false },
  { headers: ['Km', 'Duration (hh:mm:ss)'], row: { Km: '90', 'Duration (hh:mm:ss)': '00:17:57' }, expect: true },
  { headers: ['Distance Travelled(km)', 'Vehicle Speed(km/hr)'], row: { 'Distance Travelled(km)': 55, 'Vehicle Speed(km/hr)': 1 }, expect: true },
];

for (const fmt of formats) {
  const types = inferColumnTypes(fmt.headers, [fmt.row]);
  const { fieldMap } = buildFieldMap(fmt.headers, types);
  const normalized = normalizeRow(fmt.row, types, fieldMap);
  const distVal = normalized._semantic?.distance?.value;
  const isOver = distVal != null && distVal > 50;
  assert(fieldMap.distance != null, `field_map.distance for [${fmt.headers[0]}...] → ${fieldMap.distance}`);
  assert(isOver === fmt.expect, `distance=${distVal}km > 50 → ${isOver} (expected ${fmt.expect})`);
}

console.log('\n=== Cross-Format: duration > 30 min (semantic normalized) ===');
const durFormats = [
  { headers: ['Duration'], row: { Duration: '0:51' }, expect: true },
  { headers: ['Duration (hh:mm:ss)'], row: { 'Duration (hh:mm:ss)': '00:17:57' }, expect: false },
  { headers: ['Duration'], row: { Duration: '7:20' }, expect: true },
];

for (const fmt of durFormats) {
  const types = inferColumnTypes(fmt.headers, [fmt.row]);
  const { fieldMap } = buildFieldMap(fmt.headers, types);
  const normalized = normalizeRow(fmt.row, types, fieldMap);
  const durVal = normalized._semantic?.duration?.value;
  const isOver = durVal != null && durVal > 30;
  assert(isOver === fmt.expect, `${fmt.headers[0]}=${Object.values(fmt.row)[0]} → ${durVal?.toFixed(1)}min, flag ${fmt.expect}`);
}

console.log('\n=== Semantic map in normalized row ===');
const types = inferColumnTypes(['Distance', 'Duration', 'Status'], [{ Distance: '10', Duration: '0:45', Status: 'STOPPAGE' }]);
const { fieldMap } = buildFieldMap(['Distance', 'Duration', 'Status'], types);
const norm = normalizeRow({ Distance: '10', Duration: '0:45', Status: 'STOPPAGE' }, types, fieldMap);
assert(norm._semantic?.distance?.value === 10, '_semantic.distance = 10');
assert(norm._semantic?.duration?.value === 45, '_semantic.duration = 45 min');
assert(norm._semantic?.status?.value === 'stopped', '_semantic.status = stopped');

console.log('\n=== Real Excel Files — Field Maps ===');
const formatsDir = path.resolve('../Formats');
if (fs.existsSync(formatsDir)) {
  for (const file of fs.readdirSync(formatsDir).filter(f => f.endsWith('.xlsx'))) {
    const wb = XLSX.readFile(path.join(formatsDir, file));
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let headerRow = -1;
      let headers = [];
      for (let r = 0; r < Math.min(20, raw.length); r++) {
        if (raw[r].filter(c => c !== '').length >= 3) {
          headers = raw[r].map(c => String(c).trim()).filter(h => h && !h.includes('__EMPTY'));
          headerRow = r;
          break;
        }
      }
      if (headerRow < 0) continue;

      const rows = [];
      for (let r = headerRow + 1; r < Math.min(headerRow + 6, raw.length); r++) {
        const row = {};
        raw[headerRow].forEach((h, i) => { if (h) row[String(h).trim()] = raw[r][i] ?? ''; });
        if (Object.values(row).some(v => v !== '')) rows.push(row);
      }

      const colTypes = inferColumnTypes(headers, rows);
      const { fieldMap: fm } = buildFieldMap(headers, colTypes);
      const mapped = Object.entries(fm).map(([k, v]) => `${k}→${v}`).join(', ');
      if (Object.keys(fm).length > 0) {
        console.log(`  ${file} [${sheetName}]: ${mapped}`);
      }
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
