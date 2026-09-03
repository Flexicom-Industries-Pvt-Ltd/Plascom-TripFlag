import { getDb } from '@/lib/db';
import { runFlagging } from '@/lib/flagger';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { inferColumnTypes } from '@/lib/column-inference';
import { buildFieldMap } from '@/lib/field-ontology';
import { normalizeRow } from '@/lib/normalizers/index';


async function _POST(request) {
  try {
    const { trip_id } = await request.json();

    if (!trip_id) {
      return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
    }

    const sql = getDb();

    const tripResult = await sql`SELECT * FROM trips WHERE id = ${trip_id}`;
    if (tripResult.length === 0) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    const trip = tripResult[0];

    const rows = await sql`SELECT * FROM trip_rows WHERE trip_id = ${trip_id} ORDER BY row_index`;
    const rules = await sql`SELECT * FROM flagging_rules WHERE is_active = true`;

    if (rules.length === 0) {
      return NextResponse.json({
        trip_id,
        total_rows: rows.length,
        flagged_rows: 0,
        message: 'No active rules defined',
      });
    }

    const columnHeaders = trip.column_headers || [];
    let columnTypes = trip.column_types || {};
    let fieldMap = trip.field_map || {};

    const rowsData = rows.map(r => r.row_data);
    const needsBackfill = !columnTypes || Object.keys(columnTypes).length === 0
      || !fieldMap || Object.keys(fieldMap).length === 0;

    if (needsBackfill) {
      columnTypes = inferColumnTypes(columnHeaders, rowsData.slice(0, 20));
      ({ fieldMap } = buildFieldMap(columnHeaders, columnTypes));
      const typesJson = JSON.stringify(columnTypes).replace(/\\u0000/g, '');
      const mapJson = JSON.stringify(fieldMap).replace(/\\u0000/g, '');
      await sql`UPDATE trips SET column_types = ${typesJson}::jsonb, field_map = ${mapJson}::jsonb WHERE id = ${trip_id}`;
    }

    const normalizedRows = rows.map((row) => {
      const stored = row.normalized_data;
      if (stored && Object.keys(stored).length > 0 && stored._semantic) return stored;
      return normalizeRow(row.row_data, columnTypes, fieldMap);
    });

    const flaggedData = runFlagging(rowsData, rules, columnHeaders, columnTypes, normalizedRows, fieldMap);

    let flaggedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const flags = flaggedData[i]?.flags || [];
      const isFlagged = flags.length > 0;
      if (isFlagged) flaggedCount++;

      const flagsJson = JSON.stringify(flags).replace(/\\u0000/g, '');
      const normalizedJson = JSON.stringify(normalizedRows[i]).replace(/\\u0000/g, '');

      await sql`
        UPDATE trip_rows 
        SET is_flagged = ${isFlagged},
            flag_details = ${flagsJson}::jsonb,
            normalized_data = ${normalizedJson}::jsonb
        WHERE id = ${rows[i].id}
      `;
    }

    await sql`UPDATE trips SET flagged_rows = ${flaggedCount} WHERE id = ${trip_id}`;

    return NextResponse.json({
      trip_id,
      total_rows: rows.length,
      flagged_rows: flaggedCount,
      rules_applied: rules.length,
      field_map: fieldMap,
    });
  } catch (error) {
    console.error('Flag error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
