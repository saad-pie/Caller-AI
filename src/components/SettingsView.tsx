import { ArrowLeft, Bell, Shield, Database, Sparkles, Clock, LogOut, ChevronRight, Camera, Check, Upload, CreditCard, CalendarCheck, User } from 'lucide-react';
import { useState, useEffect, useRef, type ReactNode, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { type ViewState } from '../App';
import { type UserProfile } from '../lib/db';
import { firebaseDb } from '../lib/firebaseDb';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface SettingsViewProps {
  onNavigate: (view: ViewState) => void;
  onClearHistory: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate?: (profile: UserProfile) => void;
}

export default function SettingsView({ onNavigate, onClearHistory, userProfile, onProfileUpdate }: SettingsViewProps) {
  const [profile, setProfile] = useState<UserProfile | null>(userProfile);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(userProfile?.name || '');
  const [editNumber, setEditNumber] = useState(userProfile?.number || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (userProfile) {
      setProfile(userProfile);
      setEditName(userProfile.name);
      setEditNumber(userProfile.number);
    }
  }, [userProfile]);

  const updateProfileState = (updated: UserProfile) => {
    setProfile(updated);
    onProfileUpdate?.(updated);
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    const updated = { ...profile, name: editName, number: editNumber };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
    setIsEditingProfile(false);
  };

  const handleSignOut = () => {
    signOut(auth);
  };

  const generateProfilePic = async () => {
    if (!profile) return;
    setIsGenerating(true);
    const seed = encodeURIComponent(editName.toLowerCase().replace(/\s+/g, '-'));
    const updated = { ...profile, photoUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}` };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
    setTimeout(() => setIsGenerating(false), 800);
  };

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const updated = { ...profile, photoUrl: reader.result as string };
        await firebaseDb.saveUserProfile(updated);
        updateProfileState(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleGlobalPrompt = async () => {
    if (!profile) return;
    const updated = { ...profile, globalPromptEnabled: !profile.globalPromptEnabled };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
  };

  const handleSaveGlobalPrompt = async (text: string) => {
    if (!profile) return;
    const updated = { ...profile, globalPrompt: text };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
  };

  const handleTogglePrivacy = async (key: 'shareActivity' | 'anonymousMode') => {
    if (!profile) return;
    const updated = { 
      ...profile, 
      privacySettings: { 
        ...profile.privacySettings, 
        [key]: !profile.privacySettings?.[key] 
      } 
    };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
  };

  const handleCheckIn = async () => {
    if (!profile) return;
    const updated = { ...profile, lastCheckIn: new Date().toISOString(), credits: (profile.credits || 0) + 10 };
    await firebaseDb.saveUserProfile(updated);
    updateProfileState(updated);
    showToast("Checked in! +10 credits added to your account.");
  };

  if (!profile) {
    return (
      <div className="flex flex-col h-full bg-[#f8f9fa] relative z-50 overflow-hidden">
        {/* Header Skeleton */}
        <div className="flex items-center px-4 h-16 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0 animate-pulse">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="w-24 h-5 bg-gray-200 rounded-md ml-4" />
        </div>

        <div className="flex-1 overflow-y-auto w-full pb-8 animate-pulse space-y-6">
          {/* Profile Card Skeleton */}
          <div className="bg-white p-6 border-b border-gray-100 flex items-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-1/3 h-5 bg-gray-200 rounded-md" />
              <div className="w-1/2 h-4 bg-gray-200 rounded-md" />
            </div>
          </div>

          {/* Settings Group Skeleton */}
          <div className="px-4 space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200" />
                    <div className="space-y-1.5 flex-1">
                      <div className="w-24 h-4 bg-gray-200 rounded-md" />
                      <div className="w-40 h-3 bg-gray-100 rounded-md" />
                    </div>
                  </div>
                  <div className="w-4 h-4 rounded-full bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] relative z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 h-16 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xl font-normal ml-2">Settings</span>
      </div>

      <div className="flex-1 overflow-y-auto w-full pb-8">
        {/* Profile Section */}
        <div className="bg-white p-6 mb-2 border-b border-gray-100">
          {!isEditingProfile ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div 
                  className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-medium shadow-xl shadow-blue-100 overflow-hidden"
                >
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    profile.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 leading-tight">{profile.name}</h2>
                  <p className="text-sm text-gray-500 font-medium">{profile.number || profile.email}</p>
                </div>
                <button onClick={() => setIsEditingProfile(true)} className="text-[#0B57D0] text-sm font-bold hover:bg-blue-50 px-4 py-2 rounded-2xl transition-colors shrink-0">
                  Edit
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50/50 p-4 rounded-[24px] border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-[#0B57D0]" />
                    <span className="text-[10px] font-bold text-[#0B57D0] uppercase tracking-wider">Credits</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{profile.credits || 0}</div>
                  <button className="text-[10px] font-bold text-[#0B57D0] mt-1 hover:underline">Recharge Now</button>
                </div>
                <div className="bg-green-50/50 p-4 rounded-[24px] border border-green-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CalendarCheck className="w-4 h-4 text-green-600" />
                    <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Daily Goal</span>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    {profile.lastCheckIn ? 'Completed' : 'Pending'}
                  </div>
                  <button 
                    onClick={handleCheckIn}
                    disabled={!!profile.lastCheckIn && new Date(profile.lastCheckIn).toDateString() === new Date().toDateString()}
                    className={`text-[10px] font-bold mt-1 uppercase ${profile.lastCheckIn && new Date(profile.lastCheckIn).toDateString() === new Date().toDateString() ? 'text-gray-400' : 'text-green-600 underline'}`}
                  >
                    Check In Now
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-2">
                <div 
                  className="w-16 h-16 rounded-full bg-gray-100 flex flex-col items-center justify-center text-gray-500 overflow-hidden relative"
                >
                  {profile.photoUrl ? (
                    <img src={profile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Camera className="w-6 h-6 mb-0.5" />
                  )}
                  {isGenerating && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-[#0B57D0] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={generateProfilePic}
                    className="text-xs text-[#0B57D0] font-medium bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 whitespace-nowrap"
                  >
                    Generate AI Avatar
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-gray-600 font-medium bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 whitespace-nowrap"
                  >
                    Upload Photo
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Display Name</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Phone Number</label>
                <input 
                  type="text" 
                  value={editNumber}
                  onChange={e => setEditNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsEditingProfile(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                <button onClick={handleSaveProfile} className="px-4 py-2 text-sm font-medium text-white bg-[#0B57D0] hover:bg-blue-700 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-4 space-y-6">
          {/* AI Preferences */}
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-3 ml-2">AI Preferences</h3>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <SettingsToggle 
                icon={<Sparkles className="w-5 h-5 text-blue-500" />}
                title="Global Context Prompt"
                description="Apply same instruction prompt for all AI personas"
                checked={!!profile.globalPromptEnabled}
                onChange={handleToggleGlobalPrompt}
              />
              
              {profile.globalPromptEnabled && (
                <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2">
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">Templates</label>
                  <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                    <button onClick={() => handleSaveGlobalPrompt("Reply concisely. Keep calls under 1 minute. ")} className="shrink-0 text-xs bg-blue-50 text-[#0B57D0] px-3 py-1.5 rounded-full border border-blue-100 font-medium">Concise</button>
                    <button onClick={() => handleSaveGlobalPrompt("Be highly analytical and factual. ")} className="shrink-0 text-xs bg-blue-50 text-[#0B57D0] px-3 py-1.5 rounded-full border border-blue-100 font-medium">Analytical</button>
                    <button onClick={() => handleSaveGlobalPrompt("Act as a polite, empathetic friend. ")} className="shrink-0 text-xs bg-blue-50 text-[#0B57D0] px-3 py-1.5 rounded-full border border-blue-100 font-medium">Empathetic</button>
                    <button onClick={() => handleSaveGlobalPrompt("Use dark humor and occasional sarcasm. ")} className="shrink-0 text-xs bg-blue-50 text-[#0B57D0] px-3 py-1.5 rounded-full border border-blue-100 font-medium">Sarcastic</button>
                  </div>
                  
                  <label className="block text-xs font-semibold tracking-wide text-gray-500 uppercase mb-2">System Instructions</label>
                  <textarea 
                    value={profile.globalPrompt || ''}
                    onChange={e => handleSaveGlobalPrompt(e.target.value)}
                    placeholder="Enter global system instructions that apply to all AIs..."
                    className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl p-3 outline-none focus:border-[#0B57D0] text-sm resize-none"
                  />
                </div>
              )}

              <div className="h-px bg-gray-100 ml-12" />
              <SettingsToggle 
                icon={<Clock className="w-5 h-5 text-purple-500" />}
                title="Proactive Dialogue"
                description="Allow AIs to initiate calls independently"
                checked={true}
                onChange={() => {}}
              />
              <div className="h-px bg-gray-100 ml-12" />
              <SettingsItem 
                icon={<Bell className="w-5 h-5 text-orange-500" />}
                title="Scheduling & Check-ins"
                description="Manage AI call frequencies"
                onClick={() => {
                  showToast("Scheduling is configured per AI contact. Redirecting to Contacts...");
                  setTimeout(() => onNavigate('home'), 1500);
                }}
              />
            </div>
          </div>

          {/* Privacy & Data */}
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-3 ml-2">Privacy & Transparency</h3>
            <div className="bg-white rounded-[24px] border border-gray-200 overflow-hidden">
              <SettingsToggle 
                icon={<Shield className="w-5 h-5 text-green-500" />}
                title="Share Call Activity"
                description="Allow AI to improve based on anonymized logs"
                checked={!!profile.privacySettings?.shareActivity}
                onChange={() => handleTogglePrivacy('shareActivity')}
              />
              <div className="h-px bg-gray-100 ml-12" />
              <SettingsToggle 
                icon={<User className="w-5 h-5 text-gray-500" />}
                title="Anonymous Mode"
                description="Hide your phone number from AI agents"
                checked={!!profile.privacySettings?.anonymousMode}
                onChange={() => handleTogglePrivacy('anonymousMode')}
              />
            </div>
          </div>

          {/* Storage */}
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase mb-3 ml-2">Storage</h3>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button 
                onClick={() => {
                  onClearHistory();
                  showToast("Call history cleared!");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="p-2 rounded-full bg-red-50 text-red-600">
                  <Database className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-medium text-red-600">Clear Call History</span>
                  <span className="block text-xs text-gray-500">Delete all local call records</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 mt-8 mb-4 pb-12">
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-100 text-red-500 py-4 rounded-[24px] font-bold hover:bg-red-50 transition-colors shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/95 text-white text-xs px-5 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 max-w-[90%] whitespace-normal leading-normal text-center"
          >
            <span className="font-medium">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsItem({ icon, title, description, onClick }: { icon: ReactNode, title: string, description: string, onClick?: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
    </button>
  );
}

function SettingsToggle({ icon, title, description, checked = false, onChange }: { icon: ReactNode, title: string, description: string, checked?: boolean, onChange?: () => void }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white">
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 pr-2">
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{description}</span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0B57D0]"></div>
      </label>
    </div>
  );
}
