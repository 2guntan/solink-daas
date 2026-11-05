/**
 * Moteur de scoring déterministe, paramétré par le financeur (v4 §7.5, CLAUDE.md §4).
 * Grille 100 pts : Ancienneté 15 · Taille CA 15 · Rentabilité 20 · Endettement 15 · Couverture loyer 20 · BIC 10 · Orange 5.
 * Le moteur PROPOSE une voie ; il ne décide jamais (garde-fou v4 §15).
 */
export type BicResult = 'AUCUN_INCIDENT' | 'INCIDENT_MINEUR' | 'INCIDENT_GRAVE';

export const SCORING_RULESET_VERSION = 'BANQUE_PILOTE-RS-1';

export interface ScoringInput {
  createdOn: Date | null;
  today: Date;
  sector: string | null;
  beDeclared: boolean;
  ca: number;
  rex: number;
  rn: number;
  cp: number;
  dettes: number;
  annualRentHt: number;
  bic: BicResult;
  orangeScore: number | null;
}

export interface ScoringRules {
  anciennete_min_mois: number;
  secteurs_exclus: string[];
  accord_auto_score_min: number;
  instruction_score_min: number;
}

export interface Factor {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoringResult {
  score: number;
  riskClass: 'A' | 'B' | 'C' | 'D';
  factors: Factor[];
  knockouts: string[];
  rulesetVersion: string;
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

const pctStr = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

export function score(input: ScoringInput, rules: ScoringRules): ScoringResult {
  const factors: Factor[] = [];
  const knockouts: string[] = [];
  const ageMonths = input.createdOn ? monthsBetween(input.createdOn, input.today) : 0;

  // Knock-outs
  if (ageMonths < rules.anciennete_min_mois) knockouts.push(`Entreprise de moins de ${rules.anciennete_min_mois} mois`);
  if (input.bic === 'INCIDENT_GRAVE') knockouts.push('Incident BIC grave');
  if (input.sector && rules.secteurs_exclus.includes(input.sector)) knockouts.push(`Secteur exclu (${input.sector})`);
  if (!input.beDeclared) knockouts.push('Bénéficiaires effectifs non déclarés');

  // Ancienneté (15)
  const years = ageMonths / 12;
  const anc = years >= 10 ? 15 : years >= 5 ? 10 : years >= 2 ? 5 : 0;
  factors.push({ key: 'anciennete', label: 'Ancienneté', points: anc, max: 15, detail: `${Math.floor(years)} ans` });

  // Taille CA (15)
  const ca = input.ca;
  const taille = ca >= 10_000_000_000 ? 15 : ca >= 2_000_000_000 ? 10 : ca >= 500_000_000 ? 6 : ca > 0 ? 2 : 0;
  factors.push({ key: 'taille', label: 'Taille (chiffre d’affaires)', points: taille, max: 15, detail: `${Math.round(ca / 1_000_000)} M FCFA` });

  // Rentabilité (20) : résultat net / CA
  const marge = ca > 0 ? input.rn / ca : -1;
  const rent = marge >= 0.1 ? 20 : marge >= 0.05 ? 14 : marge >= 0 ? 7 : 0;
  factors.push({ key: 'rentabilite', label: 'Rentabilité (RN / CA)', points: rent, max: 20, detail: ca > 0 ? pctStr(marge) : 'n.d.' });

  // Endettement (15) : dettes financières / capitaux propres
  const gearing = input.cp > 0 ? input.dettes / input.cp : Infinity;
  const endt = gearing <= 0.5 ? 15 : gearing <= 1 ? 10 : gearing <= 2 ? 5 : 0;
  factors.push({
    key: 'endettement',
    label: 'Endettement (dettes fin. / capitaux propres)',
    points: endt,
    max: 15,
    detail: Number.isFinite(gearing) ? gearing.toFixed(2).replace('.', ',') : 'capitaux propres ≤ 0',
  });

  // Couverture du loyer (20) : loyers annuels / résultat d'exploitation
  const couv = input.rex > 0 ? input.annualRentHt / input.rex : Infinity;
  const cv = couv <= 0.1 ? 20 : couv <= 0.2 ? 14 : couv <= 0.35 ? 7 : 0;
  factors.push({
    key: 'couverture',
    label: 'Couverture du loyer (loyers annuels / REX)',
    points: cv,
    max: 20,
    detail: Number.isFinite(couv) ? pctStr(couv) : 'REX ≤ 0',
  });

  // BIC (10)
  const bic = input.bic === 'AUCUN_INCIDENT' ? 10 : input.bic === 'INCIDENT_MINEUR' ? 4 : 0;
  factors.push({ key: 'bic', label: 'Historique BIC', points: bic, max: 10, detail: input.bic.replace(/_/g, ' ').toLowerCase() });

  // Orange (5)
  const os = input.orangeScore;
  const or = os === null ? 0 : Math.round(Math.max(0, Math.min(100, os)) / 20);
  factors.push({ key: 'orange', label: 'Historique de paiement Orange', points: or, max: 5, detail: os === null ? 'aucun' : `${os}/100` });

  const total = factors.reduce((a, f) => a + f.points, 0);
  const riskClass = total >= 80 ? 'A' : total >= 70 ? 'B' : total >= 50 ? 'C' : 'D';
  return { score: total, riskClass, factors, knockouts, rulesetVersion: SCORING_RULESET_VERSION };
}

export interface RouteInput {
  score: number;
  knockouts: string[];
  whitelisted: boolean;
  amount: number;
  perClientCap: number;
  clientExposure: number; // encours déjà réservé/consommé pour ce client
  envelopeAvailable: number;
  envelopeActive: boolean;
}

export type Route = 'AUTO' | 'ANALYSTE' | 'REFUS_PROPOSE';

/** Voie recommandée (v4 §7.6). Accord auto = liste blanche ET score ≥ seuil ET montant ≤ plafond ET aucun KO. */
export function recommendRoute(r: RouteInput, rules: ScoringRules): { route: Route; reasons: string[] } {
  if (r.knockouts.length) return { route: 'REFUS_PROPOSE', reasons: r.knockouts };
  const reasons: string[] = [];
  if (!r.whitelisted) reasons.push('Client hors liste blanche');
  if (r.score < rules.accord_auto_score_min) reasons.push(`Score ${r.score} < ${rules.accord_auto_score_min}`);
  if (r.clientExposure + r.amount > r.perClientCap) reasons.push('Plafond par client dépassé');
  if (!r.envelopeActive) reasons.push('Enveloppe inactive ou échue');
  if (r.amount > r.envelopeAvailable) reasons.push('Solde d’enveloppe insuffisant');
  return reasons.length ? { route: 'ANALYSTE', reasons } : { route: 'AUTO', reasons: ['Règle d’accord automatique satisfaite'] };
}

/** Échantillonnage a posteriori déterministe (hash de la référence). */
export function isSampled(ref: string, pctValue: number): boolean {
  let h = 0;
  for (const ch of ref) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100 < pctValue;
}
