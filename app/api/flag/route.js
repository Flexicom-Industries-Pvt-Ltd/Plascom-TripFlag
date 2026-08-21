import { getDb } from '@/lib/db';
import { runFlagging } from '@/lib/flagger';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


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
    const rowsData = rows.map(r => r.row_data);
    const flaggedData = runFlagging(rowsData, rules, columnHeaders);

    let flaggedCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const flags = flaggedData[i]?.flags || [];
      const isFlagged = flags.length > 0;
      if (isFlagged) flaggedCount++;

      const flagsJson = JSON.stringify(flags).replace(/\\u0000/g, '');
      await sql`
        UPDATE trip_rows 
        SET is_flagged = ${isFlagged}, flag_details = ${flagsJson}::jsonb
        WHERE id = ${rows[i].id}
      `;
    }

    await sql`UPDATE trips SET flagged_rows = ${flaggedCount} WHERE id = ${trip_id}`;

    return NextResponse.json({
      trip_id,
      total_rows: rows.length,
      flagged_rows: flaggedCount,
      rules_applied: rules.length,
    });
  } catch (error) {
    console.error('Flag error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
