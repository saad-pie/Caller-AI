const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf8');

code = code.replace(
  /'process\.env\.GEMINI_API_KEY': JSON\.stringify\(env\.GEMINI_API_KEY\)/g,
  "'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)"
);

fs.writeFileSync('vite.config.ts', code);
console.log('Updated vite.config.ts to support VITE_ prefix');
