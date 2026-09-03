import { parseNaturalLanguageRule } from '@/lib/groq';
import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { validateRule, normalizeRulePayload } from '@/lib/rule-schema';


async function _POST(request) {
  try {
    const { message } = await request.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await parseNaturalLanguageRule(message);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Could not understand the rule. Please try rephrasing.', detail: result.error },
        { status: 422 }
      );
    }

    const normalized = normalizeRulePayload(result.rule);
    const validation = validateRule(normalized);

    if (!validation.valid) {
      return NextResponse.json(
        { error: `Rule parsed but invalid: ${validation.errors.join('. ')}`, detail: validation.errors },
        { status: 422 }
      );
    }

    const sql = getDb();
    const saved = await sql`
      INSERT INTO flagging_rules (field_name, semantic_field, field_type, operator, value, value_end, unit, severity, label, is_active)
      VALUES (
        ${normalized.field_name}, ${normalized.semantic_field}, ${normalized.field_type},
        ${normalized.operator}, ${normalized.value}, ${normalized.value_end},
        ${normalized.unit}, ${normalized.severity}, ${normalized.label}, true
      )
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `✅ Rule created: ${normalized.label}`,
      rule: saved[0],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
