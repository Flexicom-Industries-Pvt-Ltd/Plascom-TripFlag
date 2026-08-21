import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are an intelligent data parser. 
I will give you a sample (first 30 rows) of a 2D grid extracted from a messy spreadsheet or OCR document.
The grid is an array of arrays of strings. 
Your job is to identify the EXACT rows where the data table begins.
The data table might have titles and empty rows above it.

CRITICAL RULES:
1. Find the 0-based index of the row that contains the REAL table column names. Ignore rows that just have 1 or 2 isolated strings (like "STORE NAME").
2. Find the 0-based index of the row where the ACTUAL data starts (usually immediately after the headers).

Output ONLY valid JSON with this exact structure:
{
  "header_row_index": 4,
  "data_start_row": 5
}

Output ONLY the JSON object, nothing else. No markdown, no explanation, no conversational text.`;

async function _POST(request) {
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
      max_tokens: 1500
    });

    const text = completion.choices[0]?.message?.content?.trim();
    console.log("AI TEXT:", text);
    if (!text) throw new Error('Empty response from AI');

    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    if (typeof result.data_start_row !== 'number' || typeof result.header_row_index !== 'number') {
      throw new Error('AI did not return valid row indices');
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


export const POST = withLogging(_POST);
