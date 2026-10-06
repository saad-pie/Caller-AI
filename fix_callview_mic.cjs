const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  /recorderRef\.current\.start\(\(base64Data\) => \{([\s\S]*?)\}\)\.catch\(err => \{([\s\S]*?)\}\);/g,
  `recorderRef.current.start((base64Data) => {$1}).catch(err => {
      console.error("Audio start failed:", err);
      setAiCaption("Microphone access denied or unavailable.");
    });`
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('Added mic error UI in CallView.tsx');
