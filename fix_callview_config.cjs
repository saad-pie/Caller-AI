const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

code = code.replace(
  /inputAudioTranscription:\s*\{\},/g,
  ""
);
code = code.replace(
  /outputAudioTranscription:\s*\{\},/g,
  ""
);

fs.writeFileSync('src/components/CallView.tsx', code);
console.log('Removed empty transcriptions from CallView.tsx');
