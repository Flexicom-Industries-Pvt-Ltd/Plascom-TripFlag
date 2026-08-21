import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { withLogging } from '../../../lib/logger';


const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are a highly accurate data extraction system.
You will be provided an image of a trip sheet or tabular data.
Your job is to perfectly extract the table into structured JSON.

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
2. If a cell is empty, use an empty string "".
3. Use snake_case or standard lowercase words for headers (e.g. "fuel_level").
4. If there are no clear headers, invent logical ones based on the data.
5. Output ONLY a valid JSON object. No markdown blocks, no conversational text.`;

async function _POST(request) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: 'Missing imageBase64 in request' }, { status: 400 });
    }

    const completion = await groq.chat.completions.create({
      model: 'qwen/qwen3.6-27b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract this table into JSON format.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from Groq Vision API');

    // Attempt to extract JSON if there's any markdown
    let jsonStr = text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const result = JSON.parse(jsonStr);

    if (!result.headers || !result.rows) {
      throw new Error('Invalid JSON format returned from AI');
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to perform OCR' }, { status: 500 });
  }
}


export const POST = withLogging(_POST);
