import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  
  const model = searchParams.get('model') || null;
  const offset = (page - 1) * limit;

  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const logs = await sql`
      SELECT id, timestamp, model, prompt_tokens, completion_tokens, total_tokens, latency_ms, messages_payload, response_payload
      FROM ai_logs
      WHERE 
        (${model}::text IS NULL OR model = ${model})
      ORDER BY timestamp DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await sql`
      SELECT COUNT(*) as total 
      FROM ai_logs
      WHERE 
        (${model}::text IS NULL OR model = ${model})
    `;
    const total = parseInt(countResult[0].total);

    return NextResponse.json({ logs, total, page, limit });
  } catch (error) {
    console.error("Failed to fetch ai logs:", error);
    return NextResponse.json({ error: "Failed to fetch ai logs" }, { status: 500 });
  }
}
