import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
//THIS IS THE MAIN DB
  const firebaseConfig = {
    apiKey: "AIzaSyBGCYJD1eS6EiTrOp6C112r2QjkEhyZENw",
    authDomain: "jeya-santhosh-inn.firebaseapp.com",
    projectId: "jeya-santhosh-inn",
    storageBucket: "jeya-santhosh-inn.firebasestorage.app",
    messagingSenderId: "1063356009476",
    appId: "1:1063356009476:web:2ef151147118171a423951",
    measurementId: "G-PF9YS4SB7M"
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
