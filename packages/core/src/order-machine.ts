import type { OrderStatus, Role, Tx } from '@solink/db';
import { type Actor, isSystem } from './authz';
import { BusinessError } from './errors';
import { sha256 } from './hash';
import { now } from './clock';
import { audit } from './audit';

/**
 * Machine à états unifiée de la commande (v4 §10).
 * SEUL point d'écriture du champ Order.status (vérifié par test : tests/no-direct-status.test.ts).
 */
type Guard = (db: Tx, orderId: string) => Promise<string | null>;

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  roles: (Role | 'SYSTEME')[];
  guard?: Guard;
  label: string;
}

const CLIENT_ORDER: Role[] = ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE'];
const CLIENT_SIGN: Role[] = ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'];
const SOLINK_DOSSIER: Role[] = ['SOLINK_CHARGE_DOSSIER', 'SOLINK_ADMIN'];
const SOLINK_OPS: Role[] = ['SOLINK_ACHATS', 'SOLINK_LOGISTIQUE', 'SOLINK_MDM', 'SOLINK_ADMIN'];
const BANK_DECIDE: Role[] = ['BANQUE_ANALYSTE', 'BANQUE_VALIDEUR'];
const S = 'SYSTEME' as const;

/** Garde : toutes les pièces obligatoires En vérification ou Validées (E20). */
const docsSubmittable: Guard = async (db, orderId) => {
  const cf = await db.creditFile.findUnique({ where: { orderId }, include: { documents: true } });
  if (!cf) return 'DOSSIER_ABSENT';
  const missing = cf.documents.filter(
    (d) => d.required && d.origin === 'CHECKLIST' && !['EN_VERIFICATION', 'VALIDEE', 'NON_APPLICABLE'].includes(d.status),
  );
  return missing.length ? 'PIECES_OBLIGATOIRES_MANQUANTES' : null;
};

const docsAllValidated: Guard = async (db, orderId) => {
  const cf = await db.creditFile.findUnique({ where: { orderId }, include: { documents: true } });
  if (!cf) return 'DOSSIER_ABSENT';
  const notOk = cf.documents.filter(
    (d) => d.required && d.origin === 'CHECKLIST' && !['VALIDEE', 'NON_APPLICABLE'].includes(d.status),
  );
  return notOk.length ? 'PIECES_NON_VALIDEES' : null;
};

const bankRequestsAnswered: Guard = async (db, orderId) => {
  const cf = await db.creditFile.findUnique({ where: { orderId }, include: { documents: true } });
  const open = cf?.documents.filter((d) => d.origin === 'DEMANDE_BANQUE' && d.status === 'A_FOURNIR') ?? [];
  return open.length ? 'PIECES_COMPLEMENTAIRES_MANQUANTES' : null;
};

/** v4 §9.4 — conditions suspensives toutes levées. */
export const suspensiveConditionsLifted: Guard = async (db, orderId) => {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      contract: { include: { mandate: true, ceremonies: true } },
      creditFile: { include: { decisions: { include: { conditions: true }, orderBy: { at: 'desc' }, take: 1 } } },
      lines: true,
    },
  });
  const c = order?.contract;
  if (!c) return 'CONTRAT_ABSENT';
  if (!c.signedAt) return 'CONTRAT_NON_SIGNE';
  if (!c.depositReceivedAt) return 'DEPOT_NON_RECU';
  if (c.mandate?.status !== 'ACTIF') return 'MANDAT_NON_ACTIF';
  if (order.lines.some((l) => l.insurance) && !c.insuranceIssuedAt) return 'ASSURANCE_NON_EMISE';
  const conds = order.creditFile?.decisions[0]?.conditions ?? [];
  if (conds.some((x) => x.status !== 'LEVEE')) return 'CONDITIONS_DECISION_NON_LEVEES';
  return null;
};

export const TRANSITIONS: TransitionRule[] = [
  { from: 'PANIER', to: 'DEVIS_EMIS', roles: [...CLIENT_ORDER, 'SOLINK_COMMERCIAL'], label: 'Émission du devis' },
  { from: 'DEVIS_EMIS', to: 'PANIER', roles: [...CLIENT_ORDER, 'SOLINK_COMMERCIAL'], label: 'Modification du devis' },
  { from: 'DEVIS_EMIS', to: 'APPROBATION_INTERNE', roles: CLIENT_SIGN, label: 'Soumis à approbation interne' },
  { from: 'APPROBATION_INTERNE', to: 'DEVIS_ACCEPTE', roles: ['CLIENT_APPROBATEUR', 'CLIENT_ADMIN'], label: 'Approuvé en interne et accepté' },
  { from: 'APPROBATION_INTERNE', to: 'DEVIS_EMIS', roles: ['CLIENT_APPROBATEUR', 'CLIENT_ADMIN'], label: 'Refus de l’approbateur' },
  { from: 'DEVIS_EMIS', to: 'DEVIS_ACCEPTE', roles: CLIENT_SIGN, label: 'Devis accepté' },
  { from: 'DEVIS_EMIS', to: 'EXPIRE', roles: [S], label: 'Devis expiré' },
  { from: 'DEVIS_ACCEPTE', to: 'DOSSIER_EN_COURS', roles: CLIENT_SIGN, label: 'Demande de financement' },
  { from: 'DOSSIER_EN_COURS', to: 'PRE_CONTROLE', roles: CLIENT_SIGN, guard: docsSubmittable, label: 'Dossier soumis' },
  { from: 'PRE_CONTROLE', to: 'DOSSIER_A_REPRENDRE', roles: SOLINK_DOSSIER, label: 'Pièces à reprendre' },
  { from: 'DOSSIER_A_REPRENDRE', to: 'PRE_CONTROLE', roles: CLIENT_SIGN, guard: docsSubmittable, label: 'Dossier re-soumis' },
  { from: 'PRE_CONTROLE', to: 'TRANSMIS_FINANCEUR', roles: SOLINK_DOSSIER, guard: docsAllValidated, label: 'DFS transmis au financeur' },
  { from: 'TRANSMIS_FINANCEUR', to: 'ACCORDE', roles: [S], label: 'Accord automatique (règle financeur)' },
  { from: 'TRANSMIS_FINANCEUR', to: 'EN_ANALYSE', roles: [...BANK_DECIDE, S], label: 'Accusé de réception financeur' },
  { from: 'EN_ANALYSE', to: 'PIECES_COMPLEMENTAIRES', roles: BANK_DECIDE, label: 'Demande de pièces complémentaires' },
  { from: 'PIECES_COMPLEMENTAIRES', to: 'EN_ANALYSE', roles: [...CLIENT_ORDER, S], guard: bankRequestsAnswered, label: 'Pièces complémentaires fournies (DFS vN)' },
  { from: 'EN_ANALYSE', to: 'ACCORDE', roles: BANK_DECIDE, label: 'Décision : accordé' },
  { from: 'EN_ANALYSE', to: 'ACCORDE_SOUS_CONDITIONS', roles: BANK_DECIDE, label: 'Décision : accordé sous conditions' },
  { from: 'EN_ANALYSE', to: 'REFUSE', roles: BANK_DECIDE, label: 'Décision : refus' },
  { from: 'EN_ANALYSE', to: 'ANNULE', roles: BANK_DECIDE, label: 'Sans suite' },
  { from: 'ACCORDE', to: 'OFFRE_EMISE', roles: [...SOLINK_DOSSIER, S], label: 'Offre et pack contractuel émis' },
  { from: 'ACCORDE_SOUS_CONDITIONS', to: 'OFFRE_EMISE', roles: CLIENT_SIGN, label: 'Conditions acceptées, offre émise' },
  { from: 'ACCORDE', to: 'EXPIRE', roles: [S], label: 'Accord expiré' },
  { from: 'ACCORDE_SOUS_CONDITIONS', to: 'EXPIRE', roles: [S], label: 'Accord expiré' },
  { from: 'OFFRE_EMISE', to: 'SIGNATURE_CLIENT', roles: [...CLIENT_SIGN, S], label: 'Cérémonie de signature ouverte' },
  { from: 'SIGNATURE_CLIENT', to: 'CONTRESIGNATURE', roles: [S], label: 'Signatures client terminées' },
  { from: 'SIGNATURE_CLIENT', to: 'OFFRE_EMISE', roles: [S], label: 'Enveloppe de signature expirée — nouvelle émission' },
  { from: 'CONTRESIGNATURE', to: 'CONDITIONS_SUSPENSIVES', roles: [S, 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE'], label: 'Contre-signature banque' },
  { from: 'CONDITIONS_SUSPENSIVES', to: 'PRET_POUR_ACHAT', roles: [S], guard: suspensiveConditionsLifted, label: 'Conditions suspensives levées' },
  { from: 'PRET_POUR_ACHAT', to: 'ACHETE', roles: ['SOLINK_ACHATS', 'SOLINK_ADMIN'], label: 'Bon de commande distributeur émis' },
  { from: 'ACHETE', to: 'EN_PREPARATION', roles: SOLINK_OPS, label: 'Réception et préparation' },
  { from: 'EN_PREPARATION', to: 'EXPEDIE', roles: SOLINK_OPS, label: 'Expédition' },
  { from: 'EXPEDIE', to: 'PV_A_SIGNER', roles: [...SOLINK_OPS, S], label: 'Livré — PV à signer' },
  { from: 'PV_A_SIGNER', to: 'DECAISSEMENT_DEMANDE', roles: [S], label: 'Dernier PV signé — demande de décaissement' },
  { from: 'DECAISSEMENT_DEMANDE', to: 'ACTIF', roles: ['BANQUE_TRESORERIE', S], label: 'Paiement SOLINK confirmé — contrat actif' },
  { from: 'ACTIF', to: 'FIN_DE_CONTRAT', roles: [S, 'SOLINK_ADMIN'], label: 'Fin de contrat' },
  { from: 'FIN_DE_CONTRAT', to: 'CLOS', roles: [S, 'SOLINK_ADMIN', 'SOLINK_LOGISTIQUE'], label: 'Restitution terminée' },
];

const CANCELLABLE: OrderStatus[] = [
  'PANIER',
  'DEVIS_EMIS',
  'APPROBATION_INTERNE',
  'DEVIS_ACCEPTE',
  'DOSSIER_EN_COURS',
  'DOSSIER_A_REPRENDRE',
  'PRE_CONTROLE',
  'OFFRE_EMISE',
  'ACCORDE',
  'ACCORDE_SOUS_CONDITIONS',
];
for (const from of CANCELLABLE)
  TRANSITIONS.push({ from, to: 'ANNULE', roles: [...CLIENT_SIGN, 'SOLINK_ADMIN', S], label: 'Annulation' });

export function findRule(from: OrderStatus, to: OrderStatus): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function allowedNext(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

export function transitionHash(prevHash: string | null, orderId: string, from: string | null, to: string, actorId: string, reason: string, at: Date) {
  return sha256([prevHash ?? 'GENESIS', orderId, from ?? '', to, actorId, reason, at.toISOString()].join('|'));
}

/**
 * Fonction unique de transition. Vérifie la règle, le rôle et la garde, écrit le statut,
 * le journal chaîné StatusTransition et un événement d'audit.
 */
export async function transition(
  db: Tx,
  orderId: string,
  to: OrderStatus,
  actor: Actor,
  reason?: string,
): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new BusinessError('COMMANDE_INTROUVABLE', 'Commande introuvable', 404);
  const rule = findRule(order.status, to);
  if (!rule)
    throw new BusinessError('TRANSITION_INTERDITE', `Transition ${order.status} → ${to} non autorisée`);
  const roleOk = isSystem(actor)
    ? rule.roles.includes('SYSTEME')
    : actor.roles.some((r) => rule.roles.includes(r)) ||
      (actor.roles.includes('SOLINK_ADMIN') && rule.roles.some((r) => r !== 'SYSTEME' && r.startsWith('SOLINK_')));
  if (!roleOk) throw new BusinessError('ACCES_REFUSE', `Rôle non autorisé pour « ${rule.label} »`, 403);
  if (rule.guard) {
    const err = await rule.guard(db, orderId);
    if (err) throw new BusinessError(err, `Condition non remplie : ${err}`);
  }
  const at = await now(db);
  const last = await db.statusTransition.findFirst({ where: { orderId }, orderBy: { at: 'desc' } });
  const why = reason ?? rule.label;
  const hash = transitionHash(last?.hash ?? null, orderId, order.status, to, actor.userId, why, at);
  // Écriture optimiste : on n'écrit que si le statut n'a pas changé entre-temps.
  const res = await db.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to, statusChangedAt: at } });
  if (res.count !== 1) throw new BusinessError('CONFLIT_STATUT', 'Le statut a changé entre-temps, réessayez');
  await db.statusTransition.create({
    data: { orderId, from: order.status, to, actorId: actor.userId, reason: why, at, prevHash: last?.hash ?? null, hash },
  });
  await audit(db, 'Order', orderId, `STATUT:${order.status}->${to}`, actor.userId, { reason: why });
}

/** Création (statut initial PANIER) et seed : enregistre une transition chaînée sans modifier Order.status. */
export async function recordInitialTransition(db: Tx, orderId: string, to: OrderStatus, at: Date, actorId = 'SEED', reason = 'Données de démo') {
  const last = await db.statusTransition.findFirst({ where: { orderId }, orderBy: { at: 'desc' } });
  const hash = transitionHash(last?.hash ?? null, orderId, last?.to ?? null, to, actorId, reason, at);
  await db.statusTransition.create({
    data: { orderId, from: last?.to ?? null, to, actorId, reason, at, prevHash: last?.hash ?? null, hash },
  });
}
