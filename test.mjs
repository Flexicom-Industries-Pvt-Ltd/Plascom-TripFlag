import { parseNaturalLanguageRule } from './lib/groq.js';

process.env.GROQ_API_KEY = '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';

async function main() {
  console.log('Testing Groq API...');
  const res = await parseNaturalLanguageRule('flag if fuel is above 50');
  console.log('Result:', res);
}

main();
