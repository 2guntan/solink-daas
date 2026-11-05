import { describe, expect, it } from 'vitest';
import { allocate, buildSchedule, dunningLevelsDue, invoiceLines, rentStartDate, returnPenalty, targetBuckets } from '../src/billing';
import { DEFAULT_PARAMS } from '../src/params';
import { available, alertsTriggered, consume, newlyCrossed, release, reserve } from '../src/envelope';
import { checklistFor, validityCheck } from '../src/checklist';

const A = { rentHt: 386610, rentTva: 69600, servicesSolinkHt: 195000, servicesSolinkTva: 35100, vdiHt: 0, vdiTva: 0, insuranceHt: 19500, insuranceTva: 3510 };

describe('facture Orange 2 lignes et ventilation', () => {
  it('2 lignes : loyer / services ; total = somme', () => {
    const l = invoiceLines(A, 8333);
    expect(l.line1Ttc).toBe(456210);
    expect(l.line2Ttc).toBe(195000 + 35100 + 19500 + 3510);
    expect(l.totalTtc).toBe(l.line1Ttc + l.line2Ttc);
  });
  it('ventilation cible : somme = total facture ; commission prise sur le loyer', () => {
    const l = invoiceLines(A, 8333);
    const b = targetBuckets(l.breakdown);
    expect(b.reduce((a, x) => a + x.amount, 0)).toBe(l.totalTtc);
    expect(b.find((x) => x.component === 'LOYER')!.amount).toBe(456210 - 8333);
  });
  it('encaissements partiels successifs : écart encaissé / ventilé = 0', () => {
    const l = invoiceLines(A, 8333);
    let remaining = targetBuckets(l.breakdown);
    let total = 0;
    for (const amt of [100001, 250000, l.totalTtc - 350001]) {
      const parts = allocate(amt, remaining);
      expect(parts.reduce((a, x) => a + x.amount, 0)).toBe(amt);
      remaining = remaining.map((r) => ({ ...r, amount: r.amount - (parts.find((p) => p.component === r.component)?.amount ?? 0) }));
      total += amt;
    }
    expect(total).toBe(l.totalTtc);
    expect(remaining.every((r) => r.amount === 0)).toBe(true);
  });
  it('départ du loyer au 1er du mois suivant le dernier PV ; émission le 1er, échéance le 15', () => {
    const start = rentStartDate(new Date('2026-11-20T10:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-12-01');
    const s = buildSchedule(start, 36, A, Array(36).fill(0));
    expect(s).toHaveLength(36);
    expect(s[0].dueDate.toISOString().slice(0, 10)).toBe('2026-12-15');
    expect(s[1].issueDate.toISOString().slice(0, 10)).toBe('2027-01-01');
  });
  it('relances J+1/7/15/30/60', () => {
    expect(dunningLevelsDue(0, DEFAULT_PARAMS.relances_jours)).toEqual([]);
    expect(dunningLevelsDue(10, DEFAULT_PARAMS.relances_jours)).toEqual(['J1_RAPPEL', 'J7_RELANCE']);
    expect(dunningLevelsDue(15, DEFAULT_PARAMS.relances_jours)).toContain('J15_VERROUILLAGE');
    expect(dunningLevelsDue(60, DEFAULT_PARAMS.relances_jours)).toHaveLength(5);
  });
  it('restitution A–E', () => {
    const g = DEFAULT_PARAMS.grille_restitution_pct;
    expect(returnPenalty('A', 600000, 36, 36, g).penalty).toBe(0);
    expect(returnPenalty('E', 600000, 36, 36, g).penalty).toBe(120000);
    expect(returnPenalty('C', 600000, 36, 18, g).penalty).toBe(45000);
  });
});

describe('enveloppe', () => {
  const e = { total: 500_000_000, reserved: 0, consumed: 0, endDate: new Date('2027-08-01'), alertPcts: [20, 10], active: true };
  it('réservation → consommation → libération', () => {
    const r = reserve(e, 100_000_000);
    expect(available(r)).toBe(400_000_000);
    const c = consume(r, 100_000_000);
    expect(c).toMatchObject({ reserved: 0, consumed: 100_000_000 });
    expect(release(reserve(e, 5), 5).reserved).toBe(0);
  });
  it('alertes à 20 % et 10 % restants', () => {
    const r = reserve(e, 410_000_000);
    expect(alertsTriggered(r)).toEqual([20]);
    expect(newlyCrossed(r, reserve(r, 45_000_000))).toEqual([10]);
  });
});

describe('checklist', () => {
  it('PME : 3 exercices + relevés + attestation sociale', () => {
    const t = checklistFor('PME').map((x) => x.type);
    expect(t).toContain('ETATS_FIN_N3');
    expect(t).toContain('RELEVES_BANCAIRES');
    expect(t).toContain('ATTESTATION_SOCIALE');
  });
  it('liste blanche : allège les pièces financières', () => {
    expect(checklistFor('GRANDE_ENTREPRISE', { whitelisted: true }).map((x) => x.type)).not.toContain('ETATS_FIN_N2');
  });
  it('RCCM de plus de 3 mois → motif « Extrait de plus de 3 mois »', () => {
    expect(validityCheck('RCCM', new Date('2026-06-01'), new Date('2026-11-05'))).toBe('Extrait de plus de 3 mois');
    expect(validityCheck('RCCM', new Date('2026-10-01'), new Date('2026-11-05'))).toBeNull();
  });
});
