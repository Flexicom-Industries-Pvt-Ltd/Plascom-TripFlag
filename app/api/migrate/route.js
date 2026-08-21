import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


async function _GET() {
  try {
    const sql = getDb();
    await sql`ALTER TABLE flagging_rules ADD COLUMN IF NOT EXISTS unit TEXT;`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const GET = withLogging(_GET);
