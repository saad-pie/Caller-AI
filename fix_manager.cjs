const fs = require('fs');
let code = fs.readFileSync('src/lib/connectionManager.ts', 'utf8');

code = code.replace(
  /this\.updateState\('reconnecting', `Connection lost\. Retrying in \$\{delay\/1000\}s\.\.\.`\);/g,
  `const errMsg = error && error.message ? error.message : "Connection lost";
      this.updateState('reconnecting', \`\${errMsg}. Retrying...\`);`
);

fs.writeFileSync('src/lib/connectionManager.ts', code);
console.log('Fixed manager logging');
