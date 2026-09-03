import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { validateRule, normalizeRulePayload } from '@/lib/rule-schema';


async function _GET() {
  try {
    const sql = getDb();
    const rules = await sql`SELECT * FROM flagging_rules ORDER BY created_at DESC`;
    return NextResponse.json(rules);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function _POST(request) {
  try {
    const body = await request.json();
    const normalized = normalizeRulePayload(body);

    const validation = validateRule(normalized);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('. ') }, { status: 422 });
    }

    const sql = getDb();
    const result = await sql`
      INSERT INTO flagging_rules (field_name, semantic_field, field_type, operator, value, value_end, unit, severity, label, is_active)
      VALUES (
        ${normalized.field_name}, ${normalized.semantic_field}, ${normalized.field_type},
        ${normalized.operator}, ${normalized.value}, ${normalized.value_end},
        ${normalized.unit}, ${normalized.severity}, ${normalized.label}, ${normalized.is_active}
      )
      RETURNING *
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function _DELETE(request) {
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

async function _PATCH(request) {
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

async function _PUT(request) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const normalized = normalizeRulePayload(body);
    const validation = validateRule(normalized);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('. ') }, { status: 422 });
    }

    const sql = getDb();
    const result = await sql`
      UPDATE flagging_rules 
      SET 
        field_name = ${normalized.field_name}, 
        semantic_field = ${normalized.semantic_field},
        field_type = ${normalized.field_type},
        operator = ${normalized.operator}, 
        value = ${normalized.value}, 
        value_end = ${normalized.value_end}, 
        unit = ${normalized.unit}, 
        severity = ${normalized.severity}, 
        label = ${normalized.label}
      WHERE id = ${body.id} 
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const GET = withLogging(_GET);
export const POST = withLogging(_POST);
export const DELETE = withLogging(_DELETE);
export const PATCH = withLogging(_PATCH);
export const PUT = withLogging(_PUT);
