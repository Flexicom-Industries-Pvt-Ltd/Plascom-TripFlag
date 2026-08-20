import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an intelligent data parser. 
I will give you the first 20 rows of an Excel/CSV file represented as a JSON array of arrays.
Many files have meta-information (titles, dates, company names, blank rows) at the top before the actual table data begins.
Your job is to look at the rows and figure out the exact 0-based index of the row that contains the REAL table headers.

CRITICAL RULES:
1. Ignore rows that just have 1 or 2 strings (like "Sales Summary", "STORE NAME", or dates).
2. Ignore rows that are mostly empty.
3. The true header row ALWAYS has multiple densely packed strings that describe column data (e.g. 'Order No.', 'Date', 'Payment Type', 'Amount').
4. The true header row is usually immediately followed by data rows.

Output ONLY valid JSON with this exact structure:
{
  "header_index": 3
}

Output ONLY the JSON object, nothing else. No markdown, no explanation, no conversational text.`;

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(rows) },
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from AI');

    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    if (typeof result.header_index !== 'number') {
      throw new Error('AI did not return a valid header_index number');
    }

    return NextResponse.json({ header_index: result.header_index });
  } catch (error) {
    console.error('Header Detection Error:', error);
    // If AI fails, fallback to row 0 safely
    return NextResponse.json({ header_index: 0, fallback: true });
  }
}
