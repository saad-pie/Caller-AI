/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from './lib/firebase';
import { firebaseDb } from './lib/firebaseDb';
import HomeView from './components/HomeView';
import KeypadView from './components/KeypadView';
import CallView from './components/CallView';
import CreateContactView from './components/CreateContactView';
import ContactsView from './components/ContactsView';
import SettingsView from './components/SettingsView';
import CommunityView from './components/CommunityView';
import RecordingsView from './components/RecordingsView';
import AuthView from './components/AuthView';
import { type Contact, type CallRecord, type UserProfile, db } from './lib/db';
import { GoogleGenAI } from '@google/genai';
import { Phone, Users, History, Settings, Globe, FileText } from 'lucide-react';

export type ViewState = 'home' | 'keypad' | 'call' | 'create-contact' | 'contacts' | 'settings' | 'community' | 'recordings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);

  const [callTarget, setCallTarget] = useState<Contact | { number: string; name?: string; personaDescription?: string; voice?: string; isAI?: boolean; settings?: any } | null>(null);
  const [callDirection, setCallDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [notification, setNotification] = useState<{ contact: Contact; message: string; countdown?: number } | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await firebaseDb.getUserProfile(u.uid);
        setProfile(p);
        
        // Load data
        const [c, h] = await Promise.all([
          firebaseDb.getContacts(u.uid),
          firebaseDb.getCallHistory(u.uid)
        ]);
        
        if (c.length === 0) {
           // Seed defaults if empty
           await firebaseDb.saveContact(u.uid, {
            name: 'Jane (Support AI)',
            number: '+1 (555) 000-0000',
            personaDescription: 'General Help Assistant to answer app related questions. You are pleasant and professional.',
            voice: 'Aoede',
            isAI: true,
            settings: { sendMessageEnabled: true, googleSearchEnabled: true, recordingEnabled: true }
          });
          const freshContacts = await firebaseDb.getContacts(u.uid);
          setContacts(freshContacts);
        } else {
          setContacts(c);
        }
        setCallHistory(h);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Proactive Call Check
    const checkProactive = () => {
      // Don't trigger if already in a call or notification active
      if (callTarget || notification || !user) return;
      
      const aiContacts = contacts.filter(c => c.isAI && c.proactiveSchedule);
      if (aiContacts.length > 0 && Math.random() > 0.95) { // 5% chance every check for demo
        const randomAI = aiContacts[Math.floor(Math.random() * aiContacts.length)];
        setNotification({
          contact: randomAI,
          message: `${randomAI.name} is preparing a proactive check-in call...`,
          countdown: 10
        });
      }
    };

    const interval = setInterval(checkProactive, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [contacts, callTarget, notification, user]);

  useEffect(() => {
    if (notification && notification.countdown !== undefined) {
      if (notification.countdown > 0) {
        const timer = setTimeout(() => {
          setNotification(prev => prev ? { ...prev, countdown: prev.countdown! - 1 } : null);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        // Missed call when countdown hits zero
        leaveVoicemail(notification.contact);
        setNotification(null);
      }
    }
  }, [notification]);

  const startCall = (target: string | Contact, direction: 'inbound' | 'outbound' = 'outbound') => {
    let callTargetObj;
    
    if (target === 'MAGIC_AI_ROULETTE') {
      const aiContacts = contacts.filter(c => c.isAI);
      if (aiContacts.length > 0) {
        callTargetObj = aiContacts[Math.floor(Math.random() * aiContacts.length)];
      } else {
        // Fallback random fun character
        callTargetObj = {
          name: 'Mystic Oracle',
          number: '*MAGIC',
          personaDescription: 'You are a mysterious oracle. You speak in riddles, predict silly futures, and are highly entertaining.',
          voice: 'Puck',
          isAI: true
        } as any;
      }
    } else if (typeof target === 'string') {
      const existingContact = contacts.find(c => c.number === target || c.name === target);
      callTargetObj = existingContact || { 
        number: target, 
        name: 'Unknown Number',
        personaDescription: 'General Assistant: Professional, efficient, and helpful.',
        voice: 'Aoede',
        isAI: false
      } as any; // Using any here to allow arbitrary un-saved contacts with AI properties for fallback
    } else {
      callTargetObj = target;
    }
    
    setCallDirection(direction);
    setCallTarget(callTargetObj);
    setCurrentView('call');
  };

  const endCall = async (duration: number, transcript?: any, audioBlob?: Blob) => {
    if (callTarget && user) {
      const number = 'number' in callTarget ? callTarget.number : (callTarget as any).number || 'Unknown';
      const contactId = 'id' in callTarget ? (callTarget as Contact).id : undefined;
      const contactName = 'name' in callTarget ? (callTarget as Contact).name : 'Unknown';
      
      let recordingId = undefined;
      if (transcript && transcript.length > 0) {
        const rec = await firebaseDb.addRecording(user.uid, {
          callId: 'temp',
          transcript,
          createdAt: Date.now()
        });
        recordingId = rec.id;
      }

      let type: 'missed' | 'outgoing' | 'incoming' = 'outgoing';
      if (callDirection === 'inbound') {
         type = duration > 0 ? 'incoming' : 'missed';
      }
      
      const payload: any = {
        contactName,
        number,
        timestamp: Date.now(),
        duration,
        type
      };
      
      if (contactId) payload.contactId = contactId;
      if (recordingId) payload.recordingId = recordingId;

      const newRecord = await firebaseDb.addCallRecord(user.uid, payload);
      
      setCallHistory([newRecord, ...callHistory]);
      
      // Deduct credits
      if (profile) {
        await firebaseDb.updateCredits(user.uid, -Math.ceil(duration / 60)); // 1 credit per minute
        const updatedProfile = await firebaseDb.getUserProfile(user.uid);
        setProfile(updatedProfile);
      }
    }
    
    setCallTarget(null);
    setCurrentView('home');
  };

  const leaveVoicemail = async (contact: Contact) => {
    if (!user) return;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("No Gemini API key defined for voicemail generation");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are answering a voicemail as the persona: "${contact.name}".
Character details: "${contact.personaDescription || 'A helpful person.'}".
Provide a short, immersive character-consistent voicemail message (approx 30-50 words) telling them you are busy and missed their proactive call check-in.
Do NOT include any stage directions, narrator descriptions, prefixes, or quotes. Just output the spoken characters directly.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });

      const text = response.text?.trim() || `Hey! This is ${contact.name}. Sorry I missed you, call me back!`;
      
      const payload = {
        userId: user.uid,
        contactId: contact.id || Date.now().toString(),
        contactName: contact.name,
        photoUrl: contact.photoUrl || '',
        timestamp: Date.now(),
        duration: Math.max(10, Math.round(text.split(' ').length * 0.45)),
        transcriptText: text,
        voice: contact.voice || 'Aoede',
        isPlayed: false
      };

      // Save locally
      db.addVoicemail(payload);

      // Save to Firestore
      await firebaseDb.addVoicemail(user.uid, payload);
    } catch (e) {
      console.error("Proactive voicemail generation failed:", e);
    }
  };

  const handleCreateContact = async (contactData: Omit<Contact, 'id' | 'userId'> & { publishToCommunity?: boolean }) => {
    if (user) {
      const { publishToCommunity, ...rest } = contactData;
      
      if (editingContact) {
        await firebaseDb.updateContact(user.uid, editingContact.id, rest);
        setEditingContact(null);
      } else {
        const newContact = await firebaseDb.saveContact(user.uid, rest);
        
        if (publishToCommunity) {
          try {
            const creatorName = profile?.name || user.displayName || user.email?.split('@')[0] || 'Anonymous';
            await firebaseDb.addCommunityContact({
              creatorId: user.uid,
              creatorName,
              name: contactData.name,
              number: newContact.number,
              personaDescription: contactData.personaDescription,
              voice: contactData.voice,
              photoUrl: contactData.photoUrl || ''
            });
          } catch (err) {
            console.error("Failed to automatically publish to community:", err);
          }
        }
      }

      setContacts(await firebaseDb.getContacts(user.uid));
      setCurrentView('contacts');
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setCurrentView('create-contact');
  };

  const handleClearHistory = async () => {
    // For now history is cleared in settings via direct firebase call if needed
    setCallHistory([]);
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto h-screen bg-[#F3F6FB] flex flex-col relative overflow-hidden font-sans shadow-2xl sm:border sm:border-gray-200 sm:rounded-3xl sm:h-[844px] sm:my-10 pt-12 px-4 space-y-5">
        {/* Skeletal Search Bar */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="bg-gray-200 h-11 rounded-full flex-1" />
          <div className="bg-gray-200 w-10 h-10 rounded-full" />
        </div>

        {/* Skeletal Tabs */}
        <div className="flex gap-2 pb-1 overflow-x-auto animate-pulse">
          <div className="bg-gray-200 h-8 w-20 rounded-full shrink-0" />
          <div className="bg-gray-200 h-8 w-24 rounded-full shrink-0" />
          <div className="bg-gray-200 h-8 w-16 rounded-full shrink-0" />
          <div className="bg-gray-200 h-8 w-20 rounded-full shrink-0" />
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Skeletal Favourites Section */}
          <div className="animate-pulse border-b border-gray-200 pb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="bg-gray-200 h-4 w-24 rounded-md" />
              <div className="bg-gray-200 h-4 w-10 rounded-md" />
            </div>
            <div className="flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="w-14 h-14 bg-gray-200 rounded-full mb-2" />
                  <div className="bg-gray-200 h-3 w-12 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          {/* Skeletal Recent Calls */}
          <div className="space-y-4 animate-pulse">
            <div className="bg-gray-200 h-4 w-16 rounded-md mb-2" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-12 h-12 bg-gray-200 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="bg-gray-300/40 h-4 w-1/3 rounded-md" />
                    <div className="bg-gray-200 h-3 w-1/4 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-md mx-auto h-screen sm:h-[800px] bg-white sm:rounded-3xl shadow-2xl overflow-hidden sm:my-10">
        <AuthView />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-[#F3F6FB] flex flex-col relative overflow-hidden font-sans shadow-2xl sm:border sm:border-gray-200 sm:rounded-3xl sm:h-[844px] sm:my-10">
      <div className={`flex-1 overflow-hidden flex flex-col ${currentView !== 'call' ? 'pb-24' : 'pb-0'}`}>
        {currentView === 'home' && (
          <HomeView 
            contacts={contacts} 
            callHistory={callHistory}
            onNavigate={setCurrentView} 
            onCall={startCall} 
            userProfile={profile}
          />
        )}
        
        {currentView === 'keypad' && (
          <KeypadView 
            onNavigate={setCurrentView} 
            onCall={(num) => startCall(num)} 
          />
        )}
        
        {currentView === 'contacts' && (
          <ContactsView 
            contacts={contacts} 
            onNavigate={(v) => {
              if (v === 'create-contact') setEditingContact(null);
              setCurrentView(v);
            }} 
            onCall={(c) => startCall(c)}
            onEdit={handleEditContact}
          />
        )}

        {currentView === 'call' && callTarget && (
          <CallView 
            target={callTarget as any} 
            onEndCall={endCall} 
            direction={callDirection}
          />
        )}

        {currentView === 'create-contact' && (
          <CreateContactView 
            onNavigate={(v) => {
              setEditingContact(null);
              setCurrentView(v);
            }}
            onSave={handleCreateContact}
            initialContact={editingContact}
          />
        )}
        {currentView === 'settings' && (
          <SettingsView 
            onNavigate={setCurrentView}
            onClearHistory={handleClearHistory}
            userProfile={profile}
            onProfileUpdate={setProfile}
          />
        )}
        {currentView === 'community' && (
          <CommunityView 
            onNavigate={setCurrentView}
            onCall={startCall}
          />
        )}
        {currentView === 'recordings' && (
          <RecordingsView 
            onBack={() => setCurrentView('home')}
          />
        )}
      </div>

      {/* Navigation Bar */}
      {currentView !== 'call' && (
        <div className="absolute bottom-6 left-6 right-6 h-16 bg-white/80 backdrop-blur-xl border border-white/50 rounded-[28px] shadow-2xl flex items-center justify-around px-2 z-50">
          <NavBtn active={currentView === 'home'} icon={<History className="w-5 h-5" />} label="Recent" onClick={() => { setEditingContact(null); setCurrentView('home'); }} />
          <NavBtn active={currentView === 'contacts'} icon={<Users className="w-5 h-5" />} label="Contacts" onClick={() => { setEditingContact(null); setCurrentView('contacts'); }} />
          <NavBtn active={currentView === 'keypad'} icon={<Phone className="w-5 h-5" />} label="Keypad" onClick={() => { setEditingContact(null); setCurrentView('keypad'); }} />
          <NavBtn active={currentView === 'community'} icon={<Globe className="w-5 h-5" />} label="Public" onClick={() => { setEditingContact(null); setCurrentView('community'); }} />
          <NavBtn active={currentView === 'recordings'} icon={<FileText className="w-5 h-5" />} label="Library" onClick={() => { setEditingContact(null); setCurrentView('recordings'); }} />
          <NavBtn active={currentView === 'settings'} icon={<Settings className="w-5 h-5" />} label="Profile" onClick={() => { setEditingContact(null); setCurrentView('settings'); }} />
        </div>
      )}

      {/* Proactive Call Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="absolute top-6 left-6 right-6 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 p-5 z-[100] ring-4 ring-blue-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center overflow-hidden shrink-0 shadow-lg relative">
                {notification.contact.photoUrl ? (
                  <img src={notification.contact.photoUrl} alt="p" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-white text-xl font-bold">{notification.contact.name.charAt(0)}</span>
                )}
                {notification.countdown !== undefined && (
                  <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                    <div className="w-full h-full border-4 border-blue-200 border-t-white rounded-full animate-spin opacity-40 shrink-0" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Scheduled Call Incoming</h4>
                  {notification.countdown !== undefined && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      Starting in {notification.countdown}s
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight truncate">{notification.contact.name}</h3>
                <p className="text-xs text-gray-500 line-clamp-1">Proactive check-in scheduled for today.</p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button 
                  onClick={() => {
                    startCall(notification.contact);
                    setNotification(null);
                  }}
                  className="bg-[#34A853] text-white px-6 py-2.5 rounded-2xl text-xs font-bold shadow-md hover:bg-[#2d9648] transition-colors whitespace-nowrap"
                >
                  Answer Now
                </button>
                <button 
                  onClick={() => {
                    leaveVoicemail(notification.contact);
                    setNotification(null);
                  }}
                  className="bg-gray-50 text-gray-500 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center transition-all px-1 py-1 rounded-xl flex-1 ${active ? 'text-[#0B57D0]' : 'text-gray-400'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-blue-100 shadow-sm' : 'hover:bg-gray-100'}`}>
        {icon}
      </div>
      <span className={`text-[8px] font-extrabold mt-1 uppercase tracking-wider transition-all truncate w-full text-center ${active ? 'opacity-100' : 'opacity-60'}`}>
        {label}
      </span>
    </button>
  );
}
