import Decimal from 'decimal.js';
import type { Params } from './params';

/**
 * Moteur de tarification v4 §6 — coefficient bailleur × base financée.
 * Calcul en Decimal, arrondi à l'unité FCFA par composante et par poste (ROUND_HALF_UP).
 */
export type Category = 'THIN_CLIENT' | 'LAPTOP' | 'MAC' | 'ECRAN' | 'DOCK' | 'CASQUE' | 'SACOCHE';
export type RangeCode = 'ESSENTIAL' | 'PRO' | 'PREMIUM';
export type Vdi = 'AUCUN' | 'STANDARD' | 'PERFORMANCE';

export const DEVICE_CATEGORIES: Category[] = ['THIN_CLIENT', 'LAPTOP', 'MAC'];
export const isDevice = (c: Category) => DEVICE_CATEGORIES.includes(c);

export type PricingParams = Pick<
  Params,
  | 'tva_pct'
  | 'coefficients'
  | 'marge_solink_pct'
  | 'frais_logistique_pct'
  | 'setup_solink_ht'
  | 'services_solink_ht'
  | 'vdi_orange_ht'
  | 'assurance_pct_an'
  | 'depot_mensualites'
  | 'durees_autorisees'
>;

export interface LineInput {
  purchasePrice: number;
  category: Category;
  range: RangeCode;
  quantity: number;
  vdiTier?: Vdi;
  insurance?: boolean;
}

export interface Components {
  purchase: number;
  logistics: number;
  setup: number;
  margin: number;
  base: number;
  coefficient: string;
  rentHt: number;
  rentTva: number;
  servicesSolinkHt: number;
  servicesSolinkTva: number;
  vdiHt: number;
  vdiTva: number;
  insuranceHt: number;
  insuranceTva: number;
  monthlyHt: number;
  monthlyTva: number;
  monthlyTtc: number;
}

export class PricingError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const D = (n: number | string) => new Decimal(n);
const round = (d: Decimal) => d.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();

export function coefficientFor(params: PricingParams, duration: number): string {
  if (!params.durees_autorisees.includes(duration))
    throw new PricingError('DUREE_NON_AUTORISEE', `Durée ${duration} mois non autorisée`);
  const c = params.coefficients[String(duration)];
  if (!c) throw new PricingError('COEFFICIENT_ABSENT', `Aucun coefficient pour ${duration} mois`);
  return c;
}

/** Composantes mensuelles pour UN poste. */
export function unitComponents(line: Omit<LineInput, 'quantity'>, duration: number, params: PricingParams): Components {
  if (!Number.isInteger(line.purchasePrice) || line.purchasePrice < 0)
    throw new PricingError('PRIX_INVALIDE', 'Prix d’achat invalide');
  const coef = coefficientFor(params, duration);
  const device = isDevice(line.category);
  const tva = D(params.tva_pct).div(100);
  const purchase = line.purchasePrice;
  const logistics = round(D(purchase).mul(params.frais_logistique_pct).div(100));
  const setup = device ? params.setup_solink_ht : 0;
  const margin = round(D(purchase).mul(params.marge_solink_pct[line.range] ?? 0).div(100));
  const base = purchase + logistics + setup + margin;
  const rentHt = round(D(base).mul(coef).div(100));
  const servicesSolinkHt = device ? params.services_solink_ht : 0;
  const vdiTier = line.vdiTier ?? 'AUCUN';
  if (vdiTier !== 'AUCUN' && line.category !== 'THIN_CLIENT')
    throw new PricingError('VDI_INCOMPATIBLE', 'La VDI Orange ne s’applique qu’aux thin clients');
  const vdiHt = vdiTier === 'AUCUN' ? 0 : (params.vdi_orange_ht[vdiTier] ?? 0);
  const insuranceHt = line.insurance === false ? 0 : round(D(purchase).mul(params.assurance_pct_an).div(100).div(12));
  const t = (n: number) => round(D(n).mul(tva));
  const rentTva = t(rentHt);
  const servicesSolinkTva = t(servicesSolinkHt);
  const vdiTva = t(vdiHt);
  const insuranceTva = t(insuranceHt);
  const monthlyHt = rentHt + servicesSolinkHt + vdiHt + insuranceHt;
  const monthlyTva = rentTva + servicesSolinkTva + vdiTva + insuranceTva;
  return {
    purchase,
    logistics,
    setup,
    margin,
    base,
    coefficient: coef,
    rentHt,
    rentTva,
    servicesSolinkHt,
    servicesSolinkTva,
    vdiHt,
    vdiTva,
    insuranceHt,
    insuranceTva,
    monthlyHt,
    monthlyTva,
    monthlyTtc: monthlyHt + monthlyTva,
  };
}

export interface QuoteTotals {
  seats: number;
  monthlyHt: number;
  monthlyTva: number;
  monthlyTtc: number;
  rentHt: number;
  rentTva: number;
  servicesHt: number;
  servicesTva: number;
  servicesSolinkHt: number;
  vdiHt: number;
  insuranceHt: number;
  financedAmount: number;
  purchaseTotal: number;
  depositTtc: number;
  firstRentTtc: number;
  totalContractTtc: number;
}

export interface PricedLine<T> {
  input: T;
  unit: Components;
  lineMonthlyTtc: number;
}

/** Totaux d'un panier/devis. Somme des postes = total affiché (pas d'écart d'arrondi : arrondi par poste). */
export function priceCart<T extends LineInput>(
  lines: T[],
  duration: number,
  params: PricingParams,
): { lines: PricedLine<T>[]; totals: QuoteTotals } {
  const priced = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1)
      throw new PricingError('QUANTITE_INVALIDE', 'Quantité invalide');
    const unit = unitComponents(l, duration, params);
    return { input: l, unit, lineMonthlyTtc: unit.monthlyTtc * l.quantity };
  });
  const sum = (f: (c: Components) => number) => priced.reduce((a, p) => a + f(p.unit) * p.input.quantity, 0);
  const monthlyTtc = sum((c) => c.monthlyTtc);
  const totals: QuoteTotals = {
    seats: priced.filter((p) => isDevice(p.input.category)).reduce((a, p) => a + p.input.quantity, 0),
    monthlyHt: sum((c) => c.monthlyHt),
    monthlyTva: sum((c) => c.monthlyTva),
    monthlyTtc,
    rentHt: sum((c) => c.rentHt),
    rentTva: sum((c) => c.rentTva),
    servicesHt: sum((c) => c.servicesSolinkHt + c.vdiHt + c.insuranceHt),
    servicesTva: sum((c) => c.servicesSolinkTva + c.vdiTva + c.insuranceTva),
    servicesSolinkHt: sum((c) => c.servicesSolinkHt),
    vdiHt: sum((c) => c.vdiHt),
    insuranceHt: sum((c) => c.insuranceHt),
    financedAmount: sum((c) => c.base),
    purchaseTotal: sum((c) => c.purchase),
    depositTtc: monthlyTtc * params.depot_mensualites,
    firstRentTtc: monthlyTtc,
    totalContractTtc: monthlyTtc * duration,
  };
  return { lines: priced, totals };
}

/** Commission apporteur mensualisée : 3 % du montant financé / durée, reliquat d'arrondi sur la dernière échéance. */
export function commissionSchedule(financedAmount: number, pctValue: number, duration: number): number[] {
  const total = round(D(financedAmount).mul(pctValue).div(100));
  const monthly = Math.floor(total / duration);
  const out = Array.from({ length: duration }, () => monthly);
  out[duration - 1] += total - monthly * duration;
  return out;
}

export function commissionTotal(financedAmount: number, pctValue: number): number {
  return round(D(financedAmount).mul(pctValue).div(100));
}
