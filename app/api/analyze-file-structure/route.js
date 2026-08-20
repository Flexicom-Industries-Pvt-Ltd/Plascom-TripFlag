import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an intelligent data parser. 
I will give you a sample (first 30 rows) of a 2D grid extracted from a messy spreadsheet or OCR document.
The grid is an array of arrays of strings. 
Your job is to identify the EXACT bounding box of the actual data table within this grid.
The data table might be shifted to the right, or have titles and empty rows above it.

CRITICAL RULES:
1. Find the 0-based index of the row that contains the REAL table column names. Ignore rows that just have 1 or 2 isolated strings (like "STORE NAME").
2. Find the 0-based index of the row where the ACTUAL data starts (usually immediately after the headers).
3. Identify the specific columns that have valid header names, and map their 0-based column index to their header string. Ignore "__EMPTY" or purely blank headers.

Output ONLY valid JSON with this exact structure:
{
  "header_row_index": 4,
  "data_start_row": 5,
  "columns": [
    { "index": 15, "name": "Assign to" },
    { "index": 16, "name": "Biller Name" },
    { "index": 17, "name": "Reason" }
  ]
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
      max_tokens: 300,
      response_format: { type: 'json_object' }
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from AI');

    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    if (typeof result.data_start_row !== 'number' || !Array.isArray(result.columns)) {
      throw new Error('AI did not return a valid bounding box structure');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Structure Analysis Error:', error);
    // If AI fails, fallback to assuming it's a clean CSV
    return NextResponse.json({ 
      fallback: true,
      header_row_index: 0,
      data_start_row: 1,
      columns: [] // empty indicates frontend should just use all non-empty columns from row 0
    });
  }
}
