import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Auth } from 'firebase-admin/auth';

import {
  DEFAULT_SAAS_PLAN,
  DEFAULT_SAAS_TUTOR_QUOTA,
} from '../common/saas-plan';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser, MeProfile } from './auth.types';
import { getFirebaseAdminAuth } from './firebase';
import { TUTOR_ROLE } from './tutor-account.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async authenticate(token: string | undefined): Promise<AuthUser> {
    if (token) {
      return this.authenticateToken(token);
    }

    if (this.isDevBypassEnabled()) {
      return this.upsertDevUser();
    }

    throw new UnauthorizedException('Missing bearer token');
  }

  private async authenticateToken(token: string): Promise<AuthUser> {
    let auth: Auth | null;
    try {
      auth = getFirebaseAdminAuth();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console -- misconfiguration is otherwise opaque on Render
      console.error('[auth] Firebase Admin init failed:', detail);
      throw new UnauthorizedException(
        process.env.AUTH_DEBUG === 'true'
          ? `Firebase is misconfigured: ${detail}`
          : 'Firebase is misconfigured',
      );
    }
    if (!auth) {
      throw new UnauthorizedException('Firebase is not configured');
    }

    try {
      const decoded = (await auth.verifyIdToken(token)) as {
        uid: string;
        name?: string;
        email?: string;
        role?: unknown;
        phone_number?: unknown;
        firebase?: { sign_in_provider?: unknown };
      };
      const tutor = readTutor(decoded);
      if (tutor) return tutor;

      const userName = decoded.name?.trim() || decoded.email || 'Veterinário';
      const userEmail = decoded.email || `${decoded.uid}@users.firebase`;

      const clinic = await this.upsertUser({
        id: decoded.uid,
        userName,
        userEmail,
      });
      return { ...clinic, phoneNumber: readPhone(decoded) };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console -- surface Firebase verify failures in host logs
      console.error('[auth] verifyIdToken failed:', detail);
      throw new UnauthorizedException(
        process.env.AUTH_DEBUG === 'true'
          ? `Invalid bearer token: ${detail}`
          : 'Invalid bearer token',
      );
    }
  }

  private isDevBypassEnabled() {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return this.config.get<string>('AUTH_DEV_BYPASS') === 'true';
  }

  private async upsertDevUser(): Promise<AuthUser> {
    const id =
      this.config.get<string>('AUTH_DEV_USER_ID') ||
      this.config.get<string>('SEED_USER_ID') ||
      'seed-vet-demo';

    return this.upsertUser({
      id,
      userName: 'Vet Demo',
      userEmail: 'vet.demo@email.com',
    });
  }

  async getMe(userId: string): Promise<MeProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userName: true,
        userEmail: true,
        saasPlan: true,
        saasTutorQuota: true,
        saasMonthlyFee: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async upsertUser(user: {
    id: string;
    userName: string;
    userEmail: string;
  }): Promise<AuthUser> {
    const saved = await this.prisma.user.upsert({
      where: { id: user.id },
      create: {
        ...user,
        saasPlan: DEFAULT_SAAS_PLAN,
        saasTutorQuota: DEFAULT_SAAS_TUTOR_QUOTA,
      },
      update: {
        userName: user.userName,
        userEmail: user.userEmail,
      },
    });

    return {
      id: saved.id,
      userName: saved.userName,
      userEmail: saved.userEmail,
      role: 'clinic',
    };
  }
}

function readPhone(decoded: { phone_number?: unknown }): string | undefined {
  if (typeof decoded.phone_number !== 'string' || !decoded.phone_number) {
    return undefined;
  }
  return decoded.phone_number;
}

function readTutor(decoded: {
  uid: string;
  role?: unknown;
  phone_number?: unknown;
  name?: unknown;
  firebase?: { sign_in_provider?: unknown };
}): AuthUser | null {
  const phoneSignIn = decoded.firebase?.sign_in_provider === 'phone';
  if (decoded.role !== TUTOR_ROLE && !phoneSignIn) return null;
  const phoneNumber = readPhone(decoded);
  if (!phoneNumber) {
    throw new UnauthorizedException('Missing phone number');
  }
  const userName =
    typeof decoded.name === 'string' && decoded.name.trim()
      ? decoded.name.trim()
      : 'Tutor';
  return {
    id: decoded.uid,
    userName,
    userEmail: '',
    phoneNumber,
    role: 'tutor',
  };
}
