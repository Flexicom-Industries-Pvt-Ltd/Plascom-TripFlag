import { canParseFleetEdgePdf, parseFleetEdgePdf } from './fleet-edge-pdf.js';

export const FORMAT_PROFILES = {
  fleet_edge_pdf: {
    id: 'fleet_edge_pdf',
    name: 'Fleet Edge Trip Movement Log',
    fileTypes: ['pdf'],
  },
  gps_vehicles_report: {
    id: 'gps_vehicles_report',
    name: 'GPS Vehicles Report',
    fileTypes: ['xlsx', 'xls', 'csv'],
    sheetPatterns: [/vehicles?\s*report/i],
  },
  gps_movement_details: {
    id: 'gps_movement_details',
    name: 'GPS Movement Details',
    fileTypes: ['xlsx', 'xls'],
    sheetPatterns: [/movement\s*details/i],
  },
  generic_spreadsheet: {
    id: 'generic_spreadsheet',
    name: 'Generic Spreadsheet',
    fileTypes: ['xlsx', 'xls', 'csv'],
  },
  generic_pdf: {
    id: 'generic_pdf',
    name: 'Generic PDF',
    fileTypes: ['pdf'],
  },
};

/**
 * Detect PDF format and parse with the best adapter.
 * Returns { headers, rows, formatProfile } or null if no adapter matches.
 */
export function parsePdfWithAdapters(text) {
  if (canParseFleetEdgePdf(text)) {
    const result = parseFleetEdgePdf(text);
    if (result) return result;
  }
  return null;
}

/**
 * Detect spreadsheet format profile from sheet name and headers.
 */
export function detectSpreadsheetProfile(sheetName, headers = []) {
  const name = sheetName || '';
  const headerStr = headers.join(' ').toLowerCase();

  if (/movement\s*details/i.test(name)) return 'gps_movement_details';
  if (/vehicles?\s*report/i.test(name)) return 'gps_vehicles_report';
  if (/event\s*report/i.test(name)) return 'gps_movement_details';

  if (headerStr.includes('vehicle no') && headerStr.includes('duration')) {
    return 'gps_vehicles_report';
  }
  if (headerStr.includes('duration') && headerStr.includes('hh:mm:ss')) {
    return 'gps_movement_details';
  }

  return 'generic_spreadsheet';
}

export { parseFleetEdgePdf, canParseFleetEdgePdf };
