import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { inferColumnTypes } from '@/lib/column-inference';
import { buildFieldMap } from '@/lib/field-ontology';
import { normalizeRow } from '@/lib/normalizers/index';


async function _GET() {
  try {
    const sql = getDb();
    const trips = await sql`SELECT * FROM trips ORDER BY uploaded_at DESC`;
    return NextResponse.json(trips);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const { name, original_filename, file_type, column_headers, rows, source_sheet, format_profile } = await request.json();

    if (!name || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'name and rows are required' }, { status: 400 });
    }

    const sql = getDb();
    const sanitizeJson = (val) => JSON.stringify(val).replace(/\\u0000/g, '');

    const headers = column_headers || [];
    const columnTypes = inferColumnTypes(headers, rows.slice(0, 20));
    const { fieldMap } = buildFieldMap(headers, columnTypes);

    const columnTypesJson = sanitizeJson(columnTypes);
    const fieldMapJson = sanitizeJson(fieldMap);
    const headersJson = sanitizeJson(headers);

    const tripResult = await sql`
      INSERT INTO trips (name, original_filename, file_type, column_headers, column_types, field_map, source_sheet, format_profile, total_rows, status)
      VALUES (
        ${name}, ${original_filename || name}, ${file_type || 'xlsx'},
        ${headersJson}::jsonb, ${columnTypesJson}::jsonb, ${fieldMapJson}::jsonb,
        ${source_sheet || null}, ${format_profile || null},
        ${rows.length}, 'pending'
      )
      RETURNING *
    `;

    const trip = tripResult[0];

    for (let i = 0; i < rows.length; i++) {
      const rowJson = sanitizeJson(rows[i]);
      const normalized = normalizeRow(rows[i], columnTypes, fieldMap);
      const normalizedJson = sanitizeJson(normalized);

      await sql`
        INSERT INTO trip_rows (trip_id, row_index, row_data, normalized_data, is_flagged, flag_details, status)
        VALUES (${trip.id}, ${i}, ${rowJson}::jsonb, ${normalizedJson}::jsonb, false, '[]'::jsonb, 'pending')
      `;
    }

    return NextResponse.json({ ...trip, field_map: fieldMap }, { status: 201 });
  } catch (error) {
    console.error('Trips POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const GET = withLogging(_GET);
export const POST = withLogging(_POST);
