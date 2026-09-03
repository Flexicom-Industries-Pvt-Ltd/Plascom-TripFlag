/**
 * Phase 3 verification — sheet picker logic + Fleet Edge PDF adapter
 * Run: node scripts/test-phase3.mjs
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { parseFleetEdgePdf, canParseFleetEdgePdf } from '../lib/format-adapters/fleet-edge-pdf.js';
import { parsePdfWithAdapters, detectSpreadsheetProfile } from '../lib/format-adapters/registry.js';
import { extractSheetPreview, scoreSheetForTripData, recommendSheet } from '../lib/spreadsheet-parser.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓', label); }
  else { failed++; console.log('  ✗', label); }
}

console.log('\n=== Fleet Edge PDF Adapter ===');
const pdfPath = path.resolve('../Formats/FLEET EDGE REPORT.pdf');
if (fs.existsSync(pdfPath)) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map(x => x.str).join(' ') + '\n';
  }

  assert(canParseFleetEdgePdf(text), 'Detects Fleet Edge format');
  const parsed = parseFleetEdgePdf(text);
  assert(parsed && parsed.rows.length >= 5, `Parsed ${parsed?.rows?.length} rows`);
  assert(parsed.headers.includes('Duration'), 'Has Duration column');
  assert(parsed.rows[0].Duration, `First row duration: ${parsed.rows[0].Duration}`);
  assert(parsed.rows.some(r => r.Duration.includes('m')), 'Duration values contain m/s/h format');

  const viaRegistry = parsePdfWithAdapters(text);
  assert(viaRegistry?.formatProfile === 'fleet_edge_pdf', 'Registry returns fleet_edge_pdf profile');
} else {
  console.log('  (skipped — PDF sample not found)');
}

console.log('\n=== Multi-Sheet Recommendation ===');
const xlsxPath = path.resolve('../Formats/GPS Report WB23M 7867 29.08.2026 (2).xlsx');
if (fs.existsSync(xlsxPath)) {
  const wb = XLSX.readFile(xlsxPath);
  const previews = wb.SheetNames.map(name => {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    return extractSheetPreview(raw, name);
  });

  assert(previews.length === 3, 'WB23M file has 3 sheets');

  const trace = previews.find(p => p.name === 'Trace Report');
  const movement = previews.find(p => p.name === 'Movement Details');
  assert(trace && !trace.hasDuration, 'Trace Report has no Duration');
  assert(movement && movement.hasDuration, 'Movement Details has Duration');

  const traceScore = scoreSheetForTripData(trace);
  const movementScore = scoreSheetForTripData(movement);
  assert(movementScore > traceScore, `Movement (${movementScore}) scores higher than Trace (${traceScore})`);

  const recommended = recommendSheet(previews);
  assert(recommended === 'Movement Details', `Recommended sheet: ${recommended}`);
  assert(detectSpreadsheetProfile('Movement Details', movement.headers) === 'gps_movement_details', 'Detects movement profile');
} else {
  console.log('  (skipped — WB23M sample not found)');
}

console.log('\n=== Single-Sheet Auto-Select ===');
const singlePath = path.resolve('../Formats/GPS Report WB11F 9367 29.08.2026.xlsx');
if (fs.existsSync(singlePath)) {
  const wb = XLSX.readFile(singlePath);
  const previews = wb.SheetNames.map(name => {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    return extractSheetPreview(raw, name);
  });
  assert(previews.length === 1, 'Single sheet file');
  assert(recommendSheet(previews) === 'Vehicles Report', 'Auto-selects only sheet');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
