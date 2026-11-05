import type { Tx } from '@solink/db';

/** Valeurs de démonstration (CLAUDE.md §4) — fictives, stockées en base et versionnées. */
export const DEFAULT_PARAMS = {
  tva_pct: 18,
  durees_autorisees: [24, 36],
  coefficients: { '24': '4.95', '36': '3.55' } as Record<string, string>,
  valeur_residuelle_pct: 0,
  marge_solink_pct: { ESSENTIAL: 12, PRO: 14, PREMIUM: 15 } as Record<string, number>,
  frais_logistique_pct: 4,
  setup_solink_ht: 15000,
  services_solink_ht: 6500,
  vdi_orange_ht: { STANDARD: 12000, PERFORMANCE: 19000 } as Record<string, number>,
  assurance_pct_an: 1.2,
  depot_mensualites: 1,
  commission_apporteur_pct: 3,
  validite_devis_jours: 15,
  validite_accord_jours: 60,
  seuil_approbation_interne: 2_000_000,
  accord_auto_score_min: 70,
  instruction_score_min: 50,
  anciennete_min_mois: 24,
  secteurs_exclus: ['JEUX_PARIS'],
  echantillonnage_auto_pct: 10,
  relances_jours: { J1_RAPPEL: 1, J7_RELANCE: 7, J15_VERROUILLAGE: 15, J30_MISE_EN_DEMEURE: 30, J60_RESILIATION: 60 } as Record<
    string,
    number
  >,
  facture_jour_emission: 1,
  facture_jour_echeance: 15,
  grille_restitution_pct: { A: 0, B: 5, C: 15, D: 40, E: 100 } as Record<string, number>,
  sla_analyste_jours_ouvres: 2,
  validite_enveloppe_signature_jours: 7,
};

export type Params = typeof DEFAULT_PARAMS;
export type ParamKey = keyof Params;

export const PARAM_OWNERS: Record<ParamKey, 'BANQUE' | 'SOLINK'> = {
  tva_pct: 'SOLINK',
  durees_autorisees: 'BANQUE',
  coefficients: 'BANQUE',
  valeur_residuelle_pct: 'BANQUE',
  marge_solink_pct: 'SOLINK',
  frais_logistique_pct: 'SOLINK',
  setup_solink_ht: 'SOLINK',
  services_solink_ht: 'SOLINK',
  vdi_orange_ht: 'SOLINK',
  assurance_pct_an: 'SOLINK',
  depot_mensualites: 'BANQUE',
  commission_apporteur_pct: 'SOLINK',
  validite_devis_jours: 'SOLINK',
  validite_accord_jours: 'BANQUE',
  seuil_approbation_interne: 'SOLINK',
  accord_auto_score_min: 'BANQUE',
  instruction_score_min: 'BANQUE',
  anciennete_min_mois: 'BANQUE',
  secteurs_exclus: 'BANQUE',
  echantillonnage_auto_pct: 'BANQUE',
  relances_jours: 'SOLINK',
  facture_jour_emission: 'SOLINK',
  facture_jour_echeance: 'SOLINK',
  grille_restitution_pct: 'SOLINK',
  sla_analyste_jours_ouvres: 'BANQUE',
  validite_enveloppe_signature_jours: 'SOLINK',
};

export const PARAM_LABELS: Record<ParamKey, string> = {
  tva_pct: 'TVA (%)',
  durees_autorisees: 'Durées autorisées (mois)',
  coefficients: 'Coefficients mensuels (% base financée) par durée',
  valeur_residuelle_pct: 'Valeur résiduelle (%)',
  marge_solink_pct: 'Marge SOLINK matériel par gamme (%)',
  frais_logistique_pct: 'Frais logistique + douane (% prix d’achat)',
  setup_solink_ht: 'Setup SOLINK HT / poste',
  services_solink_ht: 'Services SOLINK HT / poste / mois',
  vdi_orange_ht: 'VDI Orange HT / poste / mois',
  assurance_pct_an: 'Assurance (% prix d’achat / an)',
  depot_mensualites: 'Dépôt de garantie (mensualités TTC)',
  commission_apporteur_pct: 'Commission apporteur Orange (% montant financé)',
  validite_devis_jours: 'Validité devis (jours)',
  validite_accord_jours: 'Validité accord (jours)',
  seuil_approbation_interne: 'Seuil approbation interne par défaut (FCFA / mois)',
  accord_auto_score_min: 'Score minimum accord auto',
  instruction_score_min: 'Score minimum instruction',
  anciennete_min_mois: 'Ancienneté minimum (mois) — knock-out',
  secteurs_exclus: 'Secteurs exclus — knock-out',
  echantillonnage_auto_pct: 'Échantillonnage accords auto (%)',
  relances_jours: 'Relances impayé (jours après échéance)',
  facture_jour_emission: 'Jour d’émission facture Orange',
  facture_jour_echeance: 'Jour d’échéance facture Orange',
  grille_restitution_pct: 'Grille de restitution A–E (% prix d’achat résiduel)',
  sla_analyste_jours_ouvres: 'SLA dossier analyste (jours ouvrés)',
  validite_enveloppe_signature_jours: 'Validité enveloppe de signature (jours)',
};

/** Charge la dernière version de chaque paramètre, complétée par les valeurs par défaut. */
export async function getParams(db: Tx): Promise<Params & { __version: string }> {
  const rows = await db.parameter.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
  const out: Record<string, unknown> = { ...DEFAULT_PARAMS };
  const seen = new Set<string>();
  let maxVersion = 0;
  for (const r of rows) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    out[r.key] = r.value;
    maxVersion = Math.max(maxVersion, r.version);
  }
  return { ...(out as Params), __version: `PARAMS-v${rows.length ? rows.length : 0}` };
}

export async function setParam(db: Tx, key: ParamKey, value: unknown, userId: string, at: Date) {
  const last = await db.parameter.findFirst({ where: { key }, orderBy: { version: 'desc' } });
  return db.parameter.create({
    data: {
      key,
      value: value as object,
      version: (last?.version ?? 0) + 1,
      effectiveFrom: at,
      ownerType: PARAM_OWNERS[key],
      label: PARAM_LABELS[key],
      updatedById: userId,
    },
  });
}
