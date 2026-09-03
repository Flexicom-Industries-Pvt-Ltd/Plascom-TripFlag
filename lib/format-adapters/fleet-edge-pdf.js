/**
 * Deterministic parser for Fleet Edge "Trip Movement Log" PDFs.
 * Handles duration formats: 24m 54s, 1h 8m, 36m, 6h 33m 40s, 46s
 */

const HEADERS = [
  'Date',
  'Status',
  'Duration',
  'Start Time',
  'End Time',
  'Start Location',
  'End Location',
  'Distance Covered (km)',
];

const ROW_START_RE = /(\d{2}-\d{2}-\d{4})\s+(moving|idling|stopped)\s+/gi;

export function canParseFleetEdgePdf(text) {
  return /trip\s*movement\s*log/i.test(text) && /trips\s*log/i.test(text);
}

export function parseFleetEdgePdf(text) {
  if (!canParseFleetEdgePdf(text)) return null;

  const matches = [...text.matchAll(ROW_START_RE)];
  if (matches.length === 0) return null;

  const rows = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? text.length;
    const chunk = text.slice(start, end).trim();

    const parsed = parseRowChunk(chunk);
    if (parsed) rows.push(parsed);
  }

  if (rows.length === 0) return null;

  return {
    headers: HEADERS,
    rows,
    formatProfile: 'fleet_edge_pdf',
  };
}

function parseRowChunk(chunk) {
  const m = chunk.match(
    /^(\d{2}-\d{2}-\d{4})\s+(moving|idling|stopped)\s+([\dhms\s]+?)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(\d{1,2}:\d{2}\s*[AP]M)\s+([\s\S]+)$/i
  );
  if (!m) return null;

  let remainder = m[6].trim();
  const distMatch = remainder.match(/(\d+(?:\.\d+)?)\s*$/);
  const distance = distMatch ? distMatch[1] : '';
  if (distMatch) remainder = remainder.slice(0, distMatch.index).trim();

  const { startLocation, endLocation } = splitLocations(remainder);

  return {
    Date: m[1],
    Status: m[2].toLowerCase(),
    Duration: m[3].trim(),
    'Start Time': m[4].trim(),
    'End Time': m[5].trim(),
    'Start Location': startLocation,
    'End Location': endLocation,
    'Distance Covered (km)': distance,
  };
}

function splitLocations(remainder) {
  // Locations end with Pin-XXXXX (India) — use as delimiter between start/end
  const pinMarker = /Pin-\d{6}\s*\(India\)/gi;
  const markers = [...remainder.matchAll(pinMarker)];

  if (markers.length >= 2) {
    const firstEnd = markers[0].index + markers[0][0].length;
    const startLocation = remainder.slice(0, firstEnd).trim();
    const endLocation = remainder.slice(firstEnd).trim();
    return { startLocation, endLocation };
  }

  if (markers.length === 1) {
    const end = markers[0].index + markers[0][0].length;
    const before = remainder.slice(0, end).trim();
    const after = remainder.slice(end).trim();
    if (after.length > 20) return { startLocation: before, endLocation: after };
    return { startLocation: before, endLocation: '' };
  }

  return { startLocation: remainder, endLocation: '' };
}
