import { addMonths, firstOfNextMonth } from './clock';

/** Échéancier, facture Orange 2 lignes, ventilation du cantonnement (CLAUDE.md §4). */
export interface ContractAmounts {
  rentHt: number;
  rentTva: number;
  servicesSolinkHt: number;
  servicesSolinkTva: number;
  vdiHt: number;
  vdiTva: number;
  insuranceHt: number;
  insuranceTva: number;
}

export interface InstallmentPlan {
  number: number;
  issueDate: Date;
  dueDate: Date;
  rentHt: number;
  rentTva: number;
  servicesHt: number;
  servicesTva: number;
  totalTtc: number;
  commission: number;
}

/** Départ du loyer : 1er jour du mois suivant le dernier PV. */
export function rentStartDate(lastPvDate: Date): Date {
  return firstOfNextMonth(lastPvDate);
}

export function buildSchedule(
  start: Date,
  duration: number,
  a: ContractAmounts,
  commissions: number[],
  issueDay = 1,
  dueDay = 15,
): InstallmentPlan[] {
  const servicesHt = a.servicesSolinkHt + a.vdiHt + a.insuranceHt;
  const servicesTva = a.servicesSolinkTva + a.vdiTva + a.insuranceTva;
  return Array.from({ length: duration }, (_, i) => {
    const m = addMonths(start, i);
    const issueDate = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), issueDay));
    const dueDate = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), dueDay));
    return {
      number: i + 1,
      issueDate,
      dueDate,
      rentHt: a.rentHt,
      rentTva: a.rentTva,
      servicesHt,
      servicesTva,
      totalTtc: a.rentHt + a.rentTva + servicesHt + servicesTva,
      commission: commissions[i] ?? 0,
    };
  });
}

export interface InvoiceBreakdown {
  rentTtc: number;
  commission: number;
  vdiTtc: number;
  servicesSolinkTtc: number;
  insuranceTtc: number;
}

export function invoiceLines(a: ContractAmounts, commission: number) {
  const line1Ht = a.rentHt;
  const line1Tva = a.rentTva;
  const line2Ht = a.servicesSolinkHt + a.vdiHt + a.insuranceHt;
  const line2Tva = a.servicesSolinkTva + a.vdiTva + a.insuranceTva;
  const breakdown: InvoiceBreakdown = {
    rentTtc: a.rentHt + a.rentTva,
    commission,
    vdiTtc: a.vdiHt + a.vdiTva,
    servicesSolinkTtc: a.servicesSolinkHt + a.servicesSolinkTva,
    insuranceTtc: a.insuranceHt + a.insuranceTva,
  };
  return {
    line1Ht,
    line1Tva,
    line1Ttc: line1Ht + line1Tva,
    line2Ht,
    line2Tva,
    line2Ttc: line2Ht + line2Tva,
    totalTtc: line1Ht + line1Tva + line2Ht + line2Tva,
    breakdown,
  };
}

export type Bucket = { beneficiary: 'BANQUE' | 'ORANGE' | 'SOLINK'; component: 'LOYER' | 'COMMISSION_APPORTEUR' | 'VDI' | 'SERVICES_SOLINK' | 'ASSURANCE'; amount: number };

/**
 * Ventilation cible d'une facture : Loyer → Banque (net de la commission apporteur) ;
 * VDI + commission → Orange ; services + assurance → SOLINK (assurance reversée à l'assureur hors plateforme).
 */
export function targetBuckets(b: InvoiceBreakdown): Bucket[] {
  return [
    { beneficiary: 'BANQUE', component: 'LOYER', amount: b.rentTtc - b.commission },
    { beneficiary: 'ORANGE', component: 'COMMISSION_APPORTEUR', amount: b.commission },
    { beneficiary: 'ORANGE', component: 'VDI', amount: b.vdiTtc },
    { beneficiary: 'SOLINK', component: 'SERVICES_SOLINK', amount: b.servicesSolinkTtc },
    { beneficiary: 'SOLINK', component: 'ASSURANCE', amount: b.insuranceTtc },
  ];
}

/**
 * Ventile un encaissement sur le reste à ventiler de chaque composante, au prorata, de façon déterministe.
 * Le reliquat d'arrondi va à la première composante non soldée. Somme(ventilation) = montant encaissé (≤ reste dû).
 */
export function allocate(amount: number, remaining: Bucket[]): Bucket[] {
  const totalRemaining = remaining.reduce((a, b) => a + b.amount, 0);
  if (amount <= 0 || totalRemaining <= 0) return [];
  if (amount >= totalRemaining) return remaining.filter((b) => b.amount > 0).map((b) => ({ ...b }));
  const out = remaining.map((b) => ({ ...b, amount: Math.floor((b.amount * amount) / totalRemaining) }));
  let gap = amount - out.reduce((a, b) => a + b.amount, 0);
  for (let i = 0; gap > 0 && i < out.length; i++) {
    const room = remaining[i].amount - out[i].amount;
    const add = Math.min(room, gap);
    out[i].amount += add;
    gap -= add;
  }
  return out.filter((b) => b.amount > 0);
}

export const DUNNING_TEMPLATES: Record<string, { label: string; template: string }> = {
  J1_RAPPEL: { label: 'J+1 — Rappel', template: 'IMPAYE_RAPPEL' },
  J7_RELANCE: { label: 'J+7 — Relance', template: 'IMPAYE_RELANCE' },
  J15_VERROUILLAGE: { label: 'J+15 — Proposition de verrouillage à la banque', template: 'IMPAYE_PROPOSITION_VERROUILLAGE' },
  J30_MISE_EN_DEMEURE: { label: 'J+30 — Mise en demeure', template: 'IMPAYE_MISE_EN_DEMEURE' },
  J60_RESILIATION: { label: 'J+60 — Proposition de résiliation', template: 'IMPAYE_PROPOSITION_RESILIATION' },
};

/** Niveaux de relance dus pour un retard donné (jours après échéance). */
export function dunningLevelsDue(daysOverdue: number, cfg: Record<string, number>): string[] {
  return Object.entries(cfg)
    .filter(([, d]) => daysOverdue >= d)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
}

/** Pénalité de restitution A–E : % × prix d'achat résiduel (amortissement linéaire, plancher 20 %). */
export function residualValue(purchase: number, duration: number, monthsElapsed: number): number {
  const remaining = Math.max(0, duration - monthsElapsed);
  return Math.max(Math.round((purchase * remaining) / duration), Math.round(purchase * 0.2));
}

export function returnPenalty(grade: string, purchase: number, duration: number, monthsElapsed: number, grid: Record<string, number>) {
  const pctValue = grid[grade] ?? 0;
  const residual = residualValue(purchase, duration, monthsElapsed);
  return { pct: pctValue, residual, penalty: Math.round((residual * pctValue) / 100) };
}

export { addMonths };
