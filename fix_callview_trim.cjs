const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  /const apiKey = process\.env\.GEMINI_API_KEY;/g,
  "const apiKey = process.env.GEMINI_API_KEY?.trim();"
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('Trimmed API key in CallView.tsx');
