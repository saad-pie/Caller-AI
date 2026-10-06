import { 
  ArrowLeft, 
  Play, 
  Pause,
  Download, 
  Trash2, 
  Clock, 
  Calendar, 
  Phone, 
  FileText,
  ChevronRight,
  Search,
  MoreVertical,
  Voicemail as VoicemailIcon,
  Inbox,
  Volume2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { type Recording, type Voicemail, db } from '../lib/db';
import { firebaseDb } from '../lib/firebaseDb';
import { auth } from '../lib/firebase';

export default function RecordingsView({ onBack }: { onBack: () => void }) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [activeTab, setActiveTab] = useState<'recordings' | 'voicemails'>('recordings');
  const [loading, setLoading] = useState(true);
  
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [selectedVoicemail, setSelectedVoicemail] = useState<Voicemail | null>(null);
  const [search, setSearch] = useState('');

  // Audio / Speech playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<number>(1); // 1x, 1.25x, 1.5x, 2x

  useEffect(() => {
    let isMounted = true;
    const loadLibraryData = async () => {
      setLoading(true);
      const user = auth.currentUser;
      try {
        if (user) {
          const [recs, vms] = await Promise.all([
            firebaseDb.getRecordings(user.uid),
            firebaseDb.getVoicemails(user.uid)
          ]);
          if (!isMounted) return;
          setRecordings(recs || []);
          
          // Fallback to local if empty
          if (vms && vms.length > 0) {
            setVoicemails(vms);
          } else {
            setVoicemails(db.getVoicemails());
          }
        } else {
          if (!isMounted) return;
          setRecordings([]);
          setVoicemails(db.getVoicemails());
        }
      } catch (err) {
        console.error("Failed to load recordings or voicemails:", err);
        if (isMounted) {
          setRecordings([]);
          setVoicemails(db.getVoicemails());
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadLibraryData();
    return () => {
      isMounted = false;
      // Make sure speech is stopped when exiting view
      window.speechSynthesis.cancel();
    };
  }, []);

  // Sync speech synthesis playback timer
  useEffect(() => {
    let interval: any;
    if (isPlaying && selectedVoicemail) {
      // Estimate 150 words per minute -> 2.5 words per second
      const wordCount = selectedVoicemail.transcriptText.split(/\s+/).length;
      const estimatedDuration = Math.max(8, selectedVoicemail.duration || Math.round(wordCount / (2.5 * speed)));
      const step = 100 / (estimatedDuration * 10); // 10 ticks per second
      
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsPlaying(false);
            window.speechSynthesis.cancel();
            return 100;
          }
          return prev + step;
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isPlaying, selectedVoicemail, speed]);

  const handleSelectVoicemail = async (vm: Voicemail) => {
    // Clear any previous voicemail state
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setProgress(0);
    
    setSelectedVoicemail(vm);

    // Mark as played
    if (!vm.isPlayed) {
      const updatedVms = voicemails.map(v => v.id === vm.id ? { ...v, isPlayed: true } : v);
      setVoicemails(updatedVms);

      // Save locally
      const local = db.getVoicemails().map(v => v.id === vm.id ? { ...v, isPlayed: true } : v);
      localStorage.setItem('caller_ai_voicemails', JSON.stringify(local));

      // Save in Firebase Cloud
      const user = auth.currentUser;
      if (user) {
        await firebaseDb.markVoicemailPlayed(user.uid, vm.id);
      }
    }
  };

  const handlePlayVoicemail = () => {
    if (!selectedVoicemail) return;

    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else {
      if (progress >= 100) {
        setProgress(0);
      }

      const isSpeaking = window.speechSynthesis.speaking;
      const isPaused = window.speechSynthesis.paused;

      if (progress === 0 || !isSpeaking || (isSpeaking && !isPaused && progress >= 95)) {
        window.speechSynthesis.cancel();
        
        const utter = new SpeechSynthesisUtterance(selectedVoicemail.transcriptText);
        utter.rate = speed;
        
        // Find a suitable voice
        const voices = window.speechSynthesis.getVoices();
        const voiceName = selectedVoicemail.voice || '';
        const targetVoice = voices.find(v => 
          v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
          v.lang.toLowerCase().includes(voiceName.toLowerCase())
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        
        if (targetVoice) {
          utter.voice = targetVoice;
        }

        utter.onend = () => {
          setIsPlaying(false);
          setProgress(100);
        };

        utter.onerror = () => {
          setIsPlaying(false);
        };

        window.speechSynthesis.speak(utter);
      } else if (isPaused) {
        window.speechSynthesis.resume();
      }

      setIsPlaying(true);
    }
  };

  const handleStopVoicemail = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setProgress(0);
  };

  const handleDeleteVoicemail = async (id: string) => {
    if (confirm("Are you sure you want to delete this voicemail?")) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setProgress(0);
      setSelectedVoicemail(null);

      // Remove from state
      setVoicemails(prev => prev.filter(v => v.id !== id));

      // Remove local storage
      db.deleteVoicemail(id);

      // Remove in Firebase
      const user = auth.currentUser;
      if (user) {
        await firebaseDb.deleteVoicemail(user.uid, id);
      }
    }
  };

  const downloadRecording = (r: Recording) => {
    if (r.audioUrl) {
      const a = document.createElement('a');
      a.href = r.audioUrl;
      a.download = `recording-${r.id}.webm`;
      a.click();
    }
  };

  const filteredRecordings = recordings.filter(r => 
    r.transcript.some(t => t.text.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredVoicemails = voicemails.filter(v => 
    v.contactName.toLowerCase().includes(search.toLowerCase()) ||
    v.transcriptText.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA]">
      <div className="bg-white border-b border-gray-100 px-4 h-16 flex items-center shrink-0">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold ml-2 text-gray-900">Library</h1>
      </div>

      {/* Modern Segmented Tab Switcher */}
      <div className="px-4 pt-4 shrink-0">
        <div className="bg-gray-100 p-1 rounded-2xl flex">
          <button 
            onClick={() => { setActiveTab('recordings'); setSearch(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'recordings' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Call Recordings
          </button>
          <button 
            onClick={() => { setActiveTab('voicemails'); setSearch(''); }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
              activeTab === 'voicemails' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <VoicemailIcon className="w-4 h-4" />
            Voicemails
            {voicemails.some(v => !v.isPlayed) && (
              <span className="absolute top-2 right-4 w-2.5 h-2.5 bg-[#0B57D0] rounded-full animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder={activeTab === 'recordings' ? "Search call transcripts..." : "Search voicemails..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-10 pr-4 outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Library Scrollable Records */}
      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-200 shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="bg-gray-200 h-4 w-1/4 rounded-full" />
                  <div className="bg-gray-200 h-4 w-1/2 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'recordings' ? (
          // Call Recordings List
          filteredRecordings.length === 0 ? (
            <div className="h-full py-16 flex flex-col items-center justify-center text-center opacity-40 px-12">
              <FileText className="w-16 h-16 mb-4 text-[#0B57D0]" />
              <h3 className="font-bold text-gray-900">No recordings found</h3>
              <p className="text-sm mt-1">Enable call recording to save conversations here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecordings.map(r => (
                <motion.div 
                  key={r.id}
                  layoutId={`rec-${r.id}`}
                  onClick={() => setSelectedRecording(r)}
                  className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-all group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-[#0B57D0] shrink-0">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold text-[#0B57D0] uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">Call Record</span>
                      <span className="text-[10px] text-gray-400 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-bold text-gray-900 truncate">AI Conversation</h4>
                    <p className="text-xs text-gray-500 truncate">{r.transcript.length} turns in transcript</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // Voicemails List
          filteredVoicemails.length === 0 ? (
            <div className="h-full py-16 flex flex-col items-center justify-center text-center opacity-40 px-12">
              <Inbox className="w-16 h-16 mb-4 text-[#0B57D0]" />
              <h3 className="font-bold text-gray-900">No voicemails yet</h3>
              <p className="text-sm mt-1">When an AI contact misses your call, they will leave a voicemail here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVoicemails.map(v => (
                <motion.div 
                  key={v.id}
                  layoutId={`vm-${v.id}`}
                  onClick={() => handleSelectVoicemail(v)}
                  className={`bg-white p-4 rounded-3xl shadow-sm border flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-all group ${
                    !v.isPlayed ? 'border-blue-100 font-semibold ring-1 ring-blue-50' : 'border-gray-100'
                  }`}
                >
                  <div className="relative shrink-0">
                    {v.photoUrl ? (
                      <img 
                        src={v.photoUrl} 
                        alt={v.contactName} 
                        className="w-12 h-12 rounded-2xl object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-[#0B57D0]/10 text-[#0B57D0] font-bold flex items-center justify-center">
                        {v.contactName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {!v.isPlayed && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#0B57D0] border-2 border-white rounded-full" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-gray-900 truncate text-[14px]">{v.contactName}</span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {new Date(v.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs text-[#0B57D0] font-medium mb-1">Missed Call • AI Voicemail</p>
                    <p className="text-xs text-gray-500 truncate italic">"{v.transcriptText}"</p>
                  </div>
                  
                  <div className="p-2 bg-gray-50 rounded-xl hover:bg-blue-50 text-gray-400 group-hover:text-[#0B57D0] transition">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Recording Detail Overlay */}
      <AnimatePresence>
        {selectedRecording && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="absolute inset-0 bg-white z-[70] flex flex-col"
          >
            <div className="px-4 h-16 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <button onClick={() => setSelectedRecording(null)} className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold ml-2">Recording Detail</h1>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => downloadRecording(selectedRecording)}
                  className="p-2 text-[#0B57D0] rounded-full hover:bg-blue-50"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-b from-blue-50/50 to-transparent shrink-0 border-b border-gray-50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-blue-100 flex items-center justify-center text-[#0B57D0] shadow-md">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">AI Conversation</h2>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" /> {new Date(selectedRecording.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> {new Date(selectedRecording.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Transcript</span>
              </div>
              {selectedRecording.transcript.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No text recorded.</p>
              ) : (
                selectedRecording.transcript.map((line, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${line.speaker === 'You' ? 'text-gray-500' : 'text-[#0B57D0]'}`}>{line.speaker}</span>
                      <span className="text-[10px] text-gray-300 font-medium">{new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={`text-sm leading-relaxed p-4 rounded-2xl ${line.speaker === 'You' ? 'bg-gray-100 text-gray-700' : 'bg-blue-50 text-[#0B57D0] border border-blue-100'}`}>
                      {line.text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voicemail Playback / Cassette Player Overlay */}
      <AnimatePresence>
        {selectedVoicemail && (
          <motion.div 
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="absolute inset-0 bg-[#F1F3F5] z-[70] flex flex-col"
          >
            {/* Header */}
            <div className="px-4 h-16 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center">
                <button 
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setIsPlaying(false);
                    setProgress(0);
                    setSelectedVoicemail(null);
                  }} 
                  className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold ml-2 text-gray-900">Voicemail Player</h1>
              </div>
              <button 
                onClick={() => handleDeleteVoicemail(selectedVoicemail.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                title="Delete Voicemail"
              >
                <Trash2 className="w-5.h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
              {/* Contact Card Visual */}
              <div className="flex flex-col items-center mb-8 text-center mt-4">
                <div className="relative mb-4">
                  {selectedVoicemail.photoUrl ? (
                    <img 
                      src={selectedVoicemail.photoUrl} 
                      alt={selectedVoicemail.contactName} 
                      className={`w-28 h-28 rounded-[36px] object-cover shadow-xl border-4 border-white transition-all ${
                        isPlaying ? 'scale-105 duration-700' : ''
                      }`}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-28 h-28 rounded-[36px] bg-[#0B57D0]/10 text-[#0B57D0] font-bold text-4xl flex items-center justify-center shadow-lg border-4 border-white">
                      {selectedVoicemail.contactName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isPlaying && (
                    <span className="absolute bottom-1 right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-[#0B57D0]"></span>
                    </span>
                  )}
                </div>

                <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedVoicemail.contactName}</h2>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold mt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {new Date(selectedVoicemail.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(selectedVoicemail.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Tape recorder mock */}
              <div className="w-full max-w-sm bg-white border border-gray-200 shadow-xl rounded-[32px] p-6 mb-8 flex flex-col justify-between max-h-[160px] min-h-[150px] relative overflow-hidden bg-gradient-to-br from-white to-gray-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-widest text-[#0B57D0]/40 uppercase">AI Voicemail Cassette</span>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                    <span className="text-[10px] font-black text-gray-400">{isPlaying ? 'PLAYING' : 'IDLE'}</span>
                  </div>
                </div>

                {/* Animated reels */}
                <div className="flex justify-around items-center my-2 select-none">
                  <div className={`w-12 h-12 rounded-full border-4 border-double border-gray-300 bg-gray-50 flex items-center justify-center ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                    <div className="w-6 h-6 rounded-full border border-gray-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[14px] font-mono font-bold text-gray-700 select-all">
                      {Math.round((progress / 100) * (selectedVoicemail.duration || 12))}s / {selectedVoicemail.duration || 12}s
                    </span>
                  </div>
                  <div className={`w-12 h-12 rounded-full border-4 border-double border-gray-300 bg-gray-50 flex items-center justify-center ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`}>
                    <div className="w-6 h-6 rounded-full border border-gray-400 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-gray-600" />
                    </div>
                  </div>
                </div>

                {/* Cassette Timeline Bar */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 relative overflow-hidden mt-1 select-none">
                  <div 
                    className="bg-[#0B57D0] h-full transition-all duration-100" 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>

              {/* Transcription Box with Speech Bubble style */}
              <div className="w-full max-w-sm bg-white rounded-[24px] border border-gray-100 p-5 shadow-sm relative grow-0 mb-6 flex flex-col">
                <span className="text-[10px] font-black tracking-wider text-gray-400 uppercase mb-2 block">Transcription</span>
                <p className="text-[14px] leading-relaxed text-gray-800 italic font-medium bg-gray-50/50 p-3.5 rounded-2xl border border-gray-50">
                  "{selectedVoicemail.transcriptText}"
                </p>
              </div>
            </div>

            {/* Sticky Player Control Bar (Cassette style drawer format) */}
            <div className="p-6 bg-white border-t border-gray-100 rounded-t-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.03)] shrink-0 flex flex-col gap-4">
              <div className="flex items-center justify-between max-w-xs mx-auto w-full">
                {/* Speed Multiplier Button */}
                <button 
                  onClick={() => {
                    const speeds = [1, 1.25, 1.5, 2];
                    const idx = speeds.indexOf(speed);
                    const nextSpeed = speeds[(idx + 1) % speeds.length];
                    setSpeed(nextSpeed);
                    if (isPlaying) {
                      // Restart speech synthesis with new rate smoothly
                      window.speechSynthesis.cancel();
                      setIsPlaying(false);
                      setTimeout(() => handlePlayVoicemail(), 100);
                    }
                  }}
                  className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center font-bold text-xs text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                  title="Playback Speed"
                >
                  {speed}x
                </button>

                {/* Big play button */}
                <button 
                  onClick={handlePlayVoicemail}
                  className="w-16 h-16 rounded-full bg-[#0B57D0] flex items-center justify-center shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition cursor-pointer text-white"
                  title={isPlaying ? "Pause Voicemail" : "Play Voicemail"}
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-current text-white" />
                  ) : (
                    <Play className="w-6 h-6 fill-current text-white ml-1" />
                  )}
                </button>

                {/* Stop / Reset Button */}
                <button 
                  onClick={handleStopVoicemail}
                  className="w-11 h-11 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-500 transition cursor-pointer"
                  title="Stop Voicemail"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-center text-xs text-gray-400 font-medium pb-2">
                Narrated dynamically using character speech characteristics
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
