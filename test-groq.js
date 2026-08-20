import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { parseNaturalLanguageRule } from './lib/groq.js';

async function main() {
  console.log('Testing Groq API...');
  const res = await parseNaturalLanguageRule('flag if fuel is above 50');
  console.log(res);
}

main();
