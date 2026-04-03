import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNx7iv8-5B5GGqmKoong4PoAHzNP8wStA",
  authDomain: "solopreneur-os-6745a.firebaseapp.com",
  projectId: "solopreneur-os-6745a",
  storageBucket: "solopreneur-os-6745a.firebasestorage.app",
  messagingSenderId: "1038213961799",
  appId: "1:1038213961799:web:1595afb4babb988c597962",
  measurementId: "G-EXSDQF4VG6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();