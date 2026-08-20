import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an intelligent data parser. 
I will give you the first 20 rows of an Excel/CSV file represented as a JSON array of arrays.
Many files have meta-information (titles, dates, blank rows) at the top before the actual table data begins.
Your job is to look at the rows and figure out the exact 0-based index of the row that contains the REAL table headers (like 'Assign to', 'Biller Name', 'Amount', 'Date', etc.).

Rules:
1. Ignore rows that just have a single title string (like "Sales Summary").
2. Ignore rows that are mostly empty.
3. The true header row usually has many densely packed strings that describe column data.
4. Output ONLY a valid JSON object with a single key 'header_index' pointing to the 0-based integer index of the header row.

Example Output:
{"header_index": 3}`;

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
      max_tokens: 50,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from AI');

    const result = JSON.parse(text);

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
