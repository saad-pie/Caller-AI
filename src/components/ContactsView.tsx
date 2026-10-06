import { ArrowLeft, User, Phone, Sparkles, Search, UserPlus, Plus, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { type ViewState } from '../App';
import { type Contact } from '../lib/db';

interface ContactsViewProps {
  contacts: Contact[];
  onNavigate: (view: ViewState) => void;
  onCall: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
}

export default function ContactsView({ contacts, onNavigate, onCall, onEdit }: ContactsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort contacts
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.number.includes(searchQuery)
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => a.name.localeCompare(b.name));

  // Group by first letter
  const groupedContacts = sortedContacts.reduce((acc, contact) => {
    const letter = contact.name.charAt(0).toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(contact);
    return acc;
  }, {} as Record<string, Contact[]>);

  return (
    <div className="flex flex-col h-full bg-[#F3F6FB] relative">
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 bg-white shadow-sm z-10 sticky top-0">
        <div className="flex items-center">
          <button onClick={() => onNavigate('home')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xl font-normal ml-2">Contacts</span>
        </div>
        <button onClick={() => onNavigate('create-contact')} className="p-2 text-[#0B57D0] hover:bg-blue-50 rounded-full transition-colors" title="Add Contact">
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-3 bg-white">
        <div className="bg-[#E4E9F2] rounded-full flex items-center px-4 py-2">
          <Search className="w-4 h-4 text-gray-500 mr-2" />
          <input 
            type="text" 
            placeholder="Search contacts" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent flex-1 outline-none text-sm placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 bg-white relative">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-gray-500">
            <User className="w-12 h-12 mb-4 text-gray-300" />
            <p>No contacts yet</p>
            <button 
              onClick={() => onNavigate('create-contact')}
              className="mt-4 px-4 py-2 bg-[#D3E3FD] text-[#0B57D0] rounded-full text-sm font-medium"
            >
              Create New
            </button>
          </div>
        ) : sortedContacts.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No contacts match your search.
          </div>
        ) : (
          Object.keys(groupedContacts).sort().map(letter => (
            <div key={letter} className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-3 ml-2">{letter}</h3>
              <div className="space-y-4">
                {groupedContacts[letter].map(contact => (
                  <div 
                    key={contact.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => onCall(contact)}
                  >
                    <div className="flex items-center gap-3">
                      {contact.photoUrl ? (
                        <img src={contact.photoUrl} alt={contact.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium text-white ${contact.isAI ? 'bg-gradient-to-br from-blue-400 to-purple-500' : 'bg-gray-400'}`}>
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">{contact.name}</span>
                          {contact.isAI && <Sparkles className="w-3 h-3 text-[#0B57D0]" />}
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{contact.number}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={(e) => { e.stopPropagation(); onEdit(contact); }}
                        title="Edit Contact"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button 
                        className="p-2 text-[#0B57D0] hover:bg-blue-50 rounded-full transition-colors"
                        onClick={(e) => { e.stopPropagation(); onCall(contact); }}
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      {contacts.length > 0 && (
        <button
          onClick={() => onNavigate('create-contact')}
          className="absolute bottom-24 right-6 w-14 h-14 bg-[#D3E3FD] hover:bg-blue-200 text-[#0B57D0] rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 z-20"
          title="Create New Contact"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
