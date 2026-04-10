// Firebase init + Firestore analytics writer.
// All events are written under users/{USER_ID}/events/{eventId}.

const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyD-elS-O5mRxuvT-PEWzMCz8LjYu4yfCJw',
  authDomain:        'lucent-72b68.firebaseapp.com',
  projectId:         'lucent-72b68',
  storageBucket:     'lucent-72b68.firebasestorage.app',
  messagingSenderId: '1018431960018',
  appId:             '1:1018431960018:web:df158d3f27685e83178e0b',
};

// Fixed UUID for this personal installation.
const USER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const FirebaseDB = (() => {
  let db = null;

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch (e) {
    console.warn('FirebaseDB: init failed', e);
  }

  async function logEvent(eventData) {
    if (!db) return;
    try {
      await db
        .collection(`users/${USER_ID}/events`)
        .doc(eventData.id)
        .set(eventData);
    } catch (e) {
      console.warn('FirebaseDB.logEvent failed:', e);
    }
  }

  async function deleteEvent(eventId) {
    if (!db) return;
    try {
      await db.collection(`users/${USER_ID}/events`).doc(eventId).delete();
    } catch (e) {
      console.warn('FirebaseDB.deleteEvent failed:', e);
    }
  }

  async function deleteAllEvents() {
    if (!db) return;
    const snap = await db.collection(`users/${USER_ID}/events`).get();
    // Firestore batch limit is 500 — chunk if needed
    const chunks = [];
    let batch = db.batch();
    let count = 0;
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
      count++;
      if (count === 500) {
        chunks.push(batch.commit());
        batch = db.batch();
        count = 0;
      }
    });
    if (count > 0) chunks.push(batch.commit());
    await Promise.all(chunks);
  }

  return { logEvent, deleteEvent, deleteAllEvents, USER_ID, db };
})();
