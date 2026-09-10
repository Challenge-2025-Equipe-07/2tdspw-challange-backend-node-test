import type { SaaSPlanId } from '../common/saas-plan';

export type AuthUser = {
  id: string;
  userName: string;
  userEmail: string;
};

export type MeProfile = {
  id: string;
  userName: string;
  userEmail: string;
  saasPlan: SaaSPlanId;
  saasTutorQuota: number;
  saasMonthlyFee: number | null;
};
