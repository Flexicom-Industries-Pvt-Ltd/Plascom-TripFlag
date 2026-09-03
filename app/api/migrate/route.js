import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


async function _GET() {
  try {
    const sql = getDb();
    // Phase 1
    await sql`ALTER TABLE flagging_rules ADD COLUMN IF NOT EXISTS unit TEXT`;
    await sql`ALTER TABLE flagging_rules ADD COLUMN IF NOT EXISTS field_type TEXT`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS column_types JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE trip_rows ADD COLUMN IF NOT EXISTS normalized_data JSONB DEFAULT '{}'`;
    // Phase 2
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS field_map JSONB DEFAULT '{}'`;
    await sql`ALTER TABLE flagging_rules ADD COLUMN IF NOT EXISTS semantic_field TEXT`;
    // Phase 3
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS source_sheet TEXT`;
    await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS format_profile TEXT`;
    return NextResponse.json({ success: true, message: 'Phase 1 + 2 + 3 schema migration applied' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const GET = withLogging(_GET);
