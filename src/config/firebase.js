import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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

const signInWithGmail = async () => {
  const auth = getFirebaseAuthInstance();

  if (!auth) {
    return {
      success: false,
      error: 'Firebase is not configured. Set REACT_APP_FIREBASE_* environment variables.'
    };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    const result = await signInWithPopup(auth, provider);
    
    if (!result.user) {
      return {
        success: false,
        error: 'Failed to sign in with Google'
      };
    }

    const idToken = await result.user.getIdToken();
    
    return {
      success: true,
      user: {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      },
      idToken
    };
  } catch (error) {
    console.error('Gmail sign-in error:', error.message, error.code);
    
    // Check if user cancelled the popup
    if (error.code === 'auth/popup-closed-by-user') {
      return {
        success: false,
        error: 'Sign-in cancelled. Please try again.'
      };
    }

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
  sendFirebasePhoneOTP,
  signInWithGmail
};

