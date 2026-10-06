const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  /const session = manager\.getSession\(\);\s*if \(session && typeof session\.sendRealtimeInput === 'function'\) \{/g,
  `const session = manager.getSession();
              if (manager.getState() === 'connected' && session && typeof session.sendRealtimeInput === 'function') {`
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('Fixed CallView.tsx audio loop');
