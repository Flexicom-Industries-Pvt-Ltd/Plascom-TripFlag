import Groq from 'groq-sdk';
import { getDb } from './db';
import { resolveSemanticField } from './field-ontology';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function logAIUsage(data) {
  const sql = getDb();
  try {
    await sql`
      INSERT INTO ai_logs (
        model, prompt_tokens, completion_tokens, total_tokens,
        messages_payload, response_payload, latency_ms
      ) VALUES (
        ${data.model}, ${data.prompt_tokens}, ${data.completion_tokens}, ${data.total_tokens},
        ${JSON.stringify(data.messages)}, ${JSON.stringify(data.response)}, ${data.latency_ms}
      )
    `;
    if (Math.random() < 0.01) {
      await sql`DELETE FROM ai_logs WHERE created_at < NOW() - INTERVAL '30 days'`;
    }
  } catch (e) {
    console.error("Failed to log AI usage:", e);
  }
}

const SYSTEM_PROMPT = `You are a rule parser for a truck trip data flagging system. 
Users describe flagging rules in natural language. Convert them into a structured JSON rule.

CRITICAL RULES FOR UNITS AND VALUES:
1. NEVER assign a "unit" if there is no numeric "value" extracted. (e.g. "flag if weight is kg" is INVALID because there is no number. "value" must be a number if a unit is present).
2. If the user mentions a unit but no value, or the rule doesn't make logical mathematical sense, do not extract it.
3. Use common sense field names like 'fuel', 'distance', 'driver_name', 'status', 'date', 'weight', etc.

Output ONLY valid JSON with these fields:
{
  "field_name": "human-readable field label (e.g. 'Distance', 'Duration')",
  "semantic_field": "canonical semantic key (e.g. 'distance', 'duration', 'status', 'speed')",
  "field_type": "one of: duration, distance, speed, datetime, enum, boolean, number, coordinate, text",
  "operator": "one of: equals, not_equals, contains, not_contains, gt, lt, gte, lte, between, is_empty, is_not_empty",
  "value": "the numeric or string value to compare against (use empty string for is_empty/is_not_empty)",
  "value_end": "only for 'between' operator, otherwise null",
  "unit": "the unit of measurement if specified alongside a number (e.g., 'minutes', 'km', 'km/h', 'liters'), otherwise null",
  "severity": "warning or critical (use critical for dangerous/urgent flags, warning for others)",
  "label": "a short human-readable description of the rule"
}

IMPORTANT: Always set semantic_field to the canonical key. Rules work across all file formats via semantic mapping.
Canonical semantic_field keys: duration, distance, speed, status, start_time, end_time, vehicle_no, from_location, to_location, location, latitude, longitude, odometer, ignition, limit, fuel, driver_name, weight

Field type guide:
- duration: time spans (minutes, hours) — use unit "minutes" or "hours"
- distance: km, miles — use unit "km"
- speed: km/h, mph — use unit "km/h"
- datetime: dates and times
- enum: status values (STOPPAGE, DRIVING, Idling, moving)
- boolean: yes/no, on/off fields
- number: plain numeric (odometer, limit)
- coordinate: latitude, longitude
- text: locations, names, free text

Examples:
- "flag if duration is above 30 minutes" → {"field_name": "Duration", "semantic_field": "duration", "field_type": "duration", "operator": "gt", "value": "30", "value_end": null, "unit": "minutes", "severity": "warning", "label": "Duration above 30 minutes"}
- "flag if distance is above 50 km" → {"field_name": "Distance", "semantic_field": "distance", "field_type": "distance", "operator": "gt", "value": "50", "value_end": null, "unit": "km", "severity": "warning", "label": "Distance above 50 km"}
- "flag if fuel is above 50 liters" → {"field_name": "Fuel", "semantic_field": "fuel", "field_type": "number", "operator": "gt", "value": "50", "value_end": null, "unit": "liters", "severity": "warning", "label": "Fuel above 50 liters"}
- "mark trips where driver name is missing" → {"field_name": "Driver Name", "semantic_field": "driver_name", "field_type": "text", "operator": "is_empty", "value": "", "value_end": null, "unit": null, "severity": "critical", "label": "Driver name is missing"}
- "highlight if distance is between 100 and 500 km" → {"field_name": "Distance", "semantic_field": "distance", "field_type": "distance", "operator": "between", "value": "100", "value_end": "500", "unit": "km", "severity": "warning", "label": "Distance between 100 and 500 km"}
- "flag STOPPAGE status" → {"field_name": "Status", "semantic_field": "status", "field_type": "enum", "operator": "equals", "value": "STOPPAGE", "value_end": null, "unit": null, "severity": "warning", "label": "Vehicle stopped"}

Output ONLY the JSON object, nothing else. No markdown, no explanation.`;

export async function parseNaturalLanguageRule(userMessage) {
  const startTime = Date.now();
  const modelName = 'openai/gpt-oss-120b'; // using generic name to log
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0.1,
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const latency_ms = Date.now() - startTime;
    const text = completion.choices[0]?.message?.content?.trim();
    
    // Log async
    logAIUsage({
      model: modelName,
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
      messages: messages,
      response: { text },
      latency_ms
    }).catch(() => {});

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
    if (!rule.semantic_field) {
      rule.semantic_field = resolveSemanticField(rule.field_name);
    }

    return { success: true, rule };
  } catch (error) {
    console.error('Groq Parse Error:', error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function smartMatchColumns(ruleFieldName, columnHeaders) {
  const startTime = Date.now();
  const modelName = 'openai/gpt-oss-120b';
  const messages = [
    {
      role: 'system',
      content: 'You match rule field names to actual column headers. Return ONLY the best matching column header from the list, or "NONE" if no match. No explanation.',
    },
    {
      role: 'user',
      content: `Rule field: "${ruleFieldName}"\nAvailable columns: ${JSON.stringify(columnHeaders)}\n\nBest match:`,
    },
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: modelName,
      messages: messages,
      temperature: 0,
      max_tokens: 100,
    });

    const latency_ms = Date.now() - startTime;
    let match = completion.choices[0]?.message?.content?.trim();
    
    // Log async
    logAIUsage({
      model: modelName,
      prompt_tokens: completion.usage?.prompt_tokens || 0,
      completion_tokens: completion.usage?.completion_tokens || 0,
      total_tokens: completion.usage?.total_tokens || 0,
      messages: messages,
      response: { match },
      latency_ms
    }).catch(() => {});

    if (!match || match === 'NONE') return null;

    // Remove quotes if the AI added them
    match = match.replace(/^["']|["']$/g, '').trim();

    // Try exact match first
    if (columnHeaders.includes(match)) {
      return match;
    }

    // Try case-insensitive fuzzy match
    const lowerMatch = match.toLowerCase();
    const found = columnHeaders.find(h => h.toLowerCase() === lowerMatch);
    if (found) return found;

    return null;
  } catch (error) {
    console.error("Match Error:", error);
    return null;
  }
}
