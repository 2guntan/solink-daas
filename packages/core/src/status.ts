import type { OrderStatus } from '@solink/db';

/** v4 §10.1 — libellé client, propriétaire, SLA cible (heures, démo). */
export const STATUS_INFO: Record<OrderStatus, { label: string; owner: string; slaHours?: number; step: number }> = {
  PANIER: { label: 'Panier en cours', owner: 'Client', step: 1 },
  DEVIS_EMIS: { label: 'Devis à valider', owner: 'Client', slaHours: 15 * 24, step: 2 },
  APPROBATION_INTERNE: { label: 'En attente de votre approbateur', owner: 'Client', slaHours: 48, step: 2 },
  DEVIS_ACCEPTE: { label: 'Devis accepté', owner: 'Client', step: 3 },
  DOSSIER_EN_COURS: { label: 'Dossier à compléter', owner: 'Client', slaHours: 72, step: 4 },
  PRE_CONTROLE: { label: 'Vérification de votre dossier', owner: 'SOLINK', slaHours: 4, step: 4 },
  DOSSIER_A_REPRENDRE: { label: 'Des pièces sont à reprendre', owner: 'Client', slaHours: 48, step: 4 },
  TRANSMIS_FINANCEUR: { label: 'Transmis à la banque', owner: 'Financeur', slaHours: 2, step: 5 },
  EN_ANALYSE: { label: 'Étude en cours par la banque', owner: 'Financeur', slaHours: 48, step: 5 },
  PIECES_COMPLEMENTAIRES: { label: 'La banque demande un complément', owner: 'Client', slaHours: 72, step: 5 },
  ACCORDE: { label: 'Financement accordé', owner: 'SOLINK', step: 5 },
  ACCORDE_SOUS_CONDITIONS: { label: 'Accordé sous conditions', owner: 'Client', slaHours: 120, step: 5 },
  REFUSE: { label: 'Financement non accordé', owner: '—', step: 5 },
  OFFRE_EMISE: { label: 'Contrat prêt à signer', owner: 'Client', slaHours: 168, step: 6 },
  SIGNATURE_CLIENT: { label: 'Signature en cours', owner: 'Client', slaHours: 48, step: 6 },
  CONTRESIGNATURE: { label: 'En attente de la signature de la banque', owner: 'Financeur', slaHours: 24, step: 6 },
  CONDITIONS_SUSPENSIVES: { label: 'Finalisation (dépôt, mandat, assurance)', owner: 'Client / Financeur', slaHours: 120, step: 6 },
  PRET_POUR_ACHAT: { label: 'Commande lancée', owner: 'SOLINK', slaHours: 24, step: 7 },
  ACHETE: { label: 'Équipements commandés', owner: 'SOLINK', step: 7 },
  EN_PREPARATION: { label: 'Configuration en cours', owner: 'SOLINK', slaHours: 72, step: 7 },
  EXPEDIE: { label: 'En livraison', owner: 'SOLINK', step: 7 },
  PV_A_SIGNER: { label: 'Réception à confirmer', owner: 'Client', slaHours: 24, step: 7 },
  DECAISSEMENT_DEMANDE: { label: 'Mise en service en cours', owner: 'Financeur', slaHours: 48, step: 8 },
  ACTIF: { label: 'Contrat actif', owner: '—', step: 9 },
  FIN_DE_CONTRAT: { label: 'Fin de contrat — restitution', owner: 'Client / SOLINK', slaHours: 720, step: 9 },
  CLOS: { label: 'Terminé', owner: '—', step: 9 },
  ANNULE: { label: 'Annulé', owner: '—', step: 0 },
  EXPIRE: { label: 'Expiré', owner: '—', step: 0 },
  ECHEC: { label: 'Échec', owner: '—', step: 0 },
};

/** Frise client en 9 étapes (v4 §4.1). */
export const TIMELINE_STEPS = [
  'Panier',
  'Devis',
  'Devis accepté',
  'Dossier',
  'Décision banque',
  'Signature',
  'Livraison',
  'Mise en service',
  'Contrat actif',
];

export const DOC_STATUS_LABEL: Record<string, string> = {
  A_FOURNIR: 'À fournir',
  EN_VERIFICATION: 'En vérification',
  VALIDEE: 'Validée',
  A_REPRENDRE: 'À reprendre',
  EXPIREE: 'Expirée',
  NON_APPLICABLE: 'Non applicable',
};

export const SEGMENT_LABEL: Record<string, string> = {
  GRANDE_ENTREPRISE: 'Grande entreprise',
  PME: 'PME',
  INSTITUTION_FINANCIERE: 'Institution financière',
  PUBLIC: 'Administration / établissement public',
  ONG: 'ONG / organisation internationale',
};

export const OFFER_LABEL: Record<string, string> = {
  BUREAU_CLOUD: 'Bureau cloud',
  POSTE_MOBILE: 'Poste mobile',
  HYBRIDE: 'Hybride',
};

export const RANGE_LABEL: Record<string, string> = { ESSENTIAL: 'Essential', PRO: 'Pro', PREMIUM: 'Premium' };

export const CATEGORY_LABEL: Record<string, string> = {
  THIN_CLIENT: 'Thin client',
  LAPTOP: 'Ordinateur portable',
  MAC: 'MacBook',
  ECRAN: 'Écran',
  DOCK: 'Station d’accueil',
  CASQUE: 'Casque',
  SACOCHE: 'Sacoche',
};

export const CONDITION_LABEL: Record<string, string> = {
  DEPOT_MAJORE: 'Dépôt de garantie majoré',
  CAUTION_DIRIGEANT: 'Caution du dirigeant',
  DUREE_MAX: 'Durée maximale',
  MONTANT_MAX: 'Montant maximal',
  PIECE_A_FOURNIR_AVANT_SIGNATURE: 'Pièce à fournir avant signature',
  GARANTIE_TIERS: 'Garantie d’un tiers (FONGIP…)',
  AUTRE: 'Autre condition',
};

export const DEVICE_STATUS_LABEL: Record<string, string> = {
  COMMANDE: 'Commandé',
  EN_TRANSIT: 'En transit',
  EN_STOCK: 'En stock',
  ENROLE: 'Enrôlé MDM',
  LIVRE: 'Livré',
  ACTIF: 'Actif',
  VERROUILLE: 'Verrouillé',
  EN_SAV: 'En SAV',
  RETOURNE: 'Retourné',
  GRADE: 'Gradé',
  RECONDITIONNE: 'Reconditionné',
  REVENDU: 'Revendu',
  REDEPLOYE: 'Redéployé',
  RECYCLE: 'Recyclé',
};

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  EMISE: 'Émise',
  PAYEE: 'Payée',
  PARTIELLE: 'Partiellement payée',
  IMPAYEE: 'Impayée',
  AVOIR: 'Avoir',
};
