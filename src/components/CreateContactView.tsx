import { ArrowLeft, User, Camera, Clock, Check, Upload, Sliders, Link as LinkIcon } from 'lucide-react';
import { useState, useRef, type ChangeEvent } from 'react';
import { type ViewState } from '../App';
import { type Contact } from '../lib/db';
import { GoogleGenAI } from '@google/genai';

interface CreateContactViewProps {
  onNavigate: (view: ViewState) => void;
  onSave: (contact: Omit<Contact, 'id' | 'userId'>) => void;
  initialContact?: Contact | null;
}

export default function CreateContactView({ onNavigate, onSave, initialContact }: CreateContactViewProps) {
  const [name, setName] = useState(initialContact?.name || '');
  const [number, setNumber] = useState(initialContact?.number || '');
  const [persona, setPersona] = useState(initialContact?.personaDescription || '');
  const [voice, setVoice] = useState(initialContact?.voice || 'Puck');
  const [pitch, setPitch] = useState(1.0);
  const [speed, setSpeed] = useState(1.0);
  const [emotion, setEmotion] = useState('Neutral');
  const [scheduleEnabled, setScheduleEnabled] = useState(!!initialContact?.proactiveSchedule);
  const [schedule, setSchedule] = useState(initialContact?.proactiveSchedule || 'every 4 hours');
  const [sendMessageEnabled, setSendMessageEnabled] = useState(initialContact?.settings?.sendMessageEnabled ?? true);
  const [googleSearchEnabled, setGoogleSearchEnabled] = useState(initialContact?.settings?.googleSearchEnabled ?? true);
  const [recordingEnabled, setRecordingEnabled] = useState(initialContact?.settings?.recordingEnabled ?? true);
  const [photoUrl, setPhotoUrl] = useState(initialContact?.photoUrl || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [publishToCommunity, setPublishToCommunity] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const VOCIES = [
    'Aoede', 'Charon', 'Fenrir', 'Kore', 'Leda', 'Puck'
  ];

  const handleGeneratePic = async () => {
    if (!name.trim()) {
      setInlineError("Please enter a name first to generate an avatar!");
      setTimeout(() => setInlineError(''), 4000);
      return;
    }
    setInlineError('');
    setIsGenerating(true);
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("No API Key");
      
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `A highly detailed, professional, and visually striking portrait avatar for a character named "${name}". ${persona ? `Their description is: ${persona}.` : ''} The portrait should be centered, clean background, suitable for a profile picture.`;
      
      const response = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "1:1",
        }
      });
      
      const base64 = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64) {
        setPhotoUrl(`data:image/jpeg;base64,${base64}`);
      } else {
        throw new Error("No image generated");
      }
    } catch (err: any) {
      console.error(err);
      setInlineError("Failed to generate image.");
      setTimeout(() => setInlineError(''), 4000);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setPhotoUrl(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (name && persona) {
      let finalNumber = number;
      if (!finalNumber) {
        // Generate a random +1 (555) number
        const randomStr = Math.floor(100 + Math.random() * 900).toString() + '-' + Math.floor(1000 + Math.random() * 9000).toString();
        finalNumber = `+1 (555) ${randomStr}`;
      }

      // Append fine-tuning to persona
      const fineTunedPersona = `${persona}\n\n[Voice Settings: Pitch=${pitch}, Speed=${speed}, Emotion=${emotion}. Please adapt your speech patterns to reflect these qualities.]`;

      const payload: any = {
        name,
        number: finalNumber,
        personaDescription: fineTunedPersona,
        voice,
        isAI: true,
        photoUrl,
        publishToCommunity,
        settings: {
          sendMessageEnabled,
          googleSearchEnabled,
          recordingEnabled
        }
      };
      
      if (scheduleEnabled && schedule) {
        payload.proactiveSchedule = schedule;
      }

      onSave(payload);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl font-normal">{initialContact ? 'Edit AI Persona' : 'Create AI Persona'}</span>
        </div>
        <button 
          onClick={handleSave}
          disabled={!name || !persona}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${name && persona ? 'bg-[#0B57D0] text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20' : 'bg-gray-100 text-gray-400'}`}
        >
          {initialContact ? 'Update' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto w-full pb-8">
        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div 
              className="w-24 h-24 rounded-full bg-[#E4E9F2] border-4 border-white shadow-sm flex items-center justify-center relative overflow-hidden group"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-8 h-8 opacity-50 text-[#0B57D0]" />
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#0B57D0] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            
            {inlineError && (
              <div className="mt-2 text-xs text-red-500 font-medium text-center animate-bounce">
                {inlineError}
              </div>
            )}
            
            <div className="flex flex-col gap-2 mt-4 items-center w-full max-w-xs">
              <div className="flex gap-2 w-full justify-center">
                <button 
                  type="button"
                  onClick={handleGeneratePic}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-[#0B57D0] rounded-full text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <SparklesIconSmall /> Generate AI Avatar
                </button>
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-100 transition-colors"
                >
                  <Upload className="w-3 h-3" /> Upload Photo
                </button>
              </div>
              <div className="flex items-center bg-gray-50 rounded-full px-3 py-1.5 w-full border border-gray-200">
                <LinkIcon className="w-3 h-3 text-gray-400 mr-2" />
                <input 
                  type="url" 
                  placeholder="Or paste an image URL..." 
                  value={photoUrl.startsWith('data:') || photoUrl.startsWith('https://api.dicebear.com') ? '' : photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  className="bg-transparent text-xs outline-none w-full text-gray-600 placeholder-gray-400"
                />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed text-center">
            Design a specialized assistant to handle your inbound and outbound calls.
          </p>
          
          <div className="space-y-6">
            {/* Identity */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Support Agent, Receptionist" 
                    className="w-full bg-gray-100/50 border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition-colors placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Phone Number (Optional)</label>
                  <input 
                    type="text" 
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Leave blank to auto-assign" 
                    className="w-full bg-gray-100/50 border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition-colors placeholder-gray-400"
                  />
                </div>
              </div>
            </div>

            {/* AI Brain Configuration */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200/50 bg-[#F3F6FB] flex items-center gap-2">
                <SparklesIcon />
                <span className="text-sm font-medium text-[#041E49]">AI Engine</span>
              </div>
              <div className="p-4 space-y-6">
                <div>
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Voice Profile</label>
                  <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar">
                    {VOCIES.map((v) => (
                      <button 
                        key={v}
                        onClick={() => setVoice(v)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${
                          voice === v 
                          ? 'bg-[#0B57D0] text-white shadow-sm' 
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {voice === v && <Check className="w-4 h-4" />}
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase flex items-center gap-2">
                      <Sliders className="w-3 h-3" /> Voice Fine-tuning
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Pitch</span>
                        <span className="text-[10px] text-[#0B57D0] font-bold">{pitch}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="1.5" step="0.1" 
                        value={pitch} onChange={e => setPitch(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0B57D0]"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-gray-500 font-medium">Speed</span>
                        <span className="text-[10px] text-[#0B57D0] font-bold">{speed}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="2.0" step="0.1" 
                        value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#0B57D0]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Emotional Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {['Neutral', 'Excited', 'Empathetic', 'Professional', 'Sarcastic'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setEmotion(t)}
                          className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${emotion === t ? 'bg-[#0B57D0] text-white border-[#0B57D0]' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-200'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase">System Instructions</label>
                    <button className="text-xs text-[#0B57D0] font-medium flex items-center gap-1 hover:underline">
                      <SparklesIconSmall /> Use Template
                    </button>
                  </div>
                  <textarea 
                    value={persona}
                    onChange={(e) => setPersona(e.target.value)}
                    className="w-full h-32 bg-white border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition-all resize-none text-sm placeholder-gray-400 font-sans"
                    placeholder="Define the core objective, tone of voice, and any specific knowledge base constraints for this persona..."
                  />
                </div>
              </div>
            </div>

            {/* Proactive Calling */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                      <Clock className="w-4 h-4 text-[#0B57D0]" />
                    </div>
                    <div>
                      <h3 className="text-base font-medium text-gray-900">Proactive Calling</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed pr-8">Initiate outbound calls automatically.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setScheduleEnabled(!scheduleEnabled)}
                    className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${scheduleEnabled ? 'bg-[#0B57D0]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${scheduleEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {scheduleEnabled && (
                  <div className="pt-4 border-t border-gray-200 mt-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-600">Call Frequency Limit</label>
                      <span className="text-xs text-[#0B57D0] font-medium bg-[#D3E3FD] px-2 py-0.5 rounded-full">3 / week</span>
                    </div>
                    <select 
                      value={schedule}
                      onChange={(e) => setSchedule(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] text-sm mt-3"
                    >
                      <option value="every 4 hours">Scheduled (Every 4 hours)</option>
                      <option value="inactivity 24h">After Inactivity (24h)</option>
                      <option value="surprise">Random Surprise (1-2 times a week)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Feature Flags */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
               <div className="px-4 py-3 border-b border-gray-200/50 bg-[#F3F6FB] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0B57D0]" />
                <span className="text-sm font-medium text-[#041E49]">Capabilities</span>
              </div>
              <div className="p-4 space-y-4">
                <FeatureToggle 
                  label="Contextual Messaging" 
                  description="Allow AI to send text follow-ups after calls." 
                  enabled={sendMessageEnabled} 
                  onChange={setSendMessageEnabled} 
                />
                <FeatureToggle 
                  label="Live Google Search" 
                  description="Enable real-time information gathering during conversation." 
                  enabled={googleSearchEnabled} 
                  onChange={setGoogleSearchEnabled} 
                />
                <FeatureToggle 
                  label="Automatic Recording" 
                  description="Save call audio and generate transcripts automatically." 
                  enabled={recordingEnabled} 
                  onChange={setRecordingEnabled} 
                />
                <FeatureToggle 
                  label="Publish to Character Bazaar" 
                  description="Share this custom persona publicly with the general community." 
                  enabled={publishToCommunity} 
                  onChange={setPublishToCommunity} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0B57D0]">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}

function SparklesIconSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#0B57D0]">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
    </svg>
  );
}

function FeatureToggle({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1 pr-4">
        <h4 className="text-sm font-bold text-gray-900">{label}</h4>
        <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
      </div>
      <button 
        onClick={() => onChange(!enabled)}
        className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${enabled ? 'bg-[#0B57D0]' : 'bg-gray-200'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
