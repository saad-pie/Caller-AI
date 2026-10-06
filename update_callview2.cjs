const fs = require('fs');
let code = fs.readFileSync('src/components/CallView.tsx', 'utf8');

// Replace recorderRef.current.start in connectNewAI
code = code.replace(
  /aiConnectionsRef\.current\.forEach\(conn => \{\s*\(conn as any\)\.sendRealtimeInput\?\(\{\s*audio: \{ data: base64Data, mimeType: 'audio\/pcm;rate=16000' \}\s*\}\);\s*\}\);/g,
  `aiConnectionsRef.current.forEach(manager => {
              const session = manager.getSession();
              if (session && typeof session.sendRealtimeInput === 'function') {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            });`
);

const oldSessionRegex = /const session = await ai\.live\.connect\(\{[\s\S]*?aiConnectionsRef\.current\.set\(aiContact\.id!, session\);/m;

const newSessionCode = `
            const callbacks = {
               onmessage: (msg: LiveServerMessage) => {
                 if (msg.serverContent?.interrupted) {
                   playerRef.current?.stop();
                   playerRef.current = new AudioStreamPlayer(); 
                 }
                 if (msg.toolCall && msg.toolCall.functionCalls) {
                   const responses = msg.toolCall.functionCalls.map(call => {
                     if (call.name === "set_background_environment") {
                       const args = call.args as any;
                       const env = args.environment;
                       const AMBIENT_SOUNDS: Record<string, string> = {
                           driving: "https://actions.google.com/sounds/v1/transportation/driving_in_car.ogg",
                           cafe: "https://actions.google.com/sounds/v1/crowds/restaurant_chatter.ogg",
                           street: "https://actions.google.com/sounds/v1/crowds/city_street_traffic.ogg",
                           rain: "https://actions.google.com/sounds/v1/weather/rain_on_roof.ogg",
                           nature: "https://actions.google.com/sounds/v1/ambiences/forest_morning.ogg",
                           office: "https://actions.google.com/sounds/v1/office/typing_on_keyboard.ogg",
                           train: "https://actions.google.com/sounds/v1/transportation/train_pass_by.ogg",
                           eating: "https://actions.google.com/sounds/v1/crowds/dining_room_chatter.ogg",
                           gym: "https://actions.google.com/sounds/v1/crowds/fitness_center_crowd.ogg",
                           walking: "https://actions.google.com/sounds/v1/crowds/walking_on_gravel.ogg"
                       };
                       if (env && AMBIENT_SOUNDS[env]) {
                         setAmbientUrl(AMBIENT_SOUNDS[env]);
                         setAiCaption(\`[Background changed to: \${env}]\`);
                       } else {
                         setAmbientUrl(null);
                         setAiCaption(\`[Background disabled]\`);
                       }
                       return {
                         id: call.id,
                         name: call.name,
                         response: { result: "Environment updated." }
                       };
                     }
                     return {
                       id: call.id,
                       name: call.name,
                       response: { result: "Unknown function." }
                     };
                   });
                   const session = aiConnectionsRef.current.get(aiContact.id!)?.getSession();
                   if (session && typeof session.sendToolResponse === 'function') {
                     session.sendToolResponse({ functionResponses: responses });
                   }
                 }
                 const parts = msg.serverContent?.modelTurn?.parts;
                 if (parts) {
                   let textAcc = "";
                   for (const part of parts) {
                     if (part.inlineData && part.inlineData.data) {
                       const audioPutt = part.inlineData.data;
                       playerRef.current?.playPiece(audioPutt);
                       
                       // Pipe to other AIs
                       Array.from(aiConnectionsRef.current.entries()).forEach(([id, manager]) => {
                         if (id !== aiContact.id && manager && !isMutedRef.current) {
                            const c = manager.getSession();
                            if (c && typeof c.sendRealtimeInput === 'function') {
                              c.sendRealtimeInput({
                                audio: { data: audioPutt, mimeType: 'audio/pcm;rate=24000' }
                              });
                            }
                         }
                       });
                     }
                     if (part.text) {
                       textAcc += part.text;
                     }
                   }
                   if (textAcc) {
                     setTranscript(prev => [...prev, {
                       speaker: aiContact.name,
                       text: textAcc,
                       timestamp: Date.now()
                     }]);
                   }
                 }
               }
            };
            
            const config = {
               tools: LIVE_API_TOOLS,
               responseModalities: [Modality.AUDIO],
               systemInstruction: personaDesc,
               speechConfig: {
                 voiceConfig: { prebuiltVoiceConfig: { voiceName } },
               },
               inputAudioTranscription: {},
               outputAudioTranscription: {},
            };
            
            const manager = new LiveConnectionManager(
              apiKey,
              config as any,
              callbacks,
              (state, msg) => {
                // Ignore state changes for secondary participants
              }
            );
            
            aiConnectionsRef.current.set(aiContact.id!, manager);
            await manager.connect();
`;

code = code.replace(oldSessionRegex, newSessionCode);
fs.writeFileSync('src/components/CallView.tsx', code);
console.log('updated CallView.tsx');
