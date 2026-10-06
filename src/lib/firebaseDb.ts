import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db as firestore, auth } from './firebase';
import { Contact, UserProfile, CallRecord, CommunityContact, Recording, Voicemail } from './db';

const stripUndefined = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  );
};

export const firebaseDb = {
  // --- User Profile ---
  getUserProfile: async (uid: string): Promise<UserProfile | null> => {
    const docRef = doc(firestore, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  },

  saveUserProfile: async (profile: UserProfile): Promise<void> => {
    const docRef = doc(firestore, 'users', profile.uid);
    await setDoc(docRef, stripUndefined(profile), { merge: true });
  },

  updateCredits: async (uid: string, amount: number): Promise<void> => {
    const docRef = doc(firestore, 'users', uid);
    const profile = await firebaseDb.getUserProfile(uid);
    if (profile) {
      await updateDoc(docRef, { credits: profile.credits + amount });
    }
  },

  // --- Contacts ---
  getContacts: async (uid: string): Promise<Contact[]> => {
    const colRef = collection(firestore, `users/${uid}/contacts`);
    const q = query(colRef, orderBy('name'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
  },

  saveContact: async (uid: string, contact: Omit<Contact, 'id' | 'userId'>): Promise<Contact> => {
    const colRef = collection(firestore, `users/${uid}/contacts`);
    const docRef = await addDoc(colRef, stripUndefined({ ...contact, userId: uid }));
    return { id: docRef.id, userId: uid, ...contact } as Contact;
  },

  updateContact: async (uid: string, id: string, contact: Partial<Contact>): Promise<void> => {
    const docRef = doc(firestore, `users/${uid}/contacts`, id);
    await updateDoc(docRef, stripUndefined(contact));
  },

  deleteContact: async (uid: string, id: string): Promise<void> => {
    const docRef = doc(firestore, `users/${uid}/contacts`, id);
    await deleteDoc(docRef);
  },

  // --- Call History ---
  getCallHistory: async (uid: string): Promise<CallRecord[]> => {
    const colRef = collection(firestore, `users/${uid}/calls`);
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CallRecord));
  },

  addCallRecord: async (uid: string, record: Omit<CallRecord, 'id' | 'userId'>): Promise<CallRecord> => {
    const colRef = collection(firestore, `users/${uid}/calls`);
    const docRef = await addDoc(colRef, stripUndefined({ ...record, userId: uid }));
    return { id: docRef.id, userId: uid, ...record } as CallRecord;
  },

  // --- Recordings ---
  getRecordings: async (uid: string): Promise<Recording[]> => {
    const colRef = collection(firestore, `users/${uid}/recordings`);
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recording));
  },

  addRecording: async (uid: string, recording: Omit<Recording, 'id' | 'userId'>): Promise<Recording> => {
    const colRef = collection(firestore, `users/${uid}/recordings`);
    const docRef = await addDoc(colRef, stripUndefined({ ...recording, userId: uid, createdAt: Date.now() }));
    return { id: docRef.id, userId: uid, ...recording, createdAt: Date.now() } as Recording;
  },

  // --- Voicemails ---
  getVoicemails: async (uid: string): Promise<Voicemail[]> => {
    try {
      const colRef = collection(firestore, `users/${uid}/voicemails`);
      const q = query(colRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Voicemail));
    } catch (e) {
      console.error("Firestore getVoicemails failed:", e);
      return [];
    }
  },

  addVoicemail: async (uid: string, voicemail: Omit<Voicemail, 'id' | 'userId'>): Promise<Voicemail> => {
    const colRef = collection(firestore, `users/${uid}/voicemails`);
    const docRef = await addDoc(colRef, stripUndefined({ ...voicemail, userId: uid }));
    return { id: docRef.id, userId: uid, ...voicemail } as Voicemail;
  },

  deleteVoicemail: async (uid: string, voicemailId: string): Promise<void> => {
    const docRef = doc(firestore, `users/${uid}/voicemails`, voicemailId);
    await deleteDoc(docRef);
  },

  markVoicemailPlayed: async (uid: string, voicemailId: string): Promise<void> => {
    try {
      const docRef = doc(firestore, `users/${uid}/voicemails`, voicemailId);
      await updateDoc(docRef, { isPlayed: true });
    } catch (e) {
      console.error("Firestore markVoicemailPlayed failed:", e);
    }
  },

  // --- Community ---
  getCommunityContacts: async (): Promise<CommunityContact[]> => {
    const colRef = collection(firestore, 'community');
    const q = query(colRef, orderBy('likes', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityContact));
  },

  addCommunityContact: async (contact: Omit<CommunityContact, 'id' | 'likes' | 'createdAt'>): Promise<CommunityContact> => {
    const colRef = collection(firestore, 'community');
    const docRef = await addDoc(colRef, stripUndefined({ 
      ...contact, 
      likes: 0, 
      createdAt: Date.now() 
    }));
    return { id: docRef.id, ...contact, likes: 0, createdAt: Date.now() } as CommunityContact;
  },

  likeCommunityContact: async (id: string, currentLikes: number): Promise<void> => {
    const docRef = doc(firestore, 'community', id);
    await updateDoc(docRef, { likes: currentLikes + 1 });
  }
};
