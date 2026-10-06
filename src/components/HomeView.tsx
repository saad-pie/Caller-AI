import { Search, Mic, PhoneCall, Sparkles, Users, UserPlus, History } from 'lucide-react';
import { useState } from 'react';
import { type ViewState } from '../App';
import { type Contact, type CallRecord, type UserProfile } from '../lib/db';

interface HomeViewProps {
  contacts: Contact[];
  callHistory: CallRecord[];
  onNavigate: (view: ViewState) => void;
  onCall: (contact: Contact | string) => void;
  userProfile: UserProfile | null;
}

export default function HomeView({ contacts, callHistory, onNavigate, onCall, userProfile }: HomeViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Missed' | 'Incoming' | 'Outgoing' | 'AI Handled'>('All');
  
  const getContactForRecord = (record: CallRecord) => {
    if (record.contactId) {
      return contacts.find(c => c.id === record.contactId);
    }
    return contacts.find(c => c.number === record.number);
  };

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hrs ago`;
    if (days === 1) return 'Yesterday';
    return new Date(ts).toLocaleDateString();
  };

  const filteredHistory = [...callHistory]
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter(record => {
      // Search filter
      if (searchQuery) {
        const contact = getContactForRecord(record);
        const nameStr = contact ? contact.name.toLowerCase() : '';
        const numStr = record.number;
        if (!nameStr.includes(searchQuery.toLowerCase()) && !numStr.includes(searchQuery)) return false;
      }

      // Tab filter
      if (activeTab === 'Missed') return record.type === 'missed';
      if (activeTab === 'Incoming') return record.type === 'incoming';
      if (activeTab === 'Outgoing') return record.type === 'outgoing';
      if (activeTab === 'AI Handled') {
         const contact = getContactForRecord(record);
         return contact?.isAI === true;
      }
      
      return true; // All
    });

  return (
    <div className="flex flex-col h-full bg-[#F3F6FB] text-gray-900 pt-12">
      {/* Top Search Bar */}
      <div className="px-4 mb-4 flex items-center gap-3">
        <div className="bg-[#E4E9F2] rounded-full flex items-center px-4 py-3 flex-1">
          <Search className="w-5 h-5 text-gray-500 mr-3 shrink-0" />
          <input 
            type="text" 
            placeholder="Search contacts and places" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent flex-1 outline-none text-base w-full placeholder-gray-500"
          />
          <Mic className="w-5 h-5 text-gray-500 ml-3 shrink-0" />
        </div>
        <button 
          onClick={() => onNavigate('settings')}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-sm transition-transform hover:scale-105 active:scale-95 overflow-hidden border-2 border-white"
        >
          {userProfile?.photoUrl ? (
            <img src={userProfile.photoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-sm font-medium">
              {userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex px-4 overflow-x-auto gap-2 pb-4 no-scrollbar">
        {['All', 'Missed', 'Incoming', 'Outgoing', 'AI Handled'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab ? 'bg-[#D3E3FD] text-[#041E49] hover:bg-[#C2D7FC]' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <PhoneCall className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No calls found</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-[200px]">
              {searchQuery ? `No results for "${searchQuery}"` : `Your ${activeTab.toLowerCase()} history will appear here.`}
            </p>
          </div>
        ) : (
          <>
            {/* Favourites Section */}
            {!searchQuery && activeTab === 'All Calls' && (
              <div className="mb-6 border-b border-gray-200 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-600">Favourites</h2>
                  <button className="text-sm text-[#0B57D0] font-medium hover:bg-blue-50 px-2 py-1 rounded">Edit</button>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('contacts')}>
                    <div className="w-14 h-14 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center mb-1 hover:bg-gray-300 transition-colors shadow-sm">
                      <Users className="w-6 h-6" />
                    </div>
                    <span className="text-xs text-center font-medium text-gray-700 mt-1">Directory</span>
                  </div>

                  <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('create-contact')}>
                    <div className="w-14 h-14 rounded-full bg-[#E8F0FE] text-[#0B57D0] flex flex-col items-center justify-center mb-1 hover:bg-[#D3E3FD] transition-colors shadow-sm relative">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <span className="text-xs text-center font-medium text-[#0B57D0] mt-1">Create<br/>AI</span>
                  </div>

                  <div className="flex flex-col items-center cursor-pointer" onClick={() => onNavigate('community')}>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex flex-col items-center justify-center mb-1 hover:opacity-90 transition-opacity shadow-sm">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-center font-medium text-purple-600 mt-1">Community<br/>AIs</span>
                  </div>
                  
                  {contacts.filter(c => c.isAI).slice(0, 1).map((fav) => (
                    <div key={fav.id} className="flex flex-col items-center cursor-pointer" onClick={() => onCall(fav)}>
                      <div className="w-14 h-14 rounded-full bg-blue-100 text-[#0B57D0] flex items-center justify-center text-xl font-medium relative mb-1 shadow-sm">
                        {fav.name.charAt(0)}
                        <div className="absolute right-0 bottom-0 bg-white rounded-full p-0.5 shadow-sm">
                          <Sparkles className="w-3 h-3 text-[#0B57D0]" />
                        </div>
                      </div>
                      <span className="text-xs text-center leading-tight mt-1 truncate w-16 px-1">{fav.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Call History List */}
            <div>
              <h2 className="text-sm font-medium text-gray-600 mb-2">{searchQuery ? 'Search Results' : 'Recent'}</h2>
              <div className="space-y-4">
                {filteredHistory.map((record) => {
                  const contact = getContactForRecord(record);
                  const displayName = contact ? contact.name : record.number;
                  
                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-sm cursor-pointer hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all" onClick={() => onCall(contact || record.number)}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-medium text-white ${contact?.isAI ? 'bg-gradient-to-br from-blue-400 to-[#0B57D0]' : 'bg-gray-400'}`}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`text-base font-medium ${record.type === 'missed' ? 'text-red-500' : 'text-gray-900'}`}>{displayName}</h3>
                            {contact?.isAI && <Sparkles className="w-3 h-3 text-[#0B57D0]" />}
                          </div>
                          <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                            <svg className={`w-3.5 h-3.5 ${record.type === 'missed' ? 'text-red-500' : record.type === 'outgoing' ? 'text-green-600' : 'text-blue-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              {record.type === 'outgoing' ? <path d="M7 17L17 7M17 7H7M17 7V17" /> : <path d="M17 7L7 17M7 17H17M7 17V7" />}
                            </svg>
                            Mobile • {formatTimestamp(record.timestamp)}
                          </p>
                        </div>
                      </div>
                      <button 
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#E8F0FE] text-gray-500 text-[#0B57D0]"
                        onClick={(e) => { e.stopPropagation(); onCall(contact || record.number); }}
                      >
                        <PhoneCall className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
