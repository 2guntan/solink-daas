import { fcfa, date, dateTime } from '../format';
import { RANGE_LABEL, CONDITION_LABEL } from '../status';
import type { DocSpec, Block } from './render';
import type { Components } from '../pricing';

const MONTAGE2 = (financer: string) =>
  `Montage 2 — Bailleur et propriétaire des équipements : ${financer}. Facturation : Orange Business pour compte du bailleur. Fournisseur-opérateur : SOLINK. La plateforme ne détient aucun fonds.`;

export interface QuoteDocInput {
  ref: string;
  version: number;
  issuedAt: Date;
  validUntil: Date;
  org: { name: string; ninea: string | null; address: string | null };
  financer: string;
  apporteur?: string | null;
  duration: number;
  lines: { label: string; range: string; site: string; quantity: number; unit: Components; lineMonthlyTtc: number; vdiTier: string; insurance: boolean }[];
  totals: { monthlyHt: number; monthlyTva: number; monthlyTtc: number; depositTtc: number; totalContractTtc: number; seats: number };
  parameterVersion: string;
}

export function quoteSpec(q: QuoteDocInput): DocSpec {
  return {
    title: `Devis ${q.ref}-v${q.version}`,
    ref: `${q.ref}-v${q.version}`,
    subtitle: `Émis le ${date(q.issuedAt)} — valable jusqu’au ${date(q.validUntil)} — durée ${q.duration} mois`,
    blocks: [
      { kind: 'kv', rows: [['Client', q.org.name], ['NINEA', q.org.ninea ?? '—'], ['Adresse', q.org.address ?? '—'], ['Bailleur', q.financer], ['Apporteur', q.apporteur ?? '—']] },
      { kind: 'h', text: 'Détail des lignes (mensualités par poste)' },
      {
        kind: 'table',
        head: ['Désignation', 'Site', 'Qté', 'Loyer HT', 'Services HT', 'TTC / poste', 'TTC / mois'],
        widths: [26, 16, 6, 13, 13, 13, 13],
        rows: q.lines.map((l) => [
          `${l.label} (${RANGE_LABEL[l.range] ?? l.range})${l.vdiTier !== 'AUCUN' ? ` + VDI ${l.vdiTier.toLowerCase()}` : ''}${l.insurance ? ' + assurance' : ''}`,
          l.site,
          String(l.quantity),
          fcfa(l.unit.rentHt),
          fcfa(l.unit.servicesSolinkHt + l.unit.vdiHt + l.unit.insuranceHt),
          fcfa(l.unit.monthlyTtc),
          fcfa(l.lineMonthlyTtc),
        ]),
        total: ['Total mensuel TTC', '', String(q.totals.seats), '', '', '', fcfa(q.totals.monthlyTtc)],
      },
      {
        kind: 'kv',
        rows: [
          ['Mensualité HT', fcfa(q.totals.monthlyHt)],
          ['TVA (18 %, valeur de démo)', fcfa(q.totals.monthlyTva)],
          ['Mensualité TTC', fcfa(q.totals.monthlyTtc)],
          ['Dépôt de garantie (1 mensualité TTC)', fcfa(q.totals.depositTtc)],
          ['Coût total du contrat TTC', fcfa(q.totals.totalContractTtc)],
        ],
      },
      { kind: 'note', text: MONTAGE2(q.financer) },
      { kind: 'note', text: `Prix garantis jusqu’au ${date(q.validUntil)} (paramètres ${q.parameterVersion}). Conditions générales : /cgu. Équipements propriété de la banque, à restituer en fin de contrat (grille A–E).` },
      { kind: 'signatures', items: [{ role: 'Émis et signé électroniquement par', name: 'SOLINK Professional Services', signedAt: dateTime(q.issuedAt) }] },
    ],
  };
}

export function demoPieceSpec(label: string, org: { name: string; ninea: string | null }, extra: [string, string][] = []): DocSpec {
  return {
    title: label,
    ref: 'PIÈCE DE DÉMONSTRATION',
    subtitle: 'DOCUMENT FICTIF — DÉMO',
    blocks: [
      { kind: 'kv', rows: [['Organisation', org.name], ['NINEA', org.ninea ?? '—'], ...extra] },
      { kind: 'p', text: 'Ce document est entièrement fictif. Il illustre une pièce justificative de la checklist du dossier de crédit (v4 §7.3).' },
      { kind: 'note', text: 'DOCUMENT FICTIF — DÉMO — ne pas utiliser à des fins réelles.' },
    ],
  };
}

export interface ContractDocInput {
  contractRef: string;
  orderRef: string;
  org: { name: string; ninea: string | null; rccm: string | null; address: string | null };
  financer: string;
  duration: number;
  monthlyTtc: number;
  depositTtc: number;
  financedAmount: number;
  lines: { label: string; quantity: number; site: string; unitTtc: number }[];
  serials?: { serial: string; label: string; site: string }[];
  schedule?: { number: number; dueDate: Date; totalTtc: number }[];
  conditions: { type: string; nature: string; label: string }[];
  depositReference: string;
  signers?: { role: string; name: string; signedAt?: string; hash?: string }[];
}

const sigBlock = (c: ContractDocInput, roles: string[]): Block[] =>
  c.signers ? [{ kind: 'signatures', items: c.signers.filter((s) => roles.some((r) => s.role.startsWith(r))) }] : [];

/** Pack contractuel v4 §9.1. */
export function contractPackSpecs(c: ContractDocInput): { kind: string; title: string; spec: DocSpec }[] {
  const header: Block = { kind: 'kv', rows: [['Contrat', c.contractRef], ['Commande', c.orderRef], ['Locataire', `${c.org.name} — NINEA ${c.org.ninea ?? '—'} — RCCM ${c.org.rccm ?? '—'}`], ['Bailleur', c.financer]] };
  const mk = (kind: string, title: string, blocks: Block[], roles = ['Client', 'Co-signataire', 'Banque']) => ({
    kind,
    title,
    spec: { title, ref: c.contractRef, blocks: [header, ...blocks, ...sigBlock(c, roles)] } as DocSpec,
  });
  return [
    mk('CGL', 'Conditions générales de location (v2026-11)', [
      { kind: 'p', text: '1. Objet : location financière d’équipements informatiques et de services associés. 2. Propriété : les équipements restent la propriété du bailleur. 3. Durée : ferme, sans faculté de résiliation anticipée hors avenant. 4. Loyers : payables mensuellement via la facture Orange Business émise pour compte du bailleur. 5. Restitution : en fin de contrat selon la grille A–E.' },
    ], ['Client', 'Co-signataire']),
    mk('CONTRAT', 'Conditions particulières — contrat de location financière', [
      { kind: 'kv', rows: [['Durée', `${c.duration} mois`], ['Mensualité TTC (toutes composantes)', fcfa(c.monthlyTtc)], ['Montant financé', fcfa(c.financedAmount)], ['Dépôt de garantie', `${fcfa(c.depositTtc)} — à verser au compte désigné par la banque, réf. ${c.depositReference}`], ['Départ du loyer', '1er jour du mois suivant le dernier PV de livraison']] },
      ...(c.conditions.length ? [{ kind: 'h', text: 'Conditions de l’accord' } as Block, { kind: 'table', head: ['Condition', 'Nature', 'Détail'], rows: c.conditions.map((x) => [CONDITION_LABEL[x.type] ?? x.type, x.nature === 'PREALABLE' ? 'Préalable à la signature' : 'Suspensive (avant achat)', x.label]) } as Block] : []),
      { kind: 'note', text: MONTAGE2(c.financer) },
    ]),
    mk('ANNEXE_1', 'Annexe 1 — Liste des équipements', [
      { kind: 'table', head: ['Équipement', 'Site', 'Qté'], rows: c.lines.map((l) => [l.label, l.site, String(l.quantity)]), widths: [55, 30, 15] },
      ...(c.serials?.length ? [{ kind: 'h', text: 'Numéros de série (mise à jour au PV)' } as Block, { kind: 'table', head: ['N° de série', 'Équipement', 'Site'], rows: c.serials.map((s) => [s.serial, s.label, s.site]) } as Block] : [{ kind: 'note', text: 'Les numéros de série seront ajoutés à la signature du PV de livraison.' } as Block]),
    ]),
    mk('ANNEXE_2', 'Annexe 2 — Échéancier', [
      c.schedule?.length
        ? { kind: 'table', head: ['N°', 'Échéance', 'Montant TTC'], rows: c.schedule.map((s) => [String(s.number), date(s.dueDate), fcfa(s.totalTtc)]) }
        : { kind: 'p', text: `${c.duration} échéances mensuelles de ${fcfa(c.monthlyTtc)} TTC, émises le 1er et payables le 15 de chaque mois, à compter du 1er jour du mois suivant le dernier PV.` },
    ]),
    mk('ANNEXE_3', 'Annexe 3 — Services (SOLINK : support, MDM, SLA ; Orange : VDI, connectivité)', [
      { kind: 'p', text: 'SOLINK : support N1/N2, gestion de parc, MDM Intune/Autopilot, remplacement sous 48 h ouvrées à Dakar. Orange Business : virtualisation des postes (VDI) selon le niveau souscrit.' },
    ], ['Client', 'Co-signataire']),
    mk('ANNEXE_4', 'Annexe 4 — Politique MDM et verrouillage', [
      { kind: 'p', text: 'En cas d’impayé, un verrouillage des équipements peut être proposé à J+15. Il n’est exécuté par SOLINK que sur ordre écrit du bailleur, et levé dès régularisation.' },
    ], ['Client', 'Co-signataire']),
    mk('ANNEXE_5', 'Annexe 5 — Restitution et grille A–E', [
      { kind: 'table', head: ['Grade', 'État', 'Pénalité (% prix d’achat résiduel)'], rows: [['A', 'Comme neuf', '0 %'], ['B', 'Usure légère', '5 %'], ['C', 'Usure marquée', '15 %'], ['D', 'Endommagé', '40 %'], ['E', 'Hors d’usage / manquant', '100 %']] },
    ], ['Client', 'Co-signataire']),
    mk('ANNEXE_6', 'Annexe 6 — Assurance (adhésion)', [
      { kind: 'p', text: 'Adhésion au contrat groupe casse/vol (assureur de démo). Prime : 1,2 % du prix d’achat par an, mensualisée et incluse dans la ligne services.' },
    ], ['Client', 'Co-signataire']),
    mk('MANDAT_FACTURATION', 'Mandat de facturation et de recouvrement (Orange pour compte de la banque)', [
      { kind: 'p', text: `Le locataire est informé et accepte qu’Orange Business émette les factures et recouvre les loyers pour le compte de ${c.financer}, les fonds étant reçus sur un compte de cantonnement au nom du bailleur.` },
    ], ['Client', 'Co-signataire']),
    mk('MANDAT_PRELEVEMENT', 'Mandat de prélèvement', [
      { kind: 'p', text: 'Le locataire autorise le prélèvement mensuel des factures Orange Business sur le compte désigné (prélèvement bancaire au pilote ; Wave / Orange Money en phase 2).' },
    ], ['Client', 'Co-signataire']),
  ];
}

export function pvSpec(i: { orderRef: string; contractRef: string; site: string; serials: { serial: string; label: string }[]; reserves?: string | null; signer?: string; signedAt?: Date | null; photos: number }): DocSpec {
  return {
    title: `PV de livraison — ${i.site}`,
    ref: `${i.contractRef} / ${i.orderRef}`,
    blocks: [
      { kind: 'table', head: ['N° de série', 'Équipement'], rows: i.serials.map((s) => [s.serial, s.label]), widths: [40, 60] },
      { kind: 'kv', rows: [['Photos jointes', String(i.photos)], ['Réserves', i.reserves || 'Aucune']] },
      { kind: 'signatures', items: [{ role: 'Réceptionnaire client', name: i.signer ?? '—', signedAt: i.signedAt ? dateTime(i.signedAt) : undefined }, { role: 'Livreur SOLINK', name: 'Équipe logistique SOLINK', signedAt: i.signedAt ? dateTime(i.signedAt) : undefined }] },
    ],
  };
}

export function invoiceSpec(i: { ref: string; period: string; issueDate: Date; dueDate: Date; client: string; ninea: string | null; contractRef: string; financer: string; line1Ht: number; line1Tva: number; line1Ttc: number; line2Ht: number; line2Tva: number; line2Ttc: number; totalTtc: number }): DocSpec {
  return {
    title: `Facture ${i.ref}`,
    ref: i.ref,
    issuer: 'Orange Business Sénégal — mandataire de facturation (démo)',
    subtitle: `Période ${i.period} — émise le ${date(i.issueDate)} — échéance ${date(i.dueDate)}`,
    blocks: [
      { kind: 'kv', rows: [['Client', i.client], ['NINEA', i.ninea ?? '—'], ['Contrat', i.contractRef]] },
      {
        kind: 'table',
        head: ['Ligne', 'HT', 'TVA', 'TTC'],
        widths: [52, 16, 16, 16],
        rows: [
          [`1. Loyer location financière — pour compte de ${i.financer}`, fcfa(i.line1Ht), fcfa(i.line1Tva), fcfa(i.line1Ttc)],
          ['2. Services (SOLINK support & MDM, Orange VDI, assurance)', fcfa(i.line2Ht), fcfa(i.line2Tva), fcfa(i.line2Ttc)],
        ],
        total: ['Total à payer', fcfa(i.line1Ht + i.line2Ht), fcfa(i.line1Tva + i.line2Tva), fcfa(i.totalTtc)],
      },
      { kind: 'note', text: 'Paiement sur le compte de cantonnement au nom du bailleur. Traitement fiscal de la facture « pour compte » : valeur de démo, à valider par un fiscaliste.' },
    ],
  };
}

export function purchaseOrderSpec(i: { ref: string; orderRef: string; supplier: string; issuedAt: Date; lines: { sku: string; label: string; quantity: number; unit: number }[]; owner: string }): DocSpec {
  return {
    title: `Bon de commande ${i.ref}`,
    ref: i.ref,
    subtitle: `Commande ${i.orderRef} — émis le ${date(i.issuedAt)} — fournisseur ${i.supplier}`,
    blocks: [
      { kind: 'table', head: ['SKU', 'Désignation', 'Qté', 'PU HT', 'Total HT'], widths: [16, 40, 8, 18, 18], rows: i.lines.map((l) => [l.sku, l.label, String(l.quantity), fcfa(l.unit), fcfa(l.unit * l.quantity)]), total: ['', 'Total', '', '', fcfa(i.lines.reduce((a, l) => a + l.unit * l.quantity, 0))] },
      { kind: 'note', text: `Facturation : propriété transférée à ${i.owner} (bailleur). Étiquetage QR « Propriété de ${i.owner} — géré par SOLINK ».` },
    ],
  };
}

export function disbursementInvoiceSpec(i: { ref: string; contractRef: string; financer: string; amount: number; at: Date; lines: { label: string; quantity: number; unitBase: number }[] }): DocSpec {
  return {
    title: `Facture SOLINK — demande de décaissement ${i.ref}`,
    ref: i.ref,
    subtitle: `À l’attention de ${i.financer} — contrat ${i.contractRef} — ${date(i.at)}`,
    blocks: [
      { kind: 'table', head: ['Désignation (matériel + logistique + setup + marge)', 'Qté', 'Base unitaire', 'Total'], widths: [52, 8, 20, 20], rows: i.lines.map((l) => [l.label, String(l.quantity), fcfa(l.unitBase), fcfa(l.unitBase * l.quantity)]), total: ['Montant à décaisser', '', '', fcfa(i.amount)] },
      { kind: 'note', text: 'La plateforme n’émet aucun ordre de paiement : le bailleur valide et effectue le virement depuis ses propres systèmes.' },
    ],
  };
}

export function synthesisSpec(i: { orderRef: string; org: string; lines: string[]; kv: [string, string][]; factors: { label: string; points: number; max: number; detail: string }[]; docs: { label: string; status: string }[]; disclaimer: string }): DocSpec {
  return {
    title: `Fiche de synthèse — ${i.org}`,
    ref: i.orderRef,
    blocks: [
      { kind: 'kv', rows: i.kv },
      { kind: 'h', text: 'Synthèse (assistant)' },
      ...i.lines.map((t) => ({ kind: 'p', text: t }) as Block),
      { kind: 'note', text: i.disclaimer },
      { kind: 'h', text: 'Score (grille du financeur)' },
      { kind: 'table', head: ['Critère', 'Points', 'Max', 'Détail'], rows: i.factors.map((f) => [f.label, String(f.points), String(f.max), f.detail]), widths: [45, 12, 12, 31] },
      { kind: 'h', text: 'Pièces' },
      { kind: 'table', head: ['Pièce', 'Statut'], rows: i.docs.map((d) => [d.label, d.status]), widths: [70, 30] },
    ],
  };
}

export function consentsSpec(orderRef: string, rows: { type: string; text: string; version: string; at: Date; ip: string | null; ua: string | null; user: string }[]): DocSpec {
  return {
    title: 'Preuves de consentement',
    ref: orderRef,
    blocks: [{ kind: 'table', head: ['Type', 'Texte (version)', 'Horodatage', 'IP', 'Utilisateur'], widths: [14, 42, 16, 12, 16], rows: rows.map((r) => [r.type, `${r.text} (${r.version})`, dateTime(r.at), r.ip ?? '—', r.user]) }],
  };
}
