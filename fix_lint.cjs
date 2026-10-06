const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

// 1. Fix import
code = code.replace("import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';", "import { GoogleGenAI, LiveServerMessage, Modality, Type as GenAIType } from '@google/genai';");

// 2. Fix Type usage
code = code.replace("type: Type.OBJECT,", "type: GenAIType.OBJECT,");
code = code.replace("type: Type.STRING,", "type: GenAIType.STRING,");

// 3. Remove toolConfig
code = code.replace(/                   toolConfig: \{ includeServerSideToolInvocations: true \},\n/g, "");
code = code.replace(/          toolConfig: \{ includeServerSideToolInvocations: true \},\n/g, "");

fs.writeFileSync('src/components/CallView.tsx', code);
