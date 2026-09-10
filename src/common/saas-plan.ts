export type SaaSPlanId = 'starter' | 'growth' | 'scale';

export const DEFAULT_SAAS_PLAN: SaaSPlanId = 'starter';
export const DEFAULT_SAAS_TUTOR_QUOTA = 100;

type CatalogEntry = {
  minFee: number;
  maxFee: number;
  minTutors: number;
  maxTutors: number | null;
};

export const SAAS_CATALOG: Record<SaaSPlanId, CatalogEntry> = {
  starter: { minFee: 249, maxFee: 349, minTutors: 0, maxTutors: 300 },
  growth: { minFee: 599, maxFee: 899, minTutors: 300, maxTutors: 1500 },
  scale: { minFee: 1500, maxFee: 3000, minTutors: 1501, maxTutors: null },
};

export type SaasFeeInput = {
  saasPlan: SaaSPlanId;
  saasTutorQuota: number;
  saasMonthlyFee: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function interpolateCatalogFee(
  plan: SaaSPlanId,
  tutors: number,
): number {
  const entry = SAAS_CATALOG[plan];
  if (entry.maxTutors == null) {
    return entry.minFee;
  }

  const span = entry.maxTutors - entry.minTutors;
  const progress =
    span <= 0 ? 0 : clamp((tutors - entry.minTutors) / span, 0, 1);
  return Math.round(entry.minFee + (entry.maxFee - entry.minFee) * progress);
}

export function resolveSaasFee(user: SaasFeeInput): number {
  if (user.saasMonthlyFee != null) {
    return user.saasMonthlyFee;
  }
  return interpolateCatalogFee(user.saasPlan, user.saasTutorQuota);
}
