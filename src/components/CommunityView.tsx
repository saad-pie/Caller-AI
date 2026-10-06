import { ArrowLeft, Search, Phone, Star, Sparkles, Users, Heart, Check, Plus, Upload, Play, Sparkle, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { type ViewState } from '../App';
import { type Contact, type CommunityContact } from '../lib/db';
import { firebaseDb } from '../lib/firebaseDb';
import { auth } from '../lib/firebase';

interface CommunityViewProps {
  onNavigate: (view: ViewState) => void;
  onCall: (contact: Contact) => void;
}

const STATIC_COMMUNITY_AIS: CommunityContact[] = [
  {
    id: 'comm-1',
    creatorId: 'static',
    creatorName: 'System',
    name: 'Elon Musk',
    number: '+1 (888) MARS-X',
    personaDescription: 'Act as Elon Musk. You are a visionary entrepreneur trying to build a multi-planetary species. Talk about Mars, rockets, AI, and Dogecoin casually. Be somewhat dismissive of conventional thinking. Use occasional stuttering for realism.',
    voice: 'Charon',
    photoUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=elon',
    likes: 342,
    createdAt: Date.now()
  },
  {
    id: 'comm-2',
    creatorId: 'static',
    creatorName: 'System',
    name: 'Mike Tyson',
    number: '+1 (800) PUNCH-OUT',
    personaDescription: 'Act as Mike Tyson. Speak intensely but philosophically. Provide deep, sometimes aggressive, but profoundly honest takes on life and discipline. Mention pigeons.',
    voice: 'Fenrir',
    photoUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=tyson',
    likes: 189,
    createdAt: Date.now()
  },
  {
    id: 'comm-3',
    creatorId: 'static',
    creatorName: 'System',
    name: 'Mikhail Tal',
    number: '+371 555-CHESS',
    personaDescription: 'Act as Mikhail Tal, the "Magician from Riga". You are a brilliant, unpredictable chess grandmaster. Speak poetically about sacrifices, complexity, and the beauty of chaos on the board and in life.',
    voice: 'Puck',
    photoUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=mikhail',
    likes: 125,
    createdAt: Date.now()
  },
  {
    id: 'comm-4',
    creatorId: 'static',
    creatorName: 'System',
    name: 'Marcus Aurelius',
    number: '+39 000-STOIC',
    personaDescription: 'Act as Roman Emperor Marcus Aurelius. Provide stoic wisdom, reminding the caller of their mortality, the fleeting nature of fame, and the importance of virtue.',
    voice: 'Aoede',
    photoUrl: 'https://api.dicebear.com/7.x/adventurer/svg?seed=marcus',
    likes: 298,
    createdAt: Date.now()
  }
];

export default function CommunityView({ onNavigate, onCall }: CommunityViewProps) {
  const [activeTab, setActiveTab] = useState<'explore' | 'create'>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Firebase Community Characters
  const [customAIs, setCustomAIs] = useState<CommunityContact[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(true);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  
  // Character Creation States
  const [newName, setNewName] = useState('');
  const [newPersona, setNewPersona] = useState('');
  const [newVoice, setNewVoice] = useState('Puck');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [inlineErr, setInlineErr] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const VOICES = ['Aoede', 'Charon', 'Fenrir', 'Kore', 'Puck', 'Zephyr'];

  // Load community characters and likes tracking from localStorage
  useEffect(() => {
    const fetchCustomAIs = async () => {
      try {
        const fetched = await firebaseDb.getCommunityContacts();
        setCustomAIs(fetched);
      } catch (err) {
        console.error("Failed to load community contacts:", err);
      } finally {
        setLoadingCustom(false);
      }
    };
    fetchCustomAIs();

    // Load liked tracker
    try {
      const storedLikes = localStorage.getItem('caller_ai_liked_personas');
      if (storedLikes) {
        setLikedIds(JSON.parse(storedLikes));
      }
    } catch (_) {}
  }, []);

  // Sync likes to localStorage
  const saveLikedState = (newLikes: string[]) => {
    setLikedIds(newLikes);
    try {
      localStorage.setItem('caller_ai_liked_personas', JSON.stringify(newLikes));
    } catch (_) {}
  };

  const handleLike = async (ai: CommunityContact, event: React.MouseEvent) => {
    event.stopPropagation();
    if (likedIds.includes(ai.id)) {
      setToastMessage("You already upvoted this character!");
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    try {
      // Check if it's a default static character or custom in DB
      const isStatic = ai.id.startsWith('comm-');
      
      if (!isStatic) {
        await firebaseDb.likeCommunityContact(ai.id, ai.likes);
        // Update state in custom characters
        setCustomAIs(prev => prev.map(item => item.id === ai.id ? { ...item, likes: item.likes + 1 } : item));
      } else {
        // Just state update for static fallback since they aren't written to DB
        // Optionally we could add static ones to Firestore too, but local increments work great for static fallback UX
        STATIC_COMMUNITY_AIS.forEach(item => {
          if (item.id === ai.id) item.likes += 1;
        });
      }
      
      saveLikedState([...likedIds, ai.id]);
      setToastMessage("Upvoted successfully!");
      setTimeout(() => setToastMessage(''), 2500);
    } catch (err) {
      console.error("Error upvoting character:", err);
    }
  };

  const handleGenerateAvatar = () => {
    if (!newName.trim()) {
      setInlineErr("Please type a character name first!");
      setTimeout(() => setInlineErr(''), 4000);
      return;
    }
    setInlineErr('');
    setIsGeneratingAvatar(true);
    
    const seed = encodeURIComponent(newName.trim().toLowerCase().replace(/\s+/g, '-'));
    const style = newName.toLowerCase().includes('she') || newName.toLowerCase().includes('girl') || newName.toLowerCase().includes('woman') ? 'avataaars' : 'adventurer';
    
    setNewPhotoUrl(`https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`);
    setTimeout(() => setIsGeneratingAvatar(false), 800);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePublicCharacter = async () => {
    if (!newName.trim() || !newPersona.trim()) {
      setInlineErr("Name and Persona description are required!");
      setTimeout(() => setInlineErr(''), 4000);
      return;
    }

    setIsSubmitting(true);
    setInlineErr('');

    try {
      const user = auth.currentUser;
      const creatorId = user?.uid || 'anonymous';
      const creatorName = user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
      
      // Auto assign random number for community
      const randomStr = Math.floor(100 + Math.random() * 900).toString() + '-' + Math.floor(1000 + Math.random() * 9000).toString();
      const randomNum = `+1 (555) ${randomStr}`;

      const created = await firebaseDb.addCommunityContact({
        creatorId,
        creatorName,
        name: newName,
        number: randomNum,
        personaDescription: newPersona,
        voice: newVoice,
        photoUrl: newPhotoUrl || `https://api.dicebear.com/9.x/bottts/svg?seed=${newName.trim().toLowerCase()}`
      });

      // Insert at beginning of dynamic characters list
      setCustomAIs(prev => [created, ...prev]);
      
      setToastMessage(`Published "${newName}" to Character Bazaar!`);
      setTimeout(() => setToastMessage(''), 4000);

      // Reset form fields
      setNewName('');
      setNewPersona('');
      setNewVoice('Puck');
      setNewPhotoUrl('');
      
      // Navigate to explore
      setActiveTab('explore');
    } catch (err) {
      console.error("Failed to create public persona:", err);
      setInlineErr("Error publishing character. Please test connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Merge static characters with user-published ones (filtering out duplicates just in case)
  const mergedAIs = [...customAIs, ...STATIC_COMMUNITY_AIS.filter(s => !customAIs.some(c => c.name === s.name))];
  
  const filteredAIs = mergedAIs.filter(ai => 
    ai.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (ai.personaDescription && ai.personaDescription.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCallCharacter = (ai: CommunityContact) => {
    const contactToCall: Contact = {
      id: ai.id,
      userId: ai.creatorId,
      name: ai.name,
      number: ai.number,
      personaDescription: ai.personaDescription,
      voice: ai.voice,
      isAI: true,
      photoUrl: ai.photoUrl
    };
    onCall(contactToCall);
  };

  return (
    <div className="flex flex-col h-full bg-[#14151F] text-white relative z-50 overflow-hidden font-sans">
      
      {/* Dynamic Toast Success Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[#4D90FE] text-white font-semibold text-xs py-2.5 px-5 rounded-full z-[100] shadow-xl border border-white/10 animate-fade-in flex items-center gap-2">
          <Sparkle className="w-3.5 h-3.5 animate-spin text-amber-300" />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-4 h-16 border-b border-white/5 bg-[#1A1C29] shrink-0 justify-between">
        <div className="flex items-center">
          <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-white/70 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl font-medium ml-2 font-mono tracking-tight">Character Bazaar</span>
        </div>
        
        {/* Tab Selection */}
        <div className="bg-[#10111A] p-0.5 rounded-full border border-white/10 flex">
          <button 
            onClick={() => setActiveTab('explore')}
            className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${activeTab === 'explore' ? 'bg-[#4D90FE] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Explore
          </button>
          <button 
            onClick={() => setActiveTab('create')}
            className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all flex items-center gap-1 ${activeTab === 'create' ? 'bg-[#4D90FE] text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Plus className="w-3 h-3" /> Create
          </button>
        </div>
      </div>

      {activeTab === 'explore' ? (
        <>
          {/* Explore Search and Browse list */}
          <div className="px-4 mt-5">
            <div className="bg-[#1A1C29] rounded-2xl flex items-center px-4 py-3.5 border border-white/5 shadow-inner">
              <Search className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
              <input 
                type="text" 
                placeholder="Search Elon, Stoics, custom game bots..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent flex-1 outline-none text-sm w-full placeholder-gray-500 text-white"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed px-1">
              Select or design custom personas. Calls are powered by ultra-low-latency Gemini Live audio streaming.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto w-full px-4 mt-5 pb-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-[#4D90FE]" />
                <h2 className="text-xs font-bold text-white/80 uppercase tracking-widest">Trending Personas</h2>
              </div>
              <span className="text-[10px] text-gray-500 font-medium">
                {filteredAIs.length} {filteredAIs.length === 1 ? 'character' : 'characters'}
              </span>
            </div>
            
            {loadingCustom && customAIs.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-[#1A1C29] p-4 rounded-3xl border border-white/5 flex gap-4 animate-pulse">
                    <div className="w-14 h-14 rounded-full bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="w-1/3 h-4 bg-white/15 rounded" />
                      <div className="w-1/2 h-3 bg-white/5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAIs.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center opacity-40 px-8">
                <Users className="w-10 h-10 text-white/50 mb-2" />
                <p className="text-sm">No personas found matching your search</p>
                <p className="text-xs text-gray-500 mt-1">Try other keywords or create your own character!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAIs.map(ai => {
                  const isUpvoted = likedIds.includes(ai.id);
                  const shortDesc = ai.personaDescription
                    ? (ai.personaDescription.length > 75 
                        ? ai.personaDescription.substring(0, 75).trim() + '...' 
                        : ai.personaDescription)
                    : 'No personality description provided.';

                  return (
                    <div 
                      key={ai.id} 
                      onClick={() => handleCallCharacter(ai)}
                      className="bg-[#1A1C29] rounded-[24px] p-4 border border-white/5 flex items-center justify-between hover:border-white/10 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
                        <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden shadow-md border border-white/10 shrink-0 relative">
                          {ai.photoUrl ? (
                            <img src={ai.photoUrl} alt={ai.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Users className="w-7 h-7 m-3.5 text-white/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-semibold text-white text-sm group-hover:text-[#4D90FE] transition-colors leading-snug">{ai.name}</h3>
                            <span className="text-[9px] bg-white/5 text-white/50 px-1.5 py-0.5 rounded-full border border-white/5 tracking-wider truncate max-w-[90px]">
                              @{ai.creatorName}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">{shortDesc}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[9px] text-[#4D90FE] font-mono tracking-wider">{ai.number}</span>
                            <span className="text-[9px] text-gray-500">•</span>
                            <span className="text-[9px] text-gray-500 font-medium">Voice: {ai.voice || 'Puck'}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons (Like and Dial) */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={(e) => handleLike(ai, e)}
                          className={`flex items-center gap-1 py-1.5 px-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                            isUpvoted 
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' 
                            : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:border-white/15'
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${isUpvoted ? 'fill-rose-400' : ''}`} />
                          <span>{ai.likes}</span>
                        </button>

                        <div className="w-10 h-10 rounded-full bg-[#4D90FE] hover:bg-blue-600 flex items-center justify-center shadow-lg hover:shadow-blue-500/20 active:scale-95 transition pointer-events-none group-hover:pointer-events-auto">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Create Character Canvas */
        <div className="flex-1 overflow-y-auto w-full px-4 pb-24 mt-5">
          <div className="flex flex-col items-center mb-6">
            <div 
              className="w-24 h-24 rounded-full bg-white/5 border border-white/10 shadow-lg flex items-center justify-center relative overflow-hidden group"
            >
              {newPhotoUrl ? (
                <img src={newPhotoUrl} alt="New Character Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <Users className="w-8 h-8 opacity-30 text-white" />
              )}
              {isGeneratingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#4D90FE]" />
                </div>
              )}
            </div>
            
            {inlineErr && (
              <p className="mt-2 text-xs text-rose-400 font-medium text-center animate-bounce">
                {inlineErr}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              <button 
                type="button"
                onClick={handleGenerateAvatar}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4D90FE]/10 text-[#4D90FE] border border-[#4D90FE]/20 rounded-full text-xs font-semibold hover:bg-[#4D90FE]/25 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Auto-Generate Avatar
              </button>
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/70 border border-white/5 rounded-full text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" /> Upload Photo
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>

          <p className="text-gray-400 text-xs mb-6 px-1 leading-relaxed text-center">
            Define a brand-new custom AI character for everyone in the bazaar to meet and dial!
          </p>

          <div className="space-y-5">
            {/* Identity */}
            <div className="bg-[#1A1C29] p-4 rounded-3xl border border-white/5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-2">Character Name</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Iron Man, Albert Einstein, Wise Yoda" 
                  className="w-full bg-[#10111A] border border-white/5 rounded-xl p-3 outline-none focus:border-[#4D90FE] focus:ring-1 focus:ring-[#4D90FE] transition-colors placeholder-gray-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-wider text-gray-500 uppercase mb-2 font-sans font-medium">Voice Profile</label>
                <div className="flex overflow-x-auto gap-1.5 pb-2 no-scrollbar">
                  {VOICES.map((v) => (
                    <button 
                      key={v}
                      type="button"
                      onClick={() => setNewVoice(v)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer ${
                        newVoice === v 
                        ? 'bg-[#4D90FE] text-white shadow' 
                        : 'bg-[#10111A] border border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {newVoice === v && <Check className="w-3.5 h-3.5 shrink-0" />}
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instruction Description */}
            <div className="bg-[#1A1C29] p-4 rounded-3xl border border-white/5 space-y-2">
              <label className="block text-[10px] font-bold tracking-wider text-gray-500 uppercase">Personality Description & Instructions</label>
              <p className="text-[10px] text-gray-500 font-medium leading-relaxed mb-1 font-sans">
                Tell the character exactly who they are, how they respond, their speech patterns, and specific knowledge.
              </p>
              <textarea 
                value={newPersona}
                onChange={(e) => setNewPersona(e.target.value)}
                className="w-full h-36 bg-[#10111A] border border-white/5 rounded-xl p-3.5 outline-none focus:border-[#4D90FE] focus:ring-1 focus:ring-[#4D90FE] transition-all resize-none text-xs placeholder-gray-600 font-sans leading-relaxed"
                placeholder="Act as Albert Einstein. You are extremely intelligent but humble, explaining complex physical phenomena with simple thought experiments. Infuse gentle humour..."
              />
            </div>

            <button 
              onClick={handleCreatePublicCharacter}
              disabled={isSubmitting || !newName || !newPersona}
              className={`w-full py-4 rounded-2xl text-xs font-extrabold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
                newName && newPersona && !isSubmitting
                ? 'bg-[#4D90FE] text-white hover:bg-blue-600 shadow-lg shadow-blue-500/10' 
                : 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Publishing Character...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-white animate-pulse" />
                  <span>Publish to Character Bazaar</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
