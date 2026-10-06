const fs = require('fs');
let code = fs.readFileSync('netlify.toml', 'utf8');

code = code.replace(
  /command = "npm run build"/g,
  'command = "npm install && npm run build"'
);

fs.writeFileSync('netlify.toml', code);
console.log('Updated netlify.toml to force npm install');
