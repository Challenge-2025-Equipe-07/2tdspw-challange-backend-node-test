import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Auth } from 'firebase-admin/auth';

import { getFirebaseAdminAuth } from './firebase';
import { CLAIM_BYTE_LIMIT, TUTOR_ROLE } from './tutor-account.constants';
import type { TutorClaims, TutorProfile } from './tutor-account.types';

const PHONE_ALREADY_EXISTS = 'auth/phone-number-already-exists';

@Injectable()
export class TutorAccountService {
  async sync(profile: TutorProfile): Promise<void> {
    const claims = toClaims(profile);
    assertClaimSize(claims);
    const auth = requireAuth();
    const uid = await upsertPhoneUser(auth, profile);
    await auth.setCustomUserClaims(uid, claims);
  }
}

function toClaims(profile: TutorProfile): TutorClaims {
  return {
    role: TUTOR_ROLE,
    email: profile.email,
    document: profile.document,
    pets: profile.pets,
  };
}

function assertClaimSize(claims: TutorClaims): void {
  const bytes = Buffer.byteLength(JSON.stringify(claims), 'utf8');
  if (bytes <= CLAIM_BYTE_LIMIT) return;
  throw new BadRequestException(
    'Pet metadata exceeds the Firebase claim limit',
  );
}

function requireAuth(): Auth {
  let auth: Auth | null;
  try {
    auth = getFirebaseAdminAuth();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ServiceUnavailableException(detail);
  }
  if (!auth) {
    throw new ServiceUnavailableException('Firebase is not configured');
  }
  return auth;
}

async function upsertPhoneUser(
  auth: Auth,
  profile: TutorProfile,
): Promise<string> {
  try {
    const created = await auth.createUser({
      phoneNumber: profile.telephone,
      displayName: profile.name,
    });
    return created.uid;
  } catch (error) {
    if (!isPhoneTaken(error)) throw error;
    const existing = await auth.getUserByPhoneNumber(profile.telephone);
    await auth.updateUser(existing.uid, { displayName: profile.name });
    return existing.uid;
  }
}

function isPhoneTaken(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PHONE_ALREADY_EXISTS
  );
}
