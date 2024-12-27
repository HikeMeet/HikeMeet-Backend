import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY, // updated
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'hikemeet-a918c', // updated
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);

export default app;
