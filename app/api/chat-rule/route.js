import { parseNaturalLanguageRule } from '@/lib/groq';
import { getDb } from '@/lib/db';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


// POST: Parse natural language into a rule and save it
async function _POST(request) {
  try {
    const { message } = await request.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Parse with Groq
    const result = await parseNaturalLanguageRule(message);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Could not understand the rule. Please try rephrasing.', detail: result.error },
        { status: 422 }
      );
    }

    const rule = result.rule;

    // Save to database
    const sql = getDb();
    const saved = await sql`
      INSERT INTO flagging_rules (field_name, operator, value, value_end, unit, severity, label, is_active)
      VALUES (${rule.field_name}, ${rule.operator}, ${rule.value || ''}, ${rule.value_end || null}, ${rule.unit || null}, ${rule.severity || 'warning'}, ${rule.label || null}, true)
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      message: `✅ Rule created: Flag when "${rule.field_name}" ${rule.operator} "${rule.value}"`,
      rule: saved[0],
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
