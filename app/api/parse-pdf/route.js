import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';
import { parsePdfWithAdapters } from '@/lib/format-adapters/registry';


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a highly accurate data extraction system for truck trip / fleet reports.
You will be provided with raw text extracted from a PDF document containing a table.
Your job is to reconstruct the table into structured JSON.

Output ONLY valid JSON with this exact format:
{
  "headers": ["column_1", "column_2", "..."],
  "rows": [
    {"column_1": "value", "column_2": "value"}
  ]
}

Guidelines:
1. Preserve all data exactly as written.
2. If a cell is empty, use an empty string "".
3. Identify true column headers (ignore titles, logos, metadata at the top).
4. For fleet reports, common columns include: Date, Status, Duration, Start Time, End Time, Distance, Location.
5. Duration may appear as "24m 54s", "1h 8m", "36m" — preserve exactly.
6. Distance may include units like "km" — preserve exactly.
7. Do not include summary/total-only rows.
8. Output ONLY valid JSON. No markdown, no explanation.`;

async function _POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Tier 1: Deterministic format adapters
    const adapterResult = parsePdfWithAdapters(text);
    if (adapterResult && adapterResult.rows?.length > 0) {
      return NextResponse.json({
        ...adapterResult,
        parser: 'adapter',
      });
    }

    // Tier 2: AI extraction fallback
    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Extract this table into JSON format.\n\nRAW TEXT:\n${text.slice(0, 12000)}` },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    });

    let aiText = completion.choices[0]?.message?.content?.trim();
    if (!aiText) throw new Error('Empty response from AI');

    aiText = aiText.replace(/[\s\S]*?<\/think>/gi, '');
    aiText = aiText.replace(/<think>[\s\S]*?<\/think>/gi, '');

    const firstBrace = aiText.indexOf('{');
    const lastBrace = aiText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }

    const result = JSON.parse(aiText.substring(firstBrace, lastBrace + 1));

    if (!result.headers || !result.rows) {
      throw new Error('Invalid JSON format returned from AI');
    }

    return NextResponse.json({
      headers: result.headers,
      rows: result.rows,
      formatProfile: 'generic_pdf',
      parser: 'ai',
    });
  } catch (error) {
    console.error('PDF Parse API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process PDF text' }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
