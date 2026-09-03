/**
 * Phase 1 verification script — run with: node scripts/test-phase1.mjs
 */
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { inferColumnTypes } from '../lib/column-inference.js';
import { normalizeRow, normalizeValue, parseDuration, parseDistance, parseSpeed } from '../lib/normalizers/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓', label); }
  else { failed++; console.log('  ✗', label); }
}

function shouldFlagDuration(input, threshold = 30) {
  const norm = parseDuration(input);
  return norm.parseable && norm.value > threshold;
}

console.log('\n=== Duration Parser ===');
const durationTests = [
  ['0:28', 28, false],
  ['0:51', 51, true],
  ['7:20', 440, true],
  ['00:17:57', 17.95, false],
  ['00:00:54', 0.9, false],
  ['00:30:01', 30.02, true],
  ['24m 54s', 24.9, false],
  ['1h 8m', 68, true],
  ['36m', 36, true],
  ['1m', 1, false],
  ['45 hrs :7 min', 2707, true],
  ['30 mins', 30, false],
];

for (const [input, expectedMins, shouldFlag] of durationTests) {
  const result = parseDuration(input);
  const approx = Math.abs(result.value - expectedMins) < 0.1;
  assert(result.parseable && approx, `${input} → ${result.value?.toFixed(2)} min (expected ~${expectedMins})`);
  assert(shouldFlagDuration(input) === shouldFlag, `${input} flag gt 30min → ${shouldFlagDuration(input)} (expected ${shouldFlag})`);
}

console.log('\n=== Distance Parser ===');
assert(parseDistance('34.98').value === 34.98, 'plain 34.98');
assert(parseDistance('90.1 km').value === 90.1, '90.1 km');
assert(parseDistance('0.24').value === 0.24, 'string distance 0.24');
assert(parseDistance('34.98').value <= 50, '34.98 not > 50');
assert(parseDistance('90.1 km').value > 50, '90.1 > 50');

console.log('\n=== Speed Parser ===');
assert(parseSpeed('7.56').value === 7.56, 'speed 7.56');
assert(parseSpeed('1').value === 1, 'speed 1');

console.log('\n=== Column Type Inference ===');
const headers = ['Vehicle No', 'Duration', 'Distance', 'Avg Speed', 'Status', 'Ignition Status'];
const sampleRows = [
  { 'Vehicle No': 'WB11', Duration: '0:28', Distance: '0.24', 'Avg Speed': '7.56', Status: 'STOPPAGE', 'Ignition Status': 'On' },
];
const types = inferColumnTypes(headers, sampleRows);
assert(types['Duration']?.type === 'duration', 'Duration inferred as duration');
assert(types['Distance']?.type === 'distance', 'Distance inferred as distance');
assert(types['Avg Speed']?.type === 'speed', 'Avg Speed inferred as speed');
assert(types['Status']?.type === 'enum', 'Status inferred as enum');

console.log('\n=== Row Normalization ===');
const normalized = normalizeRow(sampleRows[0], types);
assert(normalized['Duration']?.value === 28, 'row Duration normalized to 28 min');
assert(normalized['Distance']?.value === 0.24, 'row Distance normalized to 0.24 km');

console.log('\n=== Real Excel Files ===');
const formatsDir = path.resolve('../Formats');
if (fs.existsSync(formatsDir)) {
  for (const file of fs.readdirSync(formatsDir).filter(f => f.endsWith('.xlsx'))) {
    console.log(`\n  File: ${file}`);
    const wb = XLSX.readFile(path.join(formatsDir, file), { cellDates: true });
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      let headerRow = -1;
      let headers = [];
      for (let r = 0; r < Math.min(20, raw.length); r++) {
        const nonEmpty = raw[r].filter(c => c !== '' && c != null);
        if (nonEmpty.length >= 3) {
          headers = raw[r].map(c => String(c).trim()).filter(h => h && !h.includes('__EMPTY'));
          headerRow = r;
          break;
        }
      }
      if (headerRow < 0) continue;

      const rows = [];
      for (let r = headerRow + 1; r < raw.length; r++) {
        const rawRow = raw[r];
        if (!rawRow || rawRow.every(c => c === '' || c == null)) continue;
        const row = {};
        raw[headerRow].forEach((h, i) => {
          if (h && String(h).trim()) row[String(h).trim()] = rawRow[i] ?? '';
        });
        rows.push(row);
      }

      const columnTypes = inferColumnTypes(headers, rows.slice(0, 20));
      const durationCol = headers.find(h => /duration/i.test(h));
      if (durationCol) {
        const typeInfo = Object.entries(columnTypes).map(([k, v]) => `${k}:${v.type}`).join(', ');
        console.log(`    [${sheetName}] types: ${typeInfo}`);
        const normRows = rows.slice(0, 5).map(r => normalizeRow(r, columnTypes));
        const durSamples = normRows.map(n => n[durationCol]?.value).filter(v => v != null);
        const flagged = durSamples.filter(v => v > 30);
        console.log(`    Duration (min): ${durSamples.map(v => v.toFixed(1)).join(', ')}`);
        console.log(`    Above 30min: ${flagged.length}/${durSamples.length}`);
      }
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
