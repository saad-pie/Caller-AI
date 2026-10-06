export interface Contact {
  id: string;
  userId: string;
  name: string;
  number: string;
  personaDescription?: string;
  voice?: string;
  proactiveSchedule?: string;
  isAI: boolean;
  photoUrl?: string;
  settings?: {
    sendMessageEnabled?: boolean;
    googleSearchEnabled?: boolean;
    recordingEnabled?: boolean;
  };
}

export interface UserProfile {
  uid: string;
  name: string;
  email?: string;
  number: string;
  photoUrl?: string;
  credits: number;
  globalPromptEnabled?: boolean;
  globalPrompt?: string;
  privacySettings?: {
    shareActivity?: boolean;
    anonymousMode?: boolean;
  };
  lastCheckIn?: string;
}

export interface CallRecord {
  id: string;
  userId: string;
  contactId?: string;
  contactName?: string;
  number: string;
  timestamp: number;
  duration: number; // in seconds
  type: 'missed' | 'outgoing' | 'incoming';
  recordingId?: string;
}

export interface CommunityContact {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  number: string;
  personaDescription?: string;
  voice?: string;
  photoUrl?: string;
  likes: number;
  createdAt: number;
}

export interface Recording {
  id: string;
  userId: string;
  callId: string;
  audioUrl?: string;
  transcript: {
    speaker: string;
    text: string;
    timestamp: number;
  }[];
  createdAt: number;
}

export interface Voicemail {
  id: string;
  userId: string;
  contactId?: string;
  contactName: string;
  photoUrl?: string;
  timestamp: number;
  duration: number; // in seconds
  transcriptText: string;
  voice: string;
  isPlayed?: boolean;
}

const CONTACTS_KEY = 'caller_ai_contacts';
const HISTORY_KEY = 'caller_ai_history';
const PROFILE_KEY = 'caller_ai_profile';
const VOICEMAILS_KEY = 'caller_ai_voicemails';

export const db = {
  getContacts: (): Contact[] => {
    const data = localStorage.getItem(CONTACTS_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  saveContact: (contact: Omit<Contact, 'id'>): Contact => {
    const contacts = db.getContacts();
    const newContact = { ...contact, id: Math.random().toString(36).substring(7) };
    contacts.push(newContact);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    return newContact;
  },

  deleteContact: (id: string) => {
    const contacts = db.getContacts().filter(c => c.id !== id);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  },

  getCallHistory: (): CallRecord[] => {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  },

  addCallRecord: (record: Omit<CallRecord, 'id'>): CallRecord => {
    const history = db.getCallHistory();
    const newRecord = { ...record, id: Date.now().toString() };
    history.unshift(newRecord); // Add to beginning
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return newRecord;
  },

  clearCallHistory: () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  },

  getVoicemails: (): Voicemail[] => {
    const data = localStorage.getItem(VOICEMAILS_KEY);
    return data ? JSON.parse(data) : [];
  },

  addVoicemail: (voicemail: Omit<Voicemail, 'id'>): Voicemail => {
    const list = db.getVoicemails();
    const newVoicemail = { ...voicemail, id: Date.now().toString() };
    list.unshift(newVoicemail);
    localStorage.setItem(VOICEMAILS_KEY, JSON.stringify(list));
    return newVoicemail;
  },

  deleteVoicemail: (id: string) => {
    const list = db.getVoicemails().filter(v => v.id !== id);
    localStorage.setItem(VOICEMAILS_KEY, JSON.stringify(list));
  },

  getUserProfile: (): UserProfile => {
    const data = localStorage.getItem(PROFILE_KEY);
    return data ? JSON.parse(data) : { uid: 'anonymous', name: 'User', number: '+1 (555) 123-4567', credits: 0 };
  },

  saveUserProfile: (profile: UserProfile) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }
};
