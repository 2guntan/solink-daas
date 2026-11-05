import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/params';
import { isSampled, recommendRoute, score, type ScoringInput } from '../src/scoring';

const today = new Date('2026-11-05T00:00:00Z');
const strong: ScoringInput = {
  createdOn: new Date('2004-03-01'),
  today,
  sector: 'ASSURANCE',
  beDeclared: true,
  ca: 18_000_000_000,
  rex: 2_600_000_000,
  rn: 1_900_000_000,
  cp: 6_000_000_000,
  dettes: 1_500_000_000,
  annualRentHt: 20_000_000,
  bic: 'AUCUN_INCIDENT',
  orangeScore: 95,
};

describe('scoring (grille 100 pts)', () => {
  it('grand compte solide → score élevé, aucun KO', () => {
    const r = score(strong, DEFAULT_PARAMS);
    expect(r.knockouts).toEqual([]);
    expect(r.score).toBe(15 + 15 + 20 + 15 + 20 + 10 + 5);
    expect(r.riskClass).toBe('A');
    expect(r.factors).toHaveLength(7);
    expect(r.factors.reduce((a, f) => a + f.max, 0)).toBe(100);
  });
  it('knock-outs : < 24 mois, BIC grave, secteur exclu, BE non déclaré', () => {
    const r = score({ ...strong, createdOn: new Date('2025-06-01'), bic: 'INCIDENT_GRAVE', sector: 'JEUX_PARIS', beDeclared: false }, DEFAULT_PARAMS);
    expect(r.knockouts).toHaveLength(4);
  });
  it('voie AUTO : liste blanche + score ≥ 70 + plafond + aucun KO', () => {
    const base = { score: 85, knockouts: [], whitelisted: true, amount: 20_000_000, perClientCap: 150_000_000, clientExposure: 0, envelopeAvailable: 400_000_000, envelopeActive: true };
    expect(recommendRoute(base, DEFAULT_PARAMS).route).toBe('AUTO');
    expect(recommendRoute({ ...base, whitelisted: false }, DEFAULT_PARAMS).route).toBe('ANALYSTE');
    expect(recommendRoute({ ...base, score: 65 }, DEFAULT_PARAMS).route).toBe('ANALYSTE');
    expect(recommendRoute({ ...base, clientExposure: 140_000_000 }, DEFAULT_PARAMS).route).toBe('ANALYSTE');
    expect(recommendRoute({ ...base, envelopeAvailable: 1 }, DEFAULT_PARAMS).route).toBe('ANALYSTE');
    expect(recommendRoute({ ...base, knockouts: ['x'] }, DEFAULT_PARAMS).route).toBe('REFUS_PROPOSE');
  });
  it('échantillonnage déterministe ≈ 10 %', () => {
    let n = 0;
    for (let i = 0; i < 1000; i++) if (isSampled(`CMD-2026-${String(i).padStart(5, '0')}`, 10)) n++;
    expect(n).toBeGreaterThan(50);
    expect(n).toBeLessThan(150);
    expect(isSampled('CMD-2026-00001', 10)).toBe(isSampled('CMD-2026-00001', 10));
  });
});
