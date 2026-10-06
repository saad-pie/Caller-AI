import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Sanitize logs in dev
if ((import.meta as any).env?.DEV) {
  console.log('Firebase Cloud Configuration:', { 
    projectId: firebaseConfig.projectId, 
    databaseId: firebaseConfig.firestoreDatabaseId
  });
}

const app = initializeApp(firebaseConfig);

/**
 * Initialize Firestore with aggressive resilience settings.
 * Long polling is forced to bypass WebSocket-blocking proxies in sandboxed environments.
 */
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalAutoDetectLongPolling: false,
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);

/** 
 * Connection test utility with retry logic
 */
export async function testFirestoreConnection(retries = 3) {
  for (let i = 0; i < retries; i++) {
    console.log(`[Firestore] Connection attempt ${i + 1}/${retries}...`);
    try {
      // Use the root doc or a specific health check doc
      const testDoc = doc(db, '_health_check_', 'ping');
      await getDocFromServer(testDoc);
      console.log('[Firestore] Connected successfully.');
      return true;
    } catch (error: any) {
      console.warn(`[Firestore] Attempt ${i + 1} failed. Code: ${error.code} - Message: ${error.message}`);
      
      if (i === retries - 1) {
        console.error('[Firestore] All connection attempts failed. If you see "unavailable", check if your Firebase Project has Firestore enabled and if the Database ID in firebase-applet-config.json is correct.');
      } else {
        // Linear backoff
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      }
    }
  }
  return false;
}

// Start the check in development environments
if ((import.meta as any).env?.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-dev'))) {
  testFirestoreConnection();
}
