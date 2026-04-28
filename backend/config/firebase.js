const admin = require('firebase-admin');

let firebaseApp = null;

const isFirebaseConfigured = () => {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  );
};

const initializeFirebase = () => {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase Admin SDK not configured. Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.');
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      })
    });

    console.log('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    return null;
  }
};

const getFirebaseAuth = () => {
  const app = initializeFirebase();
  return app ? admin.auth() : null;
};

const verifyFirebaseIdToken = async (idToken) => {
  const auth = getFirebaseAuth();

  if (!auth) {
    return {
      success: false,
      error: 'Firebase Admin SDK is not configured'
    };
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return {
      success: true,
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number || null,
      email: decodedToken.email || null,
      emailVerified: Boolean(decodedToken.email_verified),
      decodedToken
    };
  } catch (error) {
    console.error('Firebase ID token verification error:', error.message);
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
};

module.exports = {
  isFirebaseConfigured,
  initializeFirebase,
  getFirebaseAuth,
  verifyFirebaseIdToken
};

