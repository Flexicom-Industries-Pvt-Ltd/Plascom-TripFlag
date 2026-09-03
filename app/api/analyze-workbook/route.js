import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { scoreSheetForTripData, recommendSheet } from '@/lib/spreadsheet-parser';
import { detectSpreadsheetProfile } from '@/lib/format-adapters/registry';


async function _POST(request) {
  try {
    const { sheets } = await request.json();

    if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
      return NextResponse.json({ error: 'sheets array is required' }, { status: 400 });
    }

    const analyzed = sheets.map((sheet) => {
      const preview = {
        name: sheet.name,
        headers: sheet.headers || [],
        rowCount: sheet.rowCount || 0,
        dataRowCount: sheet.dataRowCount || 0,
        hasDuration: sheet.hasDuration || false,
        hasDistance: sheet.hasDistance || false,
        hasStatus: sheet.hasStatus || false,
        sampleRows: sheet.sampleRows || [],
      };

      return {
        name: preview.name,
        rowCount: preview.dataRowCount,
        headers: preview.headers.slice(0, 8),
        hasDuration: preview.hasDuration,
        hasDistance: preview.hasDistance,
        hasStatus: preview.hasStatus,
        score: scoreSheetForTripData(preview),
        formatProfile: detectSpreadsheetProfile(preview.name, preview.headers),
        recommended: false,
      };
    });

    const recommendedName = recommendSheet(sheets.map(s => ({
      name: s.name,
      dataRowCount: s.dataRowCount || 0,
      hasDuration: s.hasDuration,
      hasDistance: s.hasDistance,
      hasStatus: s.hasStatus,
    })));

    for (const sheet of analyzed) {
      sheet.recommended = sheet.name === recommendedName;
    }

    analyzed.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      sheets: analyzed,
      recommended: recommendedName,
    });
  } catch (error) {
    console.error('Analyze workbook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
