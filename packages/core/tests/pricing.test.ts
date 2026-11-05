import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/params';
import { commissionSchedule, priceCart, unitComponents, PricingError } from '../src/pricing';

const P = DEFAULT_PARAMS;

describe('moteur de prix — coefficient × base financée (CLAUDE.md §4)', () => {
  it('cas 1 : thin client Essential 300 000, 36 mois, VDI Standard, assurance', () => {
    const c = unitComponents({ purchasePrice: 300000, category: 'THIN_CLIENT', range: 'ESSENTIAL', vdiTier: 'STANDARD' }, 36, P);
    expect(c).toMatchObject({ logistics: 12000, setup: 15000, margin: 36000, base: 363000, rentHt: 12887, rentTva: 2320 });
    expect(c).toMatchObject({ servicesSolinkHt: 6500, servicesSolinkTva: 1170, vdiHt: 12000, vdiTva: 2160, insuranceHt: 300, insuranceTva: 54 });
    expect(c.monthlyHt).toBe(31687);
    expect(c.monthlyTva).toBe(5704);
    expect(c.monthlyTtc).toBe(37391);
  });

  it('cas 2 : laptop Pro 650 000, 24 mois (coef 4,95), sans VDI', () => {
    const c = unitComponents({ purchasePrice: 650000, category: 'LAPTOP', range: 'PRO' }, 24, P);
    expect(c.base).toBe(782000);
    expect(c.rentHt).toBe(38709);
    expect(c.monthlyHt).toBe(45859);
    expect(c.monthlyTva).toBe(8255);
    expect(c.monthlyTtc).toBe(54114);
  });

  it('cas 3 : accessoire (écran) — ni setup ni services, sans assurance', () => {
    const c = unitComponents({ purchasePrice: 90000, category: 'ECRAN', range: 'ESSENTIAL', insurance: false }, 36, P);
    expect(c).toMatchObject({ setup: 0, servicesSolinkHt: 0, insuranceHt: 0, base: 104400, rentHt: 3706, rentTva: 667 });
    expect(c.monthlyTtc).toBe(4373);
  });

  it('cas 4 : Premium 1 200 000, marge 15 %', () => {
    const c = unitComponents({ purchasePrice: 1200000, category: 'LAPTOP', range: 'PREMIUM' }, 36, P);
    expect(c.margin).toBe(180000);
    expect(c.base).toBe(1443000);
    expect(c.rentHt).toBe(51227);
    expect(c.monthlyTtc).toBe(69534);
  });

  it('cas 5 : VDI Performance (19 000 HT)', () => {
    const c = unitComponents({ purchasePrice: 300000, category: 'THIN_CLIENT', range: 'ESSENTIAL', vdiTier: 'PERFORMANCE' }, 36, P);
    expect(c.vdiHt).toBe(19000);
    expect(c.monthlyTtc).toBe(45651);
  });

  it('cas 6 : VDI refusée sur un laptop', () => {
    expect(() => unitComponents({ purchasePrice: 650000, category: 'LAPTOP', range: 'PRO', vdiTier: 'STANDARD' }, 36, P)).toThrow(PricingError);
  });

  it('cas 7 : durée non autorisée', () => {
    expect(() => unitComponents({ purchasePrice: 1, category: 'LAPTOP', range: 'PRO' }, 48, P)).toThrow(/non autorisée/);
  });

  it('cas 8 : panier multi-lignes — somme des postes = total, dépôt = 1 mensualité', () => {
    const { totals, lines } = priceCart(
      [
        { purchasePrice: 300000, category: 'THIN_CLIENT', range: 'ESSENTIAL', quantity: 30, vdiTier: 'STANDARD' },
        { purchasePrice: 90000, category: 'ECRAN', range: 'ESSENTIAL', quantity: 30, insurance: false },
      ],
      36,
      P,
    );
    expect(lines.reduce((a, l) => a + l.lineMonthlyTtc, 0)).toBe(totals.monthlyTtc);
    expect(totals.monthlyTtc).toBe(1252920);
    expect(totals.depositTtc).toBe(1252920);
    expect(totals.seats).toBe(30);
    expect(totals.financedAmount).toBe(14022000);
    expect(totals.totalContractTtc).toBe(45105120);
    expect(totals.monthlyHt + totals.monthlyTva).toBe(totals.monthlyTtc);
    expect(totals.rentHt + totals.servicesHt).toBe(totals.monthlyHt);
  });

  it('cas 9 : quantité invalide', () => {
    expect(() => priceCart([{ purchasePrice: 1, category: 'LAPTOP', range: 'PRO', quantity: 0 }], 36, P)).toThrow(/Quantité/);
  });

  it('cas 10 : paramètre modifié (coefficient 36 mois 3,80) → mensualité recalculée', () => {
    const c = unitComponents({ purchasePrice: 300000, category: 'THIN_CLIENT', range: 'ESSENTIAL', vdiTier: 'STANDARD' }, 36, { ...P, coefficients: { '24': '4.95', '36': '3.80' } });
    expect(c.rentHt).toBe(13794);
    expect(c.monthlyTtc).toBe(31687 - 12887 + 13794 + 5704 - 2320 + Math.round(13794 * 0.18));
  });

  it('cas 11 : arrondi demi-unité supérieur (12 886,5 → 12 887)', () => {
    const c = unitComponents({ purchasePrice: 300000, category: 'THIN_CLIENT', range: 'ESSENTIAL' }, 36, P);
    expect(c.rentHt).toBe(12887);
  });

  it('cas 12 : commission apporteur 3 % mensualisée, reliquat sur la dernière échéance', () => {
    const s = commissionSchedule(10_000_000, 3, 36);
    expect(s.reduce((a, b) => a + b, 0)).toBe(300000);
    expect(s[0]).toBe(8333);
    expect(s[35]).toBe(8345);
  });
});
