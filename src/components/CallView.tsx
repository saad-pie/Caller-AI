import { UserPlus, MicOff, Volume2, MoreVertical, PhoneOff, User, Mic, Search, MessageSquare, ArrowLeft, Send, Type, FileText, Square, Circle, Settings2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { type Contact, type UserProfile, db } from '../lib/db';
import { firebaseDb } from '../lib/firebaseDb';
import { auth } from '../lib/firebase';
import { GoogleGenAI, LiveServerMessage, Modality, Type as GenAIType } from '@google/genai';
import { AudioStreamPlayer, AudioRecorder } from '../lib/liveMedia';
import { LiveConnectionManager } from '../lib/connectionManager';

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
}

interface CallViewProps {
  target: Contact | { number: string; name?: string; personaDescription?: string; voice?: string; photoUrl?: string; settings?: any };
  onEndCall: (duration: number, transcript?: TranscriptEntry[]) => void;
  direction?: 'inbound' | 'outbound';
}

const getValidVoiceName = (voiceConfigStr: string | undefined): string => {
  if (!voiceConfigStr) return "Puck";
  const normalized = voiceConfigStr.toLowerCase().replace("gemini-", "").replace("live-", "").trim();
  
  // Handled mapping for known/historical/unsupported names
  if (normalized === "shimmer" || normalized === "leda") return "Aoede";
  if (normalized === "breeze") return "Kore";
  if (normalized === "cove" || normalized === "juno" || normalized === "puck") return "Puck";
  if (normalized === "ember") return "Fenrir";
  
  const validVoices = ["Aoede", "Charon", "Fenrir", "Kore", "Puck", "Zephyr"];
  const matched = validVoices.find(v => v.toLowerCase() === normalized);
  if (matched) return matched;
  
  return "Puck"; // standard fallback
};

export default function CallView({ target, onEndCall, direction = 'outbound' }: CallViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [callState, setCallState] = useState<'calling' | 'connected' | 'voicemail'>(direction === 'outbound' ? 'connected' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);

  const [ringingCountdown, setRingingCountdown] = useState(8);
  const [voicemailText, setVoicemailText] = useState('');
  const [voicemailLoading, setVoicemailLoading] = useState(false);
  const voicemailGeneratingRef = useRef(false);

  const handleTriggerVoicemail = async () => {
    if (voicemailGeneratingRef.current) return;
    voicemailGeneratingRef.current = true;
    
    setCallState('voicemail');
    setVoicemailLoading(true);
    setVoicemailText('Connecting to voicemail box...');

    try {
      const p = participants.find(part => part.personaDescription);
      const characterName = p?.name || target.name || 'AI Persona';
      const personaDesc = p?.personaDescription || (target as any).personaDescription || 'A helpful AI persona.';
      const voice = p?.voice || (target as any).voice || 'Aoede';
      
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error("No Gemini API key defined");
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are answering a voicemail as the persona: "${characterName}". 
Character details: "${personaDesc}".
Provide a short, immersive, and highly realistic character voicemail message (approx 40-75 words). 
Explain briefly that you tried to call them or are currently busy (rockets, ruling Rome, on an adventure, coding), and ask them to catch up later. 
Do NOT write any bracketed descriptions, scene setups, narrator voice overs, speaker name prefixes like "${characterName}:", or quotes. Just output the spoken characters directly.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });

      const messageContent = response.text?.trim() || `Hey! This is ${characterName}. Sorry I missed you, call me back!`;
      setVoicemailText(messageContent);
      setVoicemailLoading(false);

      // Now save this voicemail to local storage and firebase!
      const user = auth.currentUser;
      const payload = {
        userId: user?.uid || 'anonymous',
        contactId: p?.id || (target as any).id || Date.now().toString(),
        contactName: characterName,
        photoUrl: p?.photoUrl || target.photoUrl || '',
        timestamp: Date.now(),
        duration: Math.max(10, Math.round(messageContent.split(' ').length * 0.45)),
        transcriptText: messageContent,
        voice: voice,
        isPlayed: false
      };

      // Add locally
      db.addVoicemail(payload);

      // Add to Firestore
      if (user) {
        await firebaseDb.addVoicemail(user.uid, payload);
      }

      // Narrate greeting automatically using SpeechSynthesis!
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(messageContent);
      
      const voices = window.speechSynthesis.getVoices();
      const voiceName = voice || 'Aoede';
      const selectedVoice = voices.find(v => 
        v.name.toLowerCase().includes(voiceName.toLowerCase()) || 
        v.lang.toLowerCase().includes(voiceName.toLowerCase())
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      
      if (selectedVoice) {
         utter.voice = selectedVoice;
      }
      window.speechSynthesis.speak(utter);

    } catch (e) {
      console.error("Failed to generate voicemail:", e);
      setVoicemailText("The voicemail service is currently unavailable. Please hang up and call again later.");
      setVoicemailLoading(false);
    }
  };

  const [participants, setParticipants] = useState<any[]>([target]);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  
  const [showChat, setShowChat] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [toast, setToast] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [audioSettings, setAudioSettings] = useState({
    echoCancellation: true,
    noiseSuppression: true,
  });
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [contactsList, setContactsList] = useState<Contact[]>([]);
  
  const [microphonePermissionError, setMicrophonePermissionError] = useState(false);
  const [permissionErrorMessage, setPermissionErrorMessage] = useState('');
  
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      firebaseDb.getUserProfile(user.uid).then(setProfile);
      firebaseDb.getContacts(user.uid).then(setContactsList);
    }
  }, []);

  const isAI = participants.some(p => 'personaDescription' in p && !!p.personaDescription);
  
  useEffect(() => {
    if (isAI && callState === 'calling') {
      const timer = setInterval(() => {
        setRingingCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleTriggerVoicemail();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isAI, callState]);
  
  useEffect(() => {
    // Check if auto-recording is enabled for the target
    if (isAI && target.settings?.recordingEnabled) {
      setTimeout(handleStartRecording, 3000); // Start after connection delay
    }
  }, [isAI]);
  
  const LIVE_API_TOOLS = [
    { googleSearch: {} },
    {
      functionDeclarations: [
        {
          name: "set_background_environment",
          description: "Set the background ambient sound to match your current situation, location, or activity. Call this to immerse the user in your environment. If changing location, call this again.",
          parameters: {
            type: GenAIType.OBJECT,
            properties: {
              environment: {
                type: GenAIType.STRING,
                description: "The environment sound to play.",
                enum: ["driving", "cafe", "street", "rain", "nature", "office", "train", "eating", "gym", "walking", "none"]
              }
            },
            required: ["environment"]
          }
        }
      ]
    }
  ];

  const getDisplayName = () => {
    if (participants.length === 1) {
      const p = participants[0];
      return ('name' in p && p.name) ? p.name : p.number;
    }
    return `Conference (${participants.length})`;
  };

  const displayName = getDisplayName();

  const [aiCaption, setAiCaption] = useState('');
  const [ambientUrl, setAmbientUrl] = useState<string | null>(null);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (ambientUrl && ambientAudioRef.current) {
      ambientAudioRef.current.src = ambientUrl;
      ambientAudioRef.current.loop = true;
      ambientAudioRef.current.volume = 0.4;
      ambientAudioRef.current.play().catch(e => console.error("Ambient audio play error", e));
    } else if (!ambientUrl && ambientAudioRef.current) {
      ambientAudioRef.current.pause();
    }
  }, [ambientUrl]);

  useEffect(() => {
    if (callState !== 'connected' && ambientAudioRef.current) {
      ambientAudioRef.current.pause();
    }
  }, [callState]);
  
  useEffect(() => {
    if (aiCaption && !aiCaption.includes("Connected.") && !aiCaption.includes("Connection error") && !aiCaption.includes("Connection closed")) {
      setTranscript(prev => {
        if (aiCaption.startsWith("You: ")) {
          // Already added in handleSendMessage, prevent duplication
          return prev;
        }
        if (prev.length > 0 && prev[prev.length - 1].text === aiCaption) return prev;
        
        let speaker = displayName;
        let text = aiCaption;
        
        if (aiCaption.includes(": ")) {
          const parts = aiCaption.split(": ");
          speaker = parts[0];
          text = parts.slice(1).join(": ");
        }
        
        return [...prev, {
          speaker,
          text,
          timestamp: Date.now()
        }];
      });
    }
  }, [aiCaption, displayName]);
  
  // Refs for Live API
  const aiRef = useRef<any>(null);
  const playerRef = useRef<AudioStreamPlayer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const isMutedRef = useRef(isMuted);

  // Active AI connections
  const aiConnectionsRef = useRef<Map<string, LiveConnectionManager>>(new Map());

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (!isAI) {
      const timer = setTimeout(() => {
        setCallState('connected');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAI]);

  useEffect(() => {
    if (callState === 'connected') {
      const interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [callState]);

  useEffect(() => {
    let sessionStarted = false;
    
    // Check if we need to initialize IDs, but only once
    const missingIds = participants.some(p => !p.id);
    if (missingIds) {
      const initialized = participants.map(p => p.id ? p : { ...p, id: `temp-${Math.random().toString(36).substring(7)}` });
      setParticipants(initialized);
      return;
    }

    // 2. Initialize Shared Media (Player & Recorder) if any AI is present
    const hasAI = participants.some(p => p.isAI);
    if (hasAI && callState === 'connected') {
      if (!playerRef.current) playerRef.current = new AudioStreamPlayer();
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
        recorderRef.current.start((base64Data) => {
          if (!isMutedRef.current) {
            aiConnectionsRef.current.forEach(manager => {
              const session = manager.getSession();
              if (manager.getState() === 'connected' && session && typeof session.sendRealtimeInput === 'function') {
                session.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            });
          }
        }).catch(err => {
      console.error("Audio start failed:", err);
      setAiCaption("Microphone access denied or unavailable.");
    });
      }
    }

    // 3. Connect Primary AI session if target was AI
    if (isAI && callState === 'connected' && !aiRef.current) {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
         setAiCaption("Error: Missing GEMINI_API_KEY environment variable");
         return;
      }
      // Remove local player/recorder re-init here as it's shared now
      
      const p = participants.find(part => part.personaDescription);
      const globalPrompt = (profile?.globalPromptEnabled && profile?.globalPrompt) ? `${profile.globalPrompt}\n\n` : '';
      
      const phoneContext = `[CRITICAL INSTRUCTIONS FOR AI]
You are residing on the user's mobile phone as a live participant on a call. 
1. DO NOT mention you are an AI, a general-purpose model, or break character. 
2. Fully adopt the persona described to you. Answer ONLY from their perspective.
3. You have native audio capabilities. You CAN and SHOULD use expressive range when appropriate: you can generate whispers, you can shout, you can show extreme emotion, sighs, and excitement.
4. [ENVIRONMENTAL IMMERSION] You have access to the "set_background_environment" tool. YOU MUST USE IT PROACTIVELY. If you are driving, set it to "driving". If you are in a cafe, set it to "cafe". If you are walking down a street, set it to "street". If it is raining, set it to "rain". If you are eating, set it to "eating". If the user asks where you are or what you are doing, explain while SIMULTANEOUSLY calling the tool to immerse them.
5. If you do not know something, make up a persona-appropriate response rather than breaking character.

[YOUR PERSONA CAPTURE]
${p?.personaDescription || "You are a helpful phone assistant."}
====================
`;

      const personaDesc = globalPrompt + phoneContext;

        if (p && p.personaDescription) {
          const connectAI = async () => {
             try {
                const voiceName = getValidVoiceName(p.voice);

                
                const callbacks = {
                   onopen: async () => {
                     sessionStarted = true;
                   },
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
                             setAiCaption(`[Background changed to: ${env}]`);
                           } else {
                             setAmbientUrl(null);
                             setAiCaption(`[Background disabled]`);
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
                       const session = aiConnectionsRef.current.get(p.id!)?.getSession();
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
                             if (id !== (p as any).id && manager && !isMutedRef.current) {
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
                         setAiCaption(textAcc);
                         setTranscript(prev => [...prev, {
                           speaker: displayName,
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
                   
                   
                };
                
                const manager = new LiveConnectionManager(
                  apiKey,
                  config as any,
                  callbacks,
                  (state, msg) => {
                    if (msg) setAiCaption(msg);
                  }
                );
                
                // Save primary session
                aiRef.current = manager as any;
                aiConnectionsRef.current.set(p.id!, manager);
                await manager.connect();

             } catch(e) {
               console.error("LiveConnect err", e);
               setAiCaption("Failed to connect live audio.");
             }
          }
          connectAI();
        }
    }
    
    return () => {
      recorderRef.current?.stop();
      playerRef.current?.stop();
      // Close all AI connections
      aiConnectionsRef.current.forEach(manager => {
        try {
          manager.disconnect();
        } catch (err) {
          console.warn("Error closing AI session", err);
        }
      });
      aiConnectionsRef.current.clear();
      aiRef.current = null;
      window.speechSynthesis.cancel();
    };
  }, [participants, callState]); // Remove isAI from dependencies to ensure we handle additions

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAddParticipant = (contact: Contact) => {
    setParticipants(prev => [...prev, contact]);
    setShowAddParticipant(false);
    setToast(`${contact.name} joined the call`);
    setTimeout(() => setToast(''), 3000);

    // If it's an AI, we need to spin up a new AI Live API connection
    if (contact.isAI && contact.personaDescription) {
      connectNewAI(contact);
    }
  };

  const connectNewAI = async (aiContact: Contact) => {
    try {
      if (!playerRef.current) playerRef.current = new AudioStreamPlayer();
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
        recorderRef.current.start((base64Data) => {
          if (!isMutedRef.current) {
            aiConnectionsRef.current.forEach(conn => {
              (conn as any).sendRealtimeInput?.({
                audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
              });
            });
          }
        }).catch(err => console.warn("Conference AI recorder start failed", err));
      }
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
         setAiCaption("Error: Missing GEMINI_API_KEY environment variable");
         return;
      }
      const globalPrompt = (profile?.globalPromptEnabled && profile?.globalPrompt) ? `${profile.globalPrompt}\n\n` : '';
      const phoneContext = `[CRITICAL INSTRUCTIONS FOR AI]
You are residing on the user's mobile phone as a live participant on a call. 
1. DO NOT mention you are an AI, a general-purpose model, or break character. 
2. Fully adopt the persona described to you. Answer ONLY from their perspective.
3. You have native audio capabilities. You CAN and SHOULD use expressive range when appropriate: you can generate whispers, you can shout, you can show extreme emotion, sighs, and excitement.
4. [ENVIRONMENTAL IMMERSION] You have access to the "set_background_environment" tool. YOU MUST USE IT PROACTIVELY. If you are driving, set it to "driving". If you are in a cafe, set it to "cafe". If you are walking down a street, set it to "street". If it is raining, set it to "rain". If you are eating, set it to "eating". If the user asks where you are or what you are doing, explain while SIMULTANEOUSLY calling the tool to immerse them.
5. If you do not know something, make up a persona-appropriate response rather than breaking character.

[YOUR PERSONA CAPTURE]
${aiContact.personaDescription}
====================
`;
      const personaDesc = `${globalPrompt}${phoneContext}`;
      
      const voiceName = getValidVoiceName(aiContact.voice);
      
      
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
                         setAiCaption(`[Background changed to: ${env}]`);
                       } else {
                         setAmbientUrl(null);
                         setAiCaption(`[Background disabled]`);
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
               
               
            };
            
            const manager = new LiveConnectionManager(
              apiKey,
              config as any,
              callbacks,
              (state, msg) => {
                // Ignore state changes for secondary participants
              }
            );
            
            aiConnectionsRef.current.set(aiContact.id, manager);
            await manager.connect();

      
      // Trigger the newly added AI to say hello
      const c = manager.getSession() as any;
      if (typeof c.sendClientContent === 'function') {
        c.sendClientContent({
          turns: [{ role: "user", parts: [{ text: "Hello, you've just been added to a group call." }] }],
          turnComplete: true
        });
      } else if (typeof c.send === 'function') {
        const payload = {
          clientContent: { turns: [{ role: "user", parts: [{ text: "Hello, you've just been added to a group call." }] }], turnComplete: true }
        };
        c.send(payload);
      }
    } catch (e) {
      console.error("Failed to connect new AI", e);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    
    const textToSend = messageText.trim();
    
    // Add to transcript
    setTranscript(prev => [...prev, {
      speaker: 'You',
      text: textToSend,
      timestamp: Date.now()
    }]);

    setMessageText('');
    setAiCaption(`You: ${textToSend}`);

    // Send to all connected AIs via text
    Array.from(aiConnectionsRef.current.values()).forEach((conn) => {
      const c = conn as any;
      try {
        if (typeof c.sendClientContent === 'function') {
          c.sendClientContent({
            turns: [{ role: "user", parts: [{ text: textToSend }] }],
            turnComplete: true
          });
        } else if (typeof c.send === 'function') {
           c.send({ clientContent: { turns: [{ role: "user", parts: [{ text: textToSend }] }], turnComplete: true } });
        } else if (typeof c.sendRealtimeInput === 'function') {
           c.sendRealtimeInput([{ text: textToSend }]);
        }
      } catch (err) {
        console.error("Text send error:", err);
      }
    });
  };

  const handleSearch = () => {
    if (!searchText.trim()) return;
    setToast(`Searching Google for "${searchText}"...`);
    setTimeout(() => setToast(''), 3000);
    setSearchText('');
    setShowSearch(false);
  };

  const handleStartRecording = async () => {
    try {
      if (!recorderRef.current) {
        recorderRef.current = new AudioRecorder();
      }
      
      if (!recorderRef.current.isActive()) {
        try {
          await recorderRef.current.start(() => {}); // Minimal start to get the stream
        } catch (perErr: any) {
          console.error("Recording error: permission denied for recording start", perErr);
          setMicrophonePermissionError(true);
          setPermissionErrorMessage(String(perErr?.message || perErr));
          setToast("Recording failed: Microphone Permission Denied.");
          return;
        }
      }

      const stream = recorderRef.current?.getStream();
      if (!stream) {
        setToast("Microphone stream not ready.");
        return;
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setToast("Recording saved!");
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setToast("Recording started...");
    } catch (e) {
      console.error("Recording error", e);
      setToast("Could not start recording.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const downloadRecording = () => {
    if (recordingBlob) {
      const url = URL.createObjectURL(recordingBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-record-${Date.now()}.webm`;
      a.click();
    }
  };

  if (isAI && callState === 'calling') {
    const p = participants[0] || target;
    const name = p.name || 'AI Persona';
    const photoUrl = p.photoUrl;

    return (
      <div className="flex flex-col h-full bg-[#F3F6FB] items-center justify-between py-16 px-6 font-sans select-none relative overflow-auto w-full">
        {/* Animated concentric circles background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
          <div className="w-[300px] h-[300px] rounded-full border border-blue-400 animate-[ping_4s_linear_infinite]" />
          <div className="w-[500px] h-[500px] rounded-full border border-blue-400 animate-[ping_6s_linear_infinite]" />
        </div>

        {/* Top Info */}
        <div className="text-center z-10 pt-4">
          <p className="text-[#0B57D0] text-xs font-bold tracking-widest uppercase mb-2 flex items-center justify-center gap-1">
            <SparklesIcon /> Calling via Gemini Live
          </p>
          <h1 className="text-4xl font-black text-gray-900 leading-tight mb-1">{name}</h1>
          <p className="text-sm text-gray-400 font-semibold animate-pulse">Ringing...</p>
        </div>

        {/* Pulsating Avatar */}
        <div className="my-12 relative flex items-center justify-center z-10 select-none">
          {/* Decorative Waves */}
          <div className="absolute w-36 h-36 bg-blue-100 rounded-[48px] animate-ping opacity-60 pointer-events-none" />
          <div className="absolute w-44 h-44 bg-blue-50 rounded-[56px] animate-[ping_3s_linear_infinite] opacity-40 pointer-events-none" />
          
          <div className="relative">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt={name} 
                className="w-32 h-32 rounded-[40px] object-cover shadow-2xl border-4 border-white relative z-10" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-32 h-32 rounded-[40px] bg-gradient-to-br from-blue-400 to-blue-600 text-white font-black text-4xl flex items-center justify-center shadow-2xl border-4 border-white relative z-10">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Inbound Call Actions */}
        <div className="w-full max-w-sm bg-white/75 backdrop-blur-xl rounded-[28px] border border-white/60 p-5 mt-4 shadow-xl z-10">
          <p className="text-xs text-center text-gray-500 font-medium mb-4">
            Incoming call from {name}
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Answer Button */}
            <button 
              onClick={() => {
                setCallState('connected');
              }}
              className="flex flex-col items-center justify-center p-3.5 bg-green-50 hover:bg-green-100/85 border border-green-100 rounded-2xl cursor-pointer transition active:scale-95 group"
            >
              <div className="w-12 h-12 rounded-full bg-[#34A853] flex items-center justify-center text-white shadow-md mb-2 group-hover:scale-105 transition">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6.62,10.79C8.06,13.62 10.38,15.93 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-green-800">Answer</span>
            </button>

            {/* Decline Button */}
            <button 
              onClick={() => {
                window.speechSynthesis.cancel();
                onEndCall(0, []);
              }}
              className="flex flex-col items-center justify-center p-3.5 bg-red-50 hover:bg-red-100/85 border border-red-100 rounded-2xl cursor-pointer transition active:scale-95 group"
            >
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-md mb-2 group-hover:scale-105 transition">
                <PhoneOff className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs font-bold text-red-800 font-sans">Decline</span>
            </button>
          </div>
        </div>

        {/* Decline Dial button at bottom */}
        <button 
          onClick={() => {
            window.speechSynthesis.cancel();
            onEndCall(0, []);
          }}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl active:scale-95 transition text-white z-10 cursor-pointer"
          title="Decline"
        >
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>
    );
  }

  if (isAI && callState === 'voicemail') {
    const p = participants[0] || target;
    const name = p.name || 'AI Persona';
    const photoUrl = p.photoUrl;

    return (
      <div className="flex flex-col h-full bg-[#F1F3F5] items-center justify-between py-12 px-6 font-sans relative w-full overflow-auto text-center">
        {/* Top bar info */}
        <div className="text-center pt-4 z-10">
          <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase mb-3 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Voicemail Recorder Active
          </div>
          <h1 className="text-3xl font-black text-gray-900 leading-tight mb-1">{name}</h1>
          <p className="text-xs text-gray-400 font-semibold">{voicemailLoading ? 'Connecting...' : 'Left a voicemail greeting'}</p>
        </div>

        {/* Cassette Tape / Spinning Reels graphic */}
        <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-[32px] p-6 flex flex-col justify-between max-h-[160px] min-h-[150px] relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50 my-6">
          <div className="flex items-center justify-between text-gray-400 select-none">
            <span className="text-[10px] font-bold tracking-widest uppercase">Cassette Message Storage</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-black text-red-500">PLAYING GREETING</span>
            </div>
          </div>

          <div className="flex justify-around items-center my-2 select-none">
            <div className="w-12 h-12 rounded-full border-4 border-double border-gray-300 bg-gray-100 flex items-center justify-center animate-[spin_3s_linear_infinite]">
              <div className="w-6 h-6 rounded-full border border-gray-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-mono font-bold text-gray-600 tracking-wider">L-CH • R-CH</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-double border-gray-300 bg-gray-100 flex items-center justify-center animate-[spin_3s_linear_infinite]">
              <div className="w-6 h-6 rounded-full border border-gray-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-gray-600" />
              </div>
            </div>
          </div>

          <div className="w-full bg-red-100 rounded-full h-1.5 relative overflow-hidden mt-1">
            <div className="bg-red-500 h-full w-[40%] animate-[pulse_1.5s_infinite]" />
          </div>
        </div>

        {/* Recording message box */}
        <div className="w-full max-w-sm bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm relative grow-0 flex flex-col mb-6">
          <span className="text-[10px] font-black tracking-wider text-gray-400 uppercase mb-2 block">Greeting feed</span>
          
          {voicemailLoading ? (
            <div className="flex flex-col items-center py-6">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-white rounded-full animate-spin mb-2" />
              <p className="text-xs text-gray-400 font-semibold italic flex items-center gap-1 justify-center">
                Character is formulating voicemail greeting ...
              </p>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-gray-800 italic font-semibold p-4 rounded-2xl bg-gray-50 border border-gray-50 text-left">
              "{voicemailText}"
            </p>
          )}
        </div>

        {/* Hang Up Phone Icon */}
        <div className="flex flex-col items-center gap-3">
          <button 
            onClick={() => {
              window.speechSynthesis.cancel();
              onEndCall(0, []);
            }}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl active:scale-95 transition text-white cursor-pointer z-10"
            title="Hang Up"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
          <span className="text-[10px] text-gray-400 font-black tracking-widest uppercase">Hang Up to Save Voicemail</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row h-full bg-[#f8f9fa] relative overflow-hidden">
      <audio ref={ambientAudioRef} className="hidden" />
      <div className={`flex flex-col h-full bg-[#f8f9fa] pt-16 relative flex-1 transition-all duration-500 ${showChat ? 'translate-x-[-15%]' : ''}`}>
        
        {microphonePermissionError && (
          <div className="mx-4 my-2 p-3.5 bg-amber-50 text-amber-950 border border-amber-200 rounded-2xl flex flex-col gap-2 z-50 relative shrink-0 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span className="font-semibold text-sm text-amber-900">Microphone Permission Blocked</span>
              </div>
              <button onClick={() => setMicrophonePermissionError(false)} className="text-amber-500 hover:text-amber-700 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Standard secure features (including the microphone) are often restricted within iframes in Google AI Studio. You can still chat by text, or click the button below to launch the dialer in a safe new tab with full microphone access.
            </p>
            <div className="flex gap-2.5 mt-1">
              <button 
                onClick={() => window.open(window.location.href, '_blank')}
                className="bg-amber-600 text-white font-semibold text-xs rounded-xl px-3 py-1.5 hover:bg-amber-700 transition shadow-sm cursor-pointer"
              >
                Open in New Tab ↗
              </button>
              <button 
                onClick={() => setMicrophonePermissionError(false)} 
                className="text-amber-700 bg-amber-100 font-semibold text-xs rounded-xl px-3 py-1.5 hover:bg-amber-200 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center pt-8 z-10">
          <div className="flex items-center gap-2 mb-2">
            {callState === 'calling' && <div className="w-4 h-4 rounded-full bg-gray-400 animate-pulse" />}
            <span className="text-gray-500 font-medium">
              {callState === 'calling' ? 'Calling...' : formatTime(callDuration)}
            </span>
          </div>
          <h1 className="text-4xl text-gray-900 font-normal tracking-wide text-center px-4">{displayName}</h1>
          {isAI && (
            <p className="text-[#0B57D0] text-sm font-medium mt-2 flex items-center gap-1">
              <SparklesIcon /> Calling via Gemini Live...
            </p>
          )}
          {participants.length > 1 && (
            <div className="flex -space-x-2 mt-4">
              {participants.map((p, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-[#f8f9fa] flex items-center justify-center text-xs font-medium text-[#0B57D0] overflow-hidden">
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt="p" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (p.name || p.number || '?').charAt(0).toUpperCase()
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          <Orb isConnected={callState === 'connected'} isAI={isAI} />
          
          {showMore && (
            <AnimatePresence>
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 right-12 bg-white rounded-xl shadow-lg border border-gray-100 p-2 z-20 flex flex-col w-48"
              >
                <button 
                  onClick={() => { setShowMore(false); setShowTranscript(true); }}
                  className="text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <FileText className="w-4 h-4 text-gray-400" />
                  Live Transcript
                </button>
                <button 
                  onClick={() => { setShowMore(false); setShowAddParticipant(true); }}
                  className="text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <UserPlus className="w-4 h-4 text-gray-400" />
                  Add Call
                </button>
                <button 
                  onClick={() => { 
                    setShowMore(false); 
                    if (isRecording) handleStopRecording();
                    else handleStartRecording();
                  }}
                  className={`text-left px-4 py-3 text-sm font-medium hover:bg-gray-50 rounded-lg flex items-center gap-3 ${isRecording ? 'text-red-600' : 'text-gray-700'}`}
                >
                  {isRecording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4 text-red-500 fill-current" />}
                  {isRecording ? 'Stop Recording' : 'Record AI Call'}
                </button>
                <button 
                  onClick={() => { setShowMore(false); setShowAudioSettings(true); }}
                  className="text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                >
                  <Settings2 className="w-4 h-4 text-gray-400" />
                  Audio Settings
                </button>
                {isAI && (
                  <button 
                    onClick={() => { setShowMore(false); setShowCaptions(!showCaptions); }}
                    className="text-left px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3"
                  >
                    <Type className="w-4 h-4 text-gray-400" />
                    {showCaptions ? 'Hide Captions' : 'Show Captions'}
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {showCaptions && aiCaption && (
             <div className="absolute inset-x-8 bottom-6 z-30 flex justify-center pointer-events-none">
               <div className="bg-black/70 backdrop-blur-md text-white/90 px-5 py-3 rounded-2xl max-w-sm w-full text-center shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <p className="text-[15px] font-medium leading-snug">"{aiCaption}"</p>
               </div>
             </div>
          )}
        </div>

        <div className="pb-8 px-4 sm:px-8 flex flex-col gap-4 sm:gap-8 z-10 bg-gradient-to-t from-[#f8f9fa] via-[#f8f9fa] to-transparent shrink-0">
          <div className="flex justify-between px-2 sm:px-4 max-w-sm mx-auto w-full relative">
            <CallActionButton 
              icon={<MessageSquare />} 
              label="Chat" 
              isActive={showChat}
              onClick={() => setShowChat(!showChat)} 
            />
            <CallActionButton 
              icon={isMuted ? <MicOff /> : <Mic />} 
              label="Mute" 
              isActive={isMuted} 
              onClick={() => setIsMuted(!isMuted)} 
            />
            <CallActionButton 
              icon={<Volume2 />} 
              label="Speaker" 
              isActive={isSpeaker} 
              onClick={() => setIsSpeaker(!isSpeaker)} 
            />
            <CallActionButton 
              icon={<MoreVertical />} 
              label="More" 
              isActive={showMore}
              onClick={() => setShowMore(!showMore)} 
            />
          </div>

          <div className="flex justify-center pb-2">
            <button 
              onClick={() => onEndCall(callDuration, transcript)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#ea4335] flex items-center justify-center shadow-lg hover:bg-[#d93025] transition-colors hover:scale-105 active:scale-95"
            >
              <PhoneOff className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-current" />
            </button>
          </div>
        </div>
      </div>

      {/* Side Chat Window */}
      <AnimatePresence>
        {showChat && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 w-[80%] max-w-[320px] bg-white shadow-2xl z-[80] border-l border-gray-100 flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#0B57D0]" /> AI Chat
              </h3>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transcript.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.speaker === 'You' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-gray-400 mb-1 ml-1 uppercase">{msg.speaker}</span>
                  <div className={`p-3 rounded-2xl max-w-[90%] text-sm ${msg.speaker === 'You' ? 'bg-[#0B57D0] text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl">
                <input 
                  type="text" 
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Text chat with AI..."
                  className="flex-1 bg-transparent px-2 outline-none text-sm"
                />
                <button 
                  onClick={handleSendMessage}
                  className={`p-2 rounded-xl bg-[#0B57D0] text-white ${!messageText.trim() ? 'opacity-50' : ''}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript Overlay */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="absolute inset-0 bg-white z-[60] flex flex-col"
          >
            <div className="flex items-center px-4 h-16 border-b border-gray-100 shrink-0">
              <button onClick={() => setShowTranscript(false)} className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xl font-medium ml-2">Live Transcript</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {transcript.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center px-8">
                  <FileText className="w-12 h-12 mb-3 opacity-20" />
                  <p>Speech will appear here in real-time as the conversation progresses.</p>
                </div>
              ) : (
                transcript.map((entry, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-[#0B57D0] uppercase tracking-wider">{entry.speaker}</span>
                      <span className="text-[10px] text-gray-400">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed bg-gray-50 p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm">{entry.text}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio Settings Overlay */}
      <AnimatePresence>
        {showAudioSettings && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="absolute inset-x-0 bottom-0 bg-white z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-6"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5" /> Audio Settings
              </h3>
              <button onClick={() => setShowAudioSettings(false)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Echo Cancellation</h4>
                  <p className="text-xs text-gray-500">Reduce feedback from speakers</p>
                </div>
                <button 
                  onClick={() => setAudioSettings(s => ({ ...s, echoCancellation: !s.echoCancellation }))}
                  className={`w-10 h-5 rounded-full relative transition-colors ${audioSettings.echoCancellation ? 'bg-[#0B57D0]' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${audioSettings.echoCancellation ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Noise Suppression</h4>
                  <p className="text-xs text-gray-500">Filter out background noise</p>
                </div>
                <button 
                  onClick={() => setAudioSettings(s => ({ ...s, noiseSuppression: !s.noiseSuppression }))}
                  className={`w-10 h-5 rounded-full relative transition-colors ${audioSettings.noiseSuppression ? 'bg-[#0B57D0]' : 'bg-gray-300'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform ${audioSettings.noiseSuppression ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {recordingBlob && (
                <button 
                  onClick={downloadRecording}
                  className="w-full flex items-center justify-center gap-2 bg-green-50 text-green-700 py-3 rounded-2xl font-medium border border-green-100 mt-4"
                >
                  <Send className="w-4 h-4 rotate-90" /> Download Last Recording
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAddParticipant && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="absolute inset-0 bg-white z-50 flex flex-col"
          >
            <div className="flex items-center px-4 h-16 border-b border-gray-100">
              <button onClick={() => setShowAddParticipant(false)} className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-xl font-medium ml-2">Add to call</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <div className="bg-gray-100 rounded-full flex items-center px-4 py-2 mb-4">
                <Search className="w-4 h-4 text-gray-500 mr-2" />
                <input type="text" placeholder="Search contacts" className="bg-transparent outline-none flex-1 text-sm text-gray-700" />
              </div>
              <div className="space-y-4">
                {contactsList.map(c => (
                  <div key={c.id} onClick={() => handleAddParticipant(c)} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                     <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-white font-medium overflow-hidden ${c.isAI ? 'bg-gradient-to-br from-blue-400 to-[#0B57D0]' : 'bg-gray-400'}`}>
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          (c.name || '?').charAt(0).toUpperCase()
                        )}
                     </div>
                     <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{c.name}</span>
                          {c.isAI && <SparklesIcon />}
                        </div>
                        <span className="text-xs text-gray-500">{c.number}</span>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-40 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full text-sm font-medium shadow-xl z-50 whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CallActionButton({ icon, label, isActive, onClick }: { icon: ReactNode; label: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 relative">
      <button 
        onClick={onClick}
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-gray-200 flex items-center justify-center shadow-sm transition-colors ${isActive ? 'bg-[#D3E3FD] text-[#0B57D0] border-[#0B57D0]' : 'bg-white text-gray-700 active:bg-gray-100'}`}
      >
        <div className="w-5 h-5 sm:w-6 sm:h-6">{icon}</div>
      </button>
      <span className="text-[11px] sm:text-sm font-medium text-gray-600">{label}</span>
    </div>
  );
}

function Orb({ isConnected, isAI }: { isConnected: boolean, isAI: boolean }) {
  if (isAI) {
    return (
      <div className="relative w-64 h-64 flex items-center justify-center">
        {isConnected ? (
          <>
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#FFD54F] via-[#4285F4] to-[#f8f9fa] mix-blend-multiply opacity-80"
              animate={{
                scale: [1, 1.2, 0.9, 1.1, 1],
                rotate: [0, 90, 180, 270, 360],
              }}
              transition={{
                duration: 4,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
            <motion.div
              className="absolute inset-4 rounded-full bg-gradient-to-bl from-[#34A853] via-[#EA4335] to-transparent mix-blend-screen opacity-70"
              animate={{
                scale: [1.1, 0.9, 1.2, 0.95, 1.1],
                rotate: [360, 270, 180, 90, 0],
              }}
              transition={{
                duration: 5,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
            <motion.div
              className="absolute inset-8 rounded-full bg-white shadow-[0_0_40px_rgba(66,133,244,0.6)]"
              animate={{
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{
                duration: 2,
                ease: 'easeInOut',
                repeat: Infinity,
              }}
            />
          </>
        ) : (
          <motion.div
            className="absolute inset-16 rounded-full bg-blue-100 shadow-[0_0_20px_rgba(66,133,244,0.3)]"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-48 h-48 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
      <User className="w-24 h-24 text-gray-400" />
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}
