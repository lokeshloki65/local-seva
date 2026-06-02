import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase Client configuration parameters
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDErLV4jxywlK5bVYFVwylQ6z2wgo-1f-w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "developers-man.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "developers-man",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "developers-man.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "34230860300",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:34230860300:web:048c7679e3e62ae0290c29"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
