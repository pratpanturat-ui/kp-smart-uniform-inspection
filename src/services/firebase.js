import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Object.values(cfg).every(Boolean);
const app = configured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Isolated session used only when Admin provisions a staff username/password.
const provisioningApp = configured ? initializeApp(cfg, 'kp-staff-provisioning') : null;
export const provisioningAuth = provisioningApp
  ? initializeAuth(provisioningApp, { persistence: inMemoryPersistence }) : null;