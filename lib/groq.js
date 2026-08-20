import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a rule parser for a truck trip data flagging system. 
Users describe flagging rules in natural language. Convert them into a structured JSON rule.

Output ONLY valid JSON with these fields:
{
  "field_name": "the column/field name to check (use common sense names like 'fuel', 'distance', 'driver_name', 'status', 'date', etc.)",
  "operator": "one of: equals, not_equals, contains, not_contains, gt, lt, gte, lte, between, is_empty, is_not_empty",
  "value": "the value to compare against (use empty string for is_empty/is_not_empty)",
  "value_end": "only for 'between' operator, otherwise null",
  "unit": "the unit of measurement if specified (e.g., 'kg', 'km', 'liters', 'km/l'), otherwise null",
  "severity": "warning or critical (use critical for dangerous/urgent flags, warning for others)",
  "label": "a short human-readable description of the rule"
}

Examples:
- "flag if fuel is above 50 liters" → {"field_name": "fuel", "operator": "gt", "value": "50", "value_end": null, "unit": "liters", "severity": "warning", "label": "Fuel above 50 liters"}
- "mark trips where driver name is missing" → {"field_name": "driver_name", "operator": "is_empty", "value": "", "value_end": null, "unit": null, "severity": "critical", "label": "Driver name is missing"}
- "highlight if distance is between 100 and 500 km" → {"field_name": "distance", "operator": "between", "value": "100", "value_end": "500", "unit": "km", "severity": "warning", "label": "Distance between 100 and 500 km"}

Output ONLY the JSON object, nothing else. No markdown, no explanation.`;

export async function parseNaturalLanguageRule(userMessage) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from Groq');

    // Try to extract JSON from the response
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const rule = JSON.parse(jsonStr);

    // Validate required fields
    if (!rule.field_name || !rule.operator) {
      throw new Error('Missing required fields in parsed rule');
    }

    // Ensure defaults
    rule.value = rule.value ?? '';
    rule.severity = rule.severity || 'warning';
    rule.label = rule.label || `${rule.field_name} ${rule.operator} ${rule.value}`;

    return { success: true, rule };
  } catch (error) {
    console.error('Groq Parse Error:', error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function smartMatchColumns(ruleFieldName, columnHeaders) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        {
          role: 'system',
          content: 'You match rule field names to actual column headers. Return ONLY the best matching column header from the list, or "NONE" if no match. No explanation.',
        },
        {
          role: 'user',
          content: `Rule field: "${ruleFieldName}"\nAvailable columns: ${JSON.stringify(columnHeaders)}\n\nBest match:`,
        },
      ],
      temperature: 0,
      max_tokens: 100,
    });

    const match = completion.choices[0]?.message?.content?.trim();
    if (match && match !== 'NONE' && columnHeaders.includes(match)) {
      return match;
    }
    return null;
  } catch {
    return null;
  }
}
