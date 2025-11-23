import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
//THIS IS THE MAIN DB
  const firebaseConfig = {
    apiKey: "AIzaSyCmBdthR6ikDTR1VvmPkhpaQ9pYQjQw-Wg",
    authDomain: "jeya-santhosh-inn-b02dd.firebaseapp.com",
    projectId: "jeya-santhosh-inn-b02dd",
    storageBucket: "jeya-santhosh-inn-b02dd.firebasestorage.app",
    messagingSenderId: "330001746216",
    appId: "1:330001746216:web:9b384a5851afaf0cae681d",
    measurementId: "G-WCV81FB8HH"
  };



//TESTING

// const firebaseConfig = {
//   apiKey: "AIzaSyAIxrA5uo64FQOq_RP1GnG8sNhhXJBaX2E",
//   authDomain: "boss-test-3d2f8.firebaseapp.com",
//   projectId: "boss-test-3d2f8",
//   storageBucket: "boss-test-3d2f8.firebasestorage.app",
//   messagingSenderId: "820395646920",
//   appId: "1:820395646920:web:38b8361365c00c74ce2afd",
//   measurementId: "G-HHBR54NKFM"
// };
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };
