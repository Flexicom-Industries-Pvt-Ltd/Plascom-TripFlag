import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const method = searchParams.get('method') || null;
  const status = searchParams.get('status') ? parseInt(searchParams.get('status')) : null;
  const search = searchParams.get('search') || null;
  
  const offset = (page - 1) * limit;

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const logs = await sql`
      SELECT id, timestamp, method, url, response_status, response_time_ms, request_headers, request_body, response_body
      FROM api_logs
      WHERE 
        (${method}::text IS NULL OR method = ${method})
        AND (${status}::int IS NULL OR response_status = ${status})
        AND (${search}::text IS NULL OR url ILIKE ${'%' + search + '%'})
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total 
      FROM api_logs
      WHERE 
        (${method}::text IS NULL OR method = ${method})
        AND (${status}::int IS NULL OR response_status = ${status})
        AND (${search}::text IS NULL OR url ILIKE ${'%' + search + '%'})
    `;
    const total = parseInt(countResult[0].total);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
