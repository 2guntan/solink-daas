import type { Segment } from '@solink/db';

/** Checklist dynamique par segment (v4 §7.3). required: ● obligatoire ; onDemand: ○ ; absent: — */
export interface ChecklistItem {
  type: string;
  label: string;
  validityDays?: number; // validité max de la pièce (ex. RCCM < 3 mois)
}

export const DOC_TYPES: Record<string, ChecklistItem> = {
  RCCM: { type: 'RCCM', label: 'Extrait RCCM (< 3 mois)', validityDays: 90 },
  NINEA: { type: 'NINEA', label: 'Attestation NINEA' },
  STATUTS: { type: 'STATUTS', label: 'Statuts à jour' },
  POUVOIRS: { type: 'POUVOIRS', label: 'PV / délégation de pouvoirs des signataires' },
  CNI_DIRIGEANT: { type: 'CNI_DIRIGEANT', label: 'Pièce d’identité des dirigeants et signataires' },
  BENEFICIAIRES: { type: 'BENEFICIAIRES', label: 'Déclaration des bénéficiaires effectifs (< 12 mois)', validityDays: 365 },
  ETATS_FIN_N1: { type: 'ETATS_FIN_N1', label: 'États financiers SYSCOHADA — exercice N-1' },
  ETATS_FIN_N2: { type: 'ETATS_FIN_N2', label: 'États financiers SYSCOHADA — exercice N-2' },
  ETATS_FIN_N3: { type: 'ETATS_FIN_N3', label: 'États financiers SYSCOHADA — exercice N-3' },
  RAPPORTS_BAILLEURS: { type: 'RAPPORTS_BAILLEURS', label: 'Rapports aux bailleurs de fonds' },
  ATTESTATION_FISCALE: { type: 'ATTESTATION_FISCALE', label: 'Attestation de régularité fiscale' },
  ATTESTATION_SOCIALE: { type: 'ATTESTATION_SOCIALE', label: 'Attestation sociale (CSS / IPRES)' },
  RELEVES_BANCAIRES: { type: 'RELEVES_BANCAIRES', label: 'Relevés bancaires des 6 derniers mois (< 1 mois)', validityDays: 30 },
  RIB: { type: 'RIB', label: 'RIB du compte de prélèvement' },
  AGREMENT: { type: 'AGREMENT', label: 'Agrément / licence (BCEAO, ARCA…)' },
  ACCORD_SIEGE: { type: 'ACCORD_SIEGE', label: 'Accord de siège' },
  ACTE_BUDGETAIRE: { type: 'ACTE_BUDGETAIRE', label: 'Acte budgétaire / engagement de dépense' },
  ACTE_NOMINATION: { type: 'ACTE_NOMINATION', label: 'Acte de nomination des signataires' },
  CAUTION: { type: 'CAUTION', label: 'Acte de caution du dirigeant' },
  AUTRE: { type: 'AUTRE', label: 'Autre pièce demandée' },
};

const REQUIRED: Record<Segment, string[]> = {
  GRANDE_ENTREPRISE: ['RCCM', 'NINEA', 'STATUTS', 'POUVOIRS', 'CNI_DIRIGEANT', 'BENEFICIAIRES', 'ETATS_FIN_N1', 'ETATS_FIN_N2', 'ATTESTATION_FISCALE', 'RIB'],
  PME: ['RCCM', 'NINEA', 'STATUTS', 'POUVOIRS', 'CNI_DIRIGEANT', 'BENEFICIAIRES', 'ETATS_FIN_N1', 'ETATS_FIN_N2', 'ETATS_FIN_N3', 'ATTESTATION_FISCALE', 'ATTESTATION_SOCIALE', 'RELEVES_BANCAIRES', 'RIB'],
  INSTITUTION_FINANCIERE: ['RCCM', 'NINEA', 'STATUTS', 'POUVOIRS', 'CNI_DIRIGEANT', 'BENEFICIAIRES', 'ETATS_FIN_N1', 'ETATS_FIN_N2', 'ATTESTATION_FISCALE', 'RIB', 'AGREMENT'],
  PUBLIC: ['NINEA', 'ACTE_NOMINATION', 'CNI_DIRIGEANT', 'RIB', 'ACTE_BUDGETAIRE'],
  ONG: ['NINEA', 'STATUTS', 'POUVOIRS', 'CNI_DIRIGEANT', 'BENEFICIAIRES', 'ETATS_FIN_N1', 'ETATS_FIN_N2', 'RAPPORTS_BAILLEURS', 'RIB', 'ACCORD_SIEGE'],
};

/** ○ sur demande du financeur */
export const ON_DEMAND: Record<Segment, string[]> = {
  GRANDE_ENTREPRISE: ['ATTESTATION_SOCIALE', 'RELEVES_BANCAIRES'],
  PME: [],
  INSTITUTION_FINANCIERE: ['ATTESTATION_SOCIALE'],
  PUBLIC: [],
  ONG: ['ATTESTATION_FISCALE', 'ATTESTATION_SOCIALE', 'RELEVES_BANCAIRES'],
};

export const CHECKLIST_VERSION = (segment: Segment) => `${segment}-2026-11`;

/** Liste blanche : la v4 permet de remplacer une partie des pièces financières (ici : N-2). */
export function checklistFor(segment: Segment, opts: { whitelisted?: boolean } = {}): ChecklistItem[] {
  let types = REQUIRED[segment];
  if (opts.whitelisted) types = types.filter((t) => t !== 'ETATS_FIN_N2' && t !== 'ETATS_FIN_N3');
  return types.map((t) => DOC_TYPES[t]);
}

/** Contrôle de validité (v4 §7.4 et Gherkin « Extrait RCCM de plus de 3 mois »). */
export function validityCheck(type: string, docDate: Date | null, today: Date): string | null {
  const item = DOC_TYPES[type];
  if (!item?.validityDays || !docDate) return null;
  const ageDays = Math.floor((today.getTime() - docDate.getTime()) / 86_400_000);
  if (ageDays > item.validityDays) {
    if (type === 'RCCM') return 'Extrait de plus de 3 mois';
    return `Pièce de plus de ${item.validityDays} jours`;
  }
  return null;
}

/** Les 5 blocs du dossier (v4 §7.2). */
export const BLOCKS = [
  { key: 'entreprise', label: 'Entreprise' },
  { key: 'dirigeants', label: 'Dirigeants & bénéficiaires effectifs' },
  { key: 'finances', label: 'Finances' },
  { key: 'pieces', label: 'Pièces justificatives' },
  { key: 'declarations', label: 'Consentements & déclarations' },
] as const;

export interface FinancialYear {
  year: number;
  ca: number;
  rex: number;
  rn: number;
  cp: number;
  dettes: number;
  tresorerie: number;
}

export interface DossierBlocks {
  entreprise?: {
    name?: string;
    ninea?: string;
    rccm?: string;
    legalForm?: string;
    createdOn?: string;
    capital?: number;
    address?: string;
    activity?: string;
    employees?: number;
    banks?: string;
    group?: string;
    complete?: boolean;
  };
  dirigeants?: {
    persons?: { type: string; firstName: string; lastName: string; role?: string; ownershipPct?: number; ppe?: boolean }[];
    complete?: boolean;
  };
  finances?: { years?: FinancialYear[]; commitments?: string; complete?: boolean };
  declarations?: { exactitude?: boolean; ppe?: boolean; orange?: boolean; complete?: boolean };
}

export function requiredYears(segment: Segment): number {
  return segment === 'PME' ? 3 : segment === 'PUBLIC' ? 0 : 2;
}

export function blockCompletion(
  segment: Segment,
  blocks: DossierBlocks,
  docs: { required: boolean; status: string; origin: string }[],
): Record<string, number> {
  const e = blocks.entreprise ?? {};
  const entFields = [e.name, e.ninea, e.legalForm, e.createdOn, e.address, e.activity, e.employees];
  const entreprise = Math.round((entFields.filter((x) => x !== undefined && x !== '' && x !== null).length / entFields.length) * 100);
  const persons = blocks.dirigeants?.persons ?? [];
  const hasDir = persons.some((p) => p.type === 'DIRIGEANT');
  const hasSig = persons.some((p) => p.type === 'SIGNATAIRE');
  const hasBe = persons.some((p) => p.type === 'BENEFICIAIRE_EFFECTIF') || segment === 'PUBLIC';
  const dirigeants = Math.round(([hasDir, hasSig, hasBe].filter(Boolean).length / 3) * 100);
  const ny = requiredYears(segment);
  const years = (blocks.finances?.years ?? []).filter((y) => y.ca > 0).length;
  const finances = ny === 0 ? 100 : Math.min(100, Math.round((years / ny) * 100));
  const req = docs.filter((d) => d.required && d.origin === 'CHECKLIST');
  const okDocs = req.filter((d) => ['EN_VERIFICATION', 'VALIDEE', 'NON_APPLICABLE'].includes(d.status)).length;
  const pieces = req.length ? Math.round((okDocs / req.length) * 100) : 100;
  const d = blocks.declarations ?? {};
  const declarations = d.exactitude ? 100 : 0;
  return { entreprise, dirigeants, finances, pieces, declarations };
}
