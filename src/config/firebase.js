import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

let firebaseApp = null;
let firebaseAuth = null;

const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
};

const getFirebaseApp = () => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
  }

  return firebaseApp;
};

const getFirebaseAuthInstance = () => {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firebaseAuth) {
    const app = getFirebaseApp();
    firebaseAuth = app ? getAuth(app) : null;
  }

  return firebaseAuth;
};

const createRecaptchaVerifier = (containerId, callback) => {
  const auth = getFirebaseAuthInstance();

  if (!auth) {
    return null;
  }

  try {
    return new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: (response) => {
        if (callback) callback(response);
      },
      'expired-callback': () => {
        console.warn('reCAPTCHA expired');
      }
    });
  } catch (error) {
    console.error('Failed to create reCAPTCHA verifier:', error.message);
    return null;
  }
};

const sendFirebasePhoneOTP = async (phoneNumber, appVerifier) => {
  const auth = getFirebaseAuthInstance();

  if (!auth) {
    return {
      success: false,
      error: 'Firebase is not configured. Set REACT_APP_FIREBASE_* environment variables.'
    };
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return {
      success: true,
      confirmationResult
    };
  } catch (error) {
    console.error('Firebase phone OTP send error:', error.message, error.code);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

export {
  isFirebaseConfigured,
  getFirebaseApp,
  getFirebaseAuthInstance,
  createRecaptchaVerifier,
  sendFirebasePhoneOTP
};

