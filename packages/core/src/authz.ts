import type { OrgType, Role } from '@solink/db';
import { BusinessError } from './errors';

/** RBAC (CLAUDE.md §3) + cloisonnement par organisation / financeur / apporteur. */
export interface Actor {
  userId: string;
  name: string;
  email: string;
  orgId: string;
  orgType: OrgType;
  roles: Role[];
}

export const SYSTEM: Actor = {
  userId: 'SYSTEME',
  name: 'Plateforme (règle automatique)',
  email: 'systeme@solink.sn',
  orgId: 'SYSTEME',
  orgType: 'OPERATEUR',
  roles: [],
};

export const isSystem = (a: Actor) => a.userId === 'SYSTEME';

export type Portal = 'client' | 'solink' | 'banque' | 'orange' | 'refinanceur';

export function portalFor(orgType: OrgType): Portal {
  switch (orgType) {
    case 'CLIENT':
      return 'client';
    case 'OPERATEUR':
      return 'solink';
    case 'FINANCEUR':
      return 'banque';
    case 'APPORTEUR':
      return 'orange';
    case 'REFINANCEUR':
      return 'refinanceur';
  }
}

export const PORTAL_ORG: Record<Portal, OrgType> = {
  client: 'CLIENT',
  solink: 'OPERATEUR',
  banque: 'FINANCEUR',
  orange: 'APPORTEUR',
  refinanceur: 'REFINANCEUR',
};

export const ROLE_LABEL: Record<Role, string> = {
  CLIENT_ADMIN: 'Administrateur',
  CLIENT_SIGNATAIRE: 'Signataire habilité',
  CLIENT_FINANCE: 'Responsable financier',
  CLIENT_APPROBATEUR: 'Approbateur interne',
  CLIENT_RECEPTION: 'Réceptionnaire site',
  CLIENT_EMPLOYE: 'Employé',
  SOLINK_COMMERCIAL: 'Commercial SOLINK',
  SOLINK_CHARGE_DOSSIER: 'Chargé de dossier',
  SOLINK_ACHATS: 'Achats',
  SOLINK_LOGISTIQUE: 'Logistique',
  SOLINK_MDM: 'Technicien MDM',
  SOLINK_SUPPORT: 'Support',
  SOLINK_FINANCE: 'Finance SOLINK',
  SOLINK_ADMIN: 'Admin plateforme',
  BANQUE_ANALYSTE: 'Analyste crédit',
  BANQUE_VALIDEUR: 'Valideur (délégation)',
  BANQUE_TRESORERIE: 'Trésorerie',
  BANQUE_RISK: 'Risk officer',
  ORANGE_COMMERCIAL: 'Commercial Orange',
  ORANGE_FACTURATION: 'Facturation Orange',
  REFINANCEUR_LECTURE: 'Refinanceur (lecture)',
  AUDITEUR: 'Auditeur',
};

/** Permissions applicatives → rôles autorisés. SOLINK_ADMIN a toutes les permissions SOLINK. */
export const PERMISSIONS = {
  'cart.edit': ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'SOLINK_COMMERCIAL'],
  'quote.accept': ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'],
  'quote.approve': ['CLIENT_APPROBATEUR', 'CLIENT_ADMIN'],
  'financing.request': ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'],
  'dossier.edit': ['CLIENT_ADMIN', 'CLIENT_FINANCE', 'CLIENT_SIGNATAIRE'],
  'dossier.submit': ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'],
  'team.manage': ['CLIENT_ADMIN'],
  'contract.sign': ['CLIENT_SIGNATAIRE'],
  'pv.sign': ['CLIENT_RECEPTION', 'CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'],
  'conditions.client': ['CLIENT_ADMIN', 'CLIENT_FINANCE', 'CLIENT_SIGNATAIRE'],
  'ticket.create': ['CLIENT_ADMIN', 'CLIENT_FINANCE', 'CLIENT_SIGNATAIRE', 'CLIENT_EMPLOYE', 'CLIENT_RECEPTION'],
  'precontrole.review': ['SOLINK_CHARGE_DOSSIER', 'SOLINK_ADMIN'],
  'offer.issue': ['SOLINK_CHARGE_DOSSIER', 'SOLINK_ADMIN'],
  'purchase.create': ['SOLINK_ACHATS', 'SOLINK_ADMIN'],
  'logistics.manage': ['SOLINK_LOGISTIQUE', 'SOLINK_ADMIN', 'SOLINK_MDM'],
  'mdm.execute': ['SOLINK_MDM', 'SOLINK_ADMIN'],
  'support.manage': ['SOLINK_SUPPORT', 'SOLINK_ADMIN'],
  'billing.manage': ['SOLINK_FINANCE', 'SOLINK_ADMIN', 'ORANGE_FACTURATION'],
  'params.solink': ['SOLINK_ADMIN'],
  'returns.manage': ['SOLINK_LOGISTIQUE', 'SOLINK_ADMIN', 'SOLINK_MDM'],
  'bank.analyse': ['BANQUE_ANALYSTE', 'BANQUE_VALIDEUR'],
  'bank.decide': ['BANQUE_ANALYSTE', 'BANQUE_VALIDEUR'],
  'bank.countersign': ['BANQUE_VALIDEUR', 'BANQUE_ANALYSTE'],
  'bank.conditions': ['BANQUE_ANALYSTE', 'BANQUE_VALIDEUR', 'BANQUE_TRESORERIE'],
  'bank.treasury': ['BANQUE_TRESORERIE'],
  'bank.params': ['BANQUE_RISK', 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE'],
  'bank.lock': ['BANQUE_RISK', 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE', 'BANQUE_TRESORERIE'],
  'orange.leads': ['ORANGE_COMMERCIAL'],
  'orange.billing': ['ORANGE_FACTURATION'],
  'refi.read': ['REFINANCEUR_LECTURE'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(actor: Actor, perm: Permission): boolean {
  if (isSystem(actor)) return true;
  const allowed = PERMISSIONS[perm] as readonly Role[];
  if (actor.roles.some((r) => allowed.includes(r))) return true;
  if (actor.roles.includes('SOLINK_ADMIN') && allowed.some((r) => r.startsWith('SOLINK_'))) return true;
  return false;
}

export function assertCan(actor: Actor, perm: Permission): void {
  if (!can(actor, perm)) throw new BusinessError('ACCES_REFUSE', 'Action non autorisée pour votre rôle', 403);
}

/** Filtre Prisma systématique sur les commandes selon le type d'organisation de l'acteur. */
export function orderScope(actor: Actor): Record<string, unknown> {
  switch (actor.orgType) {
    case 'CLIENT':
      return { organisationId: actor.orgId };
    case 'FINANCEUR':
      return { financerId: actor.orgId };
    case 'APPORTEUR':
      return { apporteurId: actor.orgId };
    case 'OPERATEUR':
      return {};
    case 'REFINANCEUR':
      return { contract: { refiEligible: true } };
  }
}

export function assertOrderAccess(
  actor: Actor,
  order: { organisationId: string; financerId: string; apporteurId: string | null },
): void {
  if (isSystem(actor) || actor.orgType === 'OPERATEUR') return;
  const ok =
    (actor.orgType === 'CLIENT' && order.organisationId === actor.orgId) ||
    (actor.orgType === 'FINANCEUR' && order.financerId === actor.orgId) ||
    (actor.orgType === 'APPORTEUR' && order.apporteurId === actor.orgId) ||
    actor.orgType === 'REFINANCEUR';
  if (!ok) throw new BusinessError('ACCES_REFUSE', 'Commande hors de votre périmètre', 403);
}
