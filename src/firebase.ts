// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Suas credenciais (copiadas do seu json anterior)
const firebaseConfig = {
  projectId: "gen-lang-client-0167445704",
  appId: "1:638002989235:web:4da4674bb07af5439008c6",
  apiKey: "AIzaSyCauB9MdE324C-ILcu4p-PFyg1E6A36kJY",
  authDomain: "gen-lang-client-0167445704.firebaseapp.com",
  storageBucket: "gen-lang-client-0167445704.firebasestorage.app",
  messagingSenderId: "638002989235",
};

const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-5686db26-9eb3-41ee-85c1-1789cc0db240");
export const storage = getStorage(app);

// Isso garante a persistência do login
setPersistence(auth, browserLocalPersistence);