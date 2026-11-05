import type { Prisma, Role, Segment, SignatureMode, VdiTier } from '@solink/db';
import { assertCan } from '../authz';
import { BusinessError } from '../errors';
import { audit } from '../audit';
import { notifyRoles, type Ctx } from './context';
import { messaging } from '@solink/adapters';

const CLIENT_ROLES: Role[] = ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'CLIENT_APPROBATEUR', 'CLIENT_RECEPTION', 'CLIENT_EMPLOYE'];

/** E03 — identification de l'entreprise (NINEA) ; doublon → demande d'accès à l'admin existant. */
export async function updateCompany(ctx: Ctx, data: { name: string; ninea: string; rccm?: string; segment: Segment; sector?: string; legalForm?: string; address?: string; createdOn?: string; approvalThreshold?: number; jointSignature?: boolean }) {
  assertCan(ctx.actor, 'team.manage');
  const dup = await ctx.db.organisation.findFirst({ where: { ninea: data.ninea, id: { not: ctx.actor.orgId } } });
  if (dup) {
    await notifyRoles(ctx, dup.id, ['CLIENT_ADMIN'], 'INVITATION', { inviter: ctx.actor.name, org: dup.name, link: '/client/equipe' }, '/client/equipe', ['EMAIL']);
    throw new BusinessError('NINEA_EXISTANT', 'Ce NINEA existe déjà : une demande d’accès a été envoyée à son administrateur');
  }
  await ctx.db.organisation.update({
    where: { id: ctx.actor.orgId },
    data: { name: data.name, ninea: data.ninea, rccm: data.rccm, segment: data.segment, sector: data.sector, legalForm: data.legalForm, address: data.address, createdOn: data.createdOn ? new Date(data.createdOn) : undefined, approvalThreshold: data.approvalThreshold, jointSignature: data.jointSignature },
  });
  await audit(ctx.db, 'Organisation', ctx.actor.orgId, 'ENTREPRISE_MAJ', ctx.actor.userId, {});
}

/** E04 — invitation de membres avec rôle(s) et désignation des signataires. */
export async function inviteMember(ctx: Ctx, data: { email: string; firstName: string; lastName: string; title?: string; mobile?: string; roles: Role[]; isSignatory: boolean; signatureMode?: SignatureMode }) {
  assertCan(ctx.actor, 'team.manage');
  if (!data.roles.length || data.roles.some((r) => !CLIENT_ROLES.includes(r))) throw new BusinessError('ROLES_INVALIDES', 'Rôles invalides');
  const email = data.email.trim().toLowerCase();
  let user = await ctx.db.user.findUnique({ where: { email } });
  if (!user) user = await ctx.db.user.create({ data: { email, firstName: data.firstName, lastName: data.lastName, title: data.title, mobile: data.mobile } });
  const exists = await ctx.db.membership.findUnique({ where: { userId_organisationId: { userId: user.id, organisationId: ctx.actor.orgId } } });
  if (exists) throw new BusinessError('DEJA_MEMBRE', 'Déjà membre de l’organisation');
  const roles = data.isSignatory && !data.roles.includes('CLIENT_SIGNATAIRE') ? [...data.roles, 'CLIENT_SIGNATAIRE' as Role] : data.roles;
  await ctx.db.membership.create({ data: { userId: user.id, organisationId: ctx.actor.orgId, roles, isSignatory: data.isSignatory, signatureMode: data.signatureMode ?? 'SEUL' } });
  const org = await ctx.db.organisation.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
  await messaging.send(ctx.db, { to: email, channels: ['EMAIL', 'WHATSAPP'], template: 'INVITATION', vars: { inviter: ctx.actor.name, org: org.name, link: '/connexion' }, link: '/connexion', at: ctx.at });
  await audit(ctx.db, 'Membership', user.id, 'MEMBRE_INVITE', ctx.actor.userId, { roles });
}

export async function updateMember(ctx: Ctx, membershipId: string, data: { roles: Role[]; isSignatory: boolean; signatureMode: SignatureMode }) {
  assertCan(ctx.actor, 'team.manage');
  const m = await ctx.db.membership.findUniqueOrThrow({ where: { id: membershipId } });
  if (m.organisationId !== ctx.actor.orgId) throw new BusinessError('ACCES_REFUSE', 'Hors périmètre', 403);
  await ctx.db.membership.update({ where: { id: membershipId }, data });
}

export async function upsertSite(ctx: Ctx, data: { id?: string; name: string; address: string; landmark?: string; lat?: number; lng?: number; contactName?: string; contactPhone?: string; contactEmail?: string; hours?: string }) {
  assertCan(ctx.actor, 'team.manage');
  if (!data.name.trim() || !data.address.trim()) throw new BusinessError('SITE_INCOMPLET', 'Nom et adresse requis');
  if (data.id) {
    const s = await ctx.db.site.findUniqueOrThrow({ where: { id: data.id } });
    if (s.organisationId !== ctx.actor.orgId) throw new BusinessError('ACCES_REFUSE', 'Hors périmètre', 403);
    const { id, ...rest } = data;
    return ctx.db.site.update({ where: { id }, data: rest });
  }
  return ctx.db.site.create({ data: { ...data, organisationId: ctx.actor.orgId } });
}

/** Import CSV de sites (> 10 sites) : nom;adresse;repère;contact;téléphone;email;horaires */
export async function importSitesCsv(ctx: Ctx, csv: string) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  let n = 0;
  for (const l of lines.slice(1)) {
    const [name, address, landmark, contactName, contactPhone, contactEmail, hours] = l.split(';');
    if (!name || !address) continue;
    await upsertSite(ctx, { name, address, landmark, contactName, contactPhone, contactEmail, hours });
    n++;
  }
  return n;
}

/** E09 — packs par profil (catalogue interne client). */
export async function createPack(ctx: Ctx, data: { name: string; description?: string; items: { productId: string; quantity: number }[]; vdiTier: VdiTier }) {
  assertCan(ctx.actor, 'team.manage');
  if (!data.items.length) throw new BusinessError('PACK_VIDE', 'Ajoutez au moins un produit');
  return ctx.db.pack.create({ data: { organisationId: ctx.actor.orgId, name: data.name, description: data.description, items: data.items as Prisma.InputJsonValue, vdiTier: data.vdiTier } });
}

export async function deletePack(ctx: Ctx, packId: string) {
  assertCan(ctx.actor, 'team.manage');
  await ctx.db.pack.deleteMany({ where: { id: packId, organisationId: ctx.actor.orgId } });
}
