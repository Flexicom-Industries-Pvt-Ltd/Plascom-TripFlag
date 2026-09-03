import { listFieldsForUI } from '@/lib/rule-schema';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


async function _GET() {
  return NextResponse.json({
    fields: listFieldsForUI(),
  });
}


export const GET = withLogging(_GET);
