import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const sql = getDb();
    const trips = await sql`SELECT * FROM trips ORDER BY uploaded_at DESC`;
    return NextResponse.json(trips);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, original_filename, file_type, column_headers, rows } = await request.json();

    if (!name || !rows || rows.length === 0) {
      return NextResponse.json({ error: 'name and rows are required' }, { status: 400 });
    }

    const sql = getDb();
    
    // Postgres JSONB doesn't support \u0000 characters, so we must sanitize them.
    const sanitizeJson = (val) => JSON.stringify(val).replace(/\\u0000/g, '');

    const headersJson = sanitizeJson(column_headers || []);

    const tripResult = await sql`
      INSERT INTO trips (name, original_filename, file_type, column_headers, total_rows, status)
      VALUES (${name}, ${original_filename || name}, ${file_type || 'xlsx'}, ${headersJson}::jsonb, ${rows.length}, 'pending')
      RETURNING *
    `;

    const trip = tripResult[0];

    // Insert rows one by one (neon serverless doesn't support multi-value inserts in tagged template)
    for (let i = 0; i < rows.length; i++) {
      const rowJson = sanitizeJson(rows[i]);
      await sql`
        INSERT INTO trip_rows (trip_id, row_index, row_data, is_flagged, flag_details, status)
        VALUES (${trip.id}, ${i}, ${rowJson}::jsonb, false, '[]'::jsonb, 'pending')
      `;
    }

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error('Trips POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
