import { interpolateCatalogFee, resolveSaasFee } from './saas-plan';

describe('interpolateCatalogFee', () => {
  it('prices Starter at 100 tutors inside the 249–349 band', () => {
    expect(interpolateCatalogFee('starter', 100)).toBe(282);
  });

  it('uses the Starter floor at 0 tutors and the ceiling at 300', () => {
    expect(interpolateCatalogFee('starter', 0)).toBe(249);
    expect(interpolateCatalogFee('starter', 300)).toBe(349);
  });

  it('prices Growth at the band edges', () => {
    expect(interpolateCatalogFee('growth', 300)).toBe(599);
    expect(interpolateCatalogFee('growth', 1500)).toBe(899);
  });
});

describe('resolveSaasFee', () => {
  it('prefers a billed monthly override', () => {
    expect(
      resolveSaasFee({
        saasPlan: 'scale',
        saasTutorQuota: 2000,
        saasMonthlyFee: 2200,
      }),
    ).toBe(2200);
  });

  it('falls back to the catalog when no override is set', () => {
    expect(
      resolveSaasFee({
        saasPlan: 'starter',
        saasTutorQuota: 100,
        saasMonthlyFee: null,
      }),
    ).toBe(282);
  });
});
