const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  "const c = session as any;",
  "const c = manager.getSession() as any;"
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('updated CallView.tsx');
