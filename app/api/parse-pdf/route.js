import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a highly accurate data extraction system.
You will be provided with the raw text extracted from a PDF document containing a table.
Your job is to perfectly reconstruct the table into structured JSON.

Output ONLY valid JSON with this exact format:
{
  "headers": ["column_1", "column_2", "..."],
  "rows": [
    {"column_1": "value", "column_2": "value"},
    {"column_1": "value", "column_2": "value"}
  ]
}

Guidelines:
1. Preserve all data exactly as written.
2. If a cell is empty or missing, use an empty string "".
3. Identify the true column headers (ignore unrelated titles or store names at the top).
4. Do not include summary/total rows at the very bottom if they break the standard row structure.
5. Output ONLY a valid JSON object. No markdown blocks, no conversational text.`;

async function _POST(request) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract this table into JSON format.\n\nRAW TEXT:\n${text}`
        }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    let aiText = completion.choices[0]?.message?.content?.trim();
    if (!aiText) throw new Error('Empty response from AI');
    
    // Remove Qwen's <think> blocks if present
    aiText = aiText.replace(/<think>[\s\S]*?<\/think>/, '');
    
    console.log("AI PDF TEXT:", aiText);

    const firstBrace = aiText.indexOf('{');
    const lastBrace = aiText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No JSON object found in response');
    }
    
    const jsonStr = aiText.substring(firstBrace, lastBrace + 1);

    const result = JSON.parse(jsonStr);

    if (!result.headers || !result.rows) {
      throw new Error('Invalid JSON format returned from AI');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('PDF Parse API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process PDF text' }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
