process.env.GROQ_API_KEY = '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';

import('./lib/groq.js').then(async (m) => {
  console.log('Testing Groq API...');
  const res = await m.parseNaturalLanguageRule('flag if fuel is above 50');
  console.log('Result:', res);
});
