/**
 * Shared spreadsheet parsing utilities (works with 2D raw grids from XLSX).
 */

export function findHeaderRow(rawRows, maxScan = 20) {
  for (let r = 0; r < Math.min(maxScan, rawRows.length); r++) {
    const row = rawRows[r];
    if (!row) continue;
    const nonEmpty = row.filter(c => c !== '' && c != null && String(c).trim() !== '');
    if (nonEmpty.length >= 3) return r;
  }
  return 0;
}

export function extractHeaders(rawRows, headerRowIndex) {
  const headerRowData = rawRows[headerRowIndex] || [];
  const columns = [];

  for (let i = 0; i < headerRowData.length; i++) {
    const val = headerRowData[i];
    const str = val != null ? String(val).trim() : '';
    if (str && !str.includes('__EMPTY')) {
      columns.push({ index: i, name: str });
    }
  }

  return columns;
}

export function extractSheetPreview(rawRows, sheetName = '') {
  if (!rawRows || rawRows.length === 0) {
    return {
      name: sheetName,
      headerRow: 0,
      headers: [],
      rowCount: 0,
      dataRowCount: 0,
      hasDuration: false,
      hasDistance: false,
      hasStatus: false,
      sampleRows: [],
    };
  }

  const headerRow = findHeaderRow(rawRows);
  const columns = extractHeaders(rawRows, headerRow);
  const headers = columns.map(c => c.name);

  let dataRowCount = 0;
  const sampleRows = [];

  for (let r = headerRow + 1; r < rawRows.length; r++) {
    const rawRow = rawRows[r];
    if (!rawRow || rawRow.every(c => c === '' || c == null)) continue;
    dataRowCount++;

    if (sampleRows.length < 5) {
      const row = {};
      for (const col of columns) {
        let val = rawRow[col.index] ?? '';
        if (val instanceof Date) val = val.toISOString().split('T')[0];
        row[col.name] = val;
      }
      sampleRows.push(row);
    }
  }

  const headerLower = headers.map(h => h.toLowerCase()).join(' ');

  return {
    name: sheetName,
    headerRow,
    headers,
    rowCount: rawRows.length,
    dataRowCount,
    hasDuration: /duration/i.test(headerLower),
    hasDistance: /distance|(^|\s)km(\s|$)|travelled|covered/i.test(headerLower),
    hasStatus: /status/i.test(headerLower),
    sampleRows,
  };
}

/**
 * Score a sheet for trip-data suitability (higher = better for flagging).
 */
export function scoreSheetForTripData(preview) {
  let score = 0;

  if (preview.hasDuration) score += 30;
  if (preview.hasDistance) score += 20;
  if (preview.hasStatus) score += 15;
  score += Math.min(preview.dataRowCount, 50);

  const name = (preview.name || '').toLowerCase();
  if (/movement|vehicle|event|trip/i.test(name)) score += 10;
  if (/trace/i.test(name) && !preview.hasDuration) score -= 25;
  if (preview.dataRowCount === 0) score -= 100;

  return score;
}

/**
 * Extract structured rows from a raw 2D grid using AI-detected or default structure.
 */
export function extractRowsFromGrid(rawRows, structure = null) {
  const headerRowIndex = structure?.header_row_index ?? findHeaderRow(rawRows);
  const dataStartRow = structure?.data_start_row ?? headerRowIndex + 1;

  const columns = extractHeaders(rawRows, headerRowIndex);
  if (columns.length === 0) return { columnHeaders: [], rows: [] };

  const columnHeaders = columns.map(c => c.name);
  const rows = [];

  for (let i = dataStartRow; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    if (!rawRow || rawRow.every(c => c === '' || c == null)) continue;

    const cleanRow = {};
    for (const col of columns) {
      let val = rawRow[col.index] ?? '';
      if (val instanceof Date) val = val.toISOString().split('T')[0];
      cleanRow[col.name] = val;
    }
    rows.push(cleanRow);
  }

  return { columnHeaders, rows };
}

/**
 * Pick the best sheet from a list of previews.
 */
export function recommendSheet(sheetPreviews) {
  if (!sheetPreviews || sheetPreviews.length === 0) return null;
  if (sheetPreviews.length === 1) return sheetPreviews[0].name;

  let best = sheetPreviews[0];
  let bestScore = scoreSheetForTripData(best);

  for (let i = 1; i < sheetPreviews.length; i++) {
    const score = scoreSheetForTripData(sheetPreviews[i]);
    if (score > bestScore) {
      bestScore = score;
      best = sheetPreviews[i];
    }
  }

  return best.name;
}
