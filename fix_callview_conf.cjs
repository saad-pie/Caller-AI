const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  /aiConnectionsRef\.current\.forEach\(conn => \{\s*\(conn as any\)\.sendRealtimeInput\?\(\{\s*audio: \{ data: base64Data, mimeType: 'audio\/pcm;rate=16000' \}\s*\}\);\s*\}\);/g,
  `aiConnectionsRef.current.forEach(manager => {
              const session = manager.getSession();
              if (manager.getState() === 'connected' && session && typeof session.sendRealtimeInput === 'function') {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            });`
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('Fixed CallView.tsx conference audio loop');
