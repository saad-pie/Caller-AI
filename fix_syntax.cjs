const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

// The replacement was missing a closing brace. We need to add one before `onerror:`
code = code.replace(/                      \}\n                     \},\n                   onerror:/g, "                      }\n                     }\n                   },\n                   onerror:");
fs.writeFileSync('src/components/CallView.tsx', code);
