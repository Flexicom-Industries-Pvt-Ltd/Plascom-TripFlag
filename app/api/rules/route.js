import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET all rules
export async function GET() {
  try {
    const sql = getDb();
    const rules = await sql`SELECT * FROM flagging_rules ORDER BY created_at DESC`;
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create a new rule
export async function POST(request) {
  try {
    const body = await request.json();
    const { field_name, operator, value, value_end, severity, label, is_active } = body;

    if (!field_name || !operator) {
      return NextResponse.json({ error: 'field_name and operator are required' }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      INSERT INTO flagging_rules (field_name, operator, value, value_end, severity, label, is_active)
      VALUES (${field_name}, ${operator}, ${value || ''}, ${value_end || null}, ${severity || 'warning'}, ${label || null}, ${is_active !== false})
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE a rule by id (passed as query param)
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const sql = getDb();
    await sql`DELETE FROM flagging_rules WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH toggle a rule
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const sql = getDb();
    const result = await sql`
      UPDATE flagging_rules SET is_active = ${is_active} WHERE id = ${id} RETURNING *
    `;
    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
