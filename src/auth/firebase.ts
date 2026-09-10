import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

type ServiceAccountJson = ServiceAccount & { project_id?: string };

function parseServiceAccount(): ServiceAccountJson | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as ServiceAccountJson;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT is not valid JSON (${detail}). Paste the full service-account JSON as a single line.`,
    );
  }
}

export function getFirebaseAdminAuth(): Auth | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || undefined;
  const serviceAccount = parseServiceAccount();

  if (!projectId && !serviceAccount) {
    return null;
  }

  if (getApps().length === 0) {
    if (serviceAccount) {
      const resolvedProjectId =
        projectId || serviceAccount.projectId || serviceAccount.project_id;

      if (
        projectId &&
        serviceAccount.project_id &&
        projectId !== serviceAccount.project_id
      ) {
        throw new Error(
          `FIREBASE_PROJECT_ID (${projectId}) does not match service account project_id (${serviceAccount.project_id})`,
        );
      }

      initializeApp({
        credential: cert(serviceAccount),
        projectId: resolvedProjectId,
      });
    } else {
      initializeApp({ projectId });
    }
  }

  return getAuth();
}
