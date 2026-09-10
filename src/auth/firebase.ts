import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

function parseServiceAccount(): ServiceAccount | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as ServiceAccount;
}

export function getFirebaseAdminAuth(): Auth | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccount = parseServiceAccount();

  if (!projectId && !serviceAccount) {
    return null;
  }

  if (getApps().length === 0) {
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } else {
      initializeApp({ projectId });
    }
  }

  return getAuth();
}
