import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDuLOt2vtIU1unFc6lR-ZSixntCrCW685c",
  authDomain: "hajj-2026-70c2b.firebaseapp.com",
  projectId: "hajj-2026-70c2b",
  storageBucket: "hajj-2026-70c2b.firebasestorage.app",
  messagingSenderId: "834784102995",
  appId: "1:834784102995:web:629acdcfb8a1984af814a6",
  measurementId: "G-99618MWNL3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db   = getFirestore(app);
export const auth = getAuth(app);
