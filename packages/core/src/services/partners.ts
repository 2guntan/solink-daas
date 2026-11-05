import type { Range, Segment } from '@solink/db';
import { Prisma } from '@solink/db';
import { assertCan } from '../authz';
import { BusinessError } from '../errors';
import { audit } from '../audit';
import { setParam, type ParamKey, PARAM_OWNERS } from '../params';
import { commissionTotal } from '../pricing';
import { messaging } from '@solink/adapters';
import type { Ctx } from './context';

/** O01 — lead Orange + invitation pré-remplie (attribution apporteur automatique). */
export async function createLead(ctx: Ctx, data: { companyName: string; ninea?: string; segment?: Segment; contactName: string; contactEmail: string; contactPhone?: string; need: string }) {
  assertCan(ctx.actor, 'orange.leads');
  const email = data.contactEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new BusinessError('EMAIL_INVALIDE', 'Email invalide');
  const lead = await ctx.db.lead.create({ data: { ...data, contactEmail: email, apporteurId: ctx.actor.orgId, createdById: ctx.actor.userId, createdAt: ctx.at } });
  return lead;
}

export async function inviteLead(ctx: Ctx, leadId: string) {
  assertCan(ctx.actor, 'orange.leads');
  const lead = await ctx.db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.apporteurId !== ctx.actor.orgId) throw new BusinessError('ACCES_REFUSE', 'Hors périmètre', 403);
  if (lead.organisationId) throw new BusinessError('DEJA_INVITE', 'Lead déjà invité');
  const existingOrg = lead.ninea ? await ctx.db.organisation.findUnique({ where: { ninea: lead.ninea } }) : null;
  if (existingOrg) throw new BusinessError('NINEA_EXISTANT', 'Cette entreprise est déjà cliente');
  const [first, ...rest] = lead.contactName.split(' ');
  const org = await ctx.db.organisation.create({ data: { type: 'CLIENT', name: lead.companyName, ninea: lead.ninea || null, segment: lead.segment, apporteurId: ctx.actor.orgId } });
  let user = await ctx.db.user.findUnique({ where: { email: lead.contactEmail } });
  if (!user) user = await ctx.db.user.create({ data: { email: lead.contactEmail, firstName: first || lead.contactName, lastName: rest.join(' ') || '—', mobile: lead.contactPhone } });
  await ctx.db.membership.create({ data: { userId: user.id, organisationId: org.id, roles: ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], isSignatory: true } });
  await ctx.db.lead.update({ where: { id: leadId }, data: { status: 'INVITE', organisationId: org.id } });
  await messaging.send(ctx.db, { to: lead.contactEmail, channels: ['EMAIL', 'WHATSAPP'], template: 'LEAD_INVITATION', vars: { commercial: ctx.actor.name, org: lead.companyName, link: '/connexion' }, link: '/connexion', at: ctx.at });
  await audit(ctx.db, 'Lead', leadId, 'LEAD_INVITE', ctx.actor.userId, { orgId: org.id });
  return org;
}

/** O03 — commissions apporteur (3 % du montant financé — jamais affichées au client). */
export async function commissions(ctx: Ctx, apporteurId: string) {
  const orders = await ctx.db.order.findMany({ where: { apporteurId, contract: { isNot: null } }, include: { organisation: true, contract: { include: { invoices: { include: { payments: { include: { allocations: true } } } } } } } });
  return orders.map((o) => {
    const total = commissionTotal(o.financedAmount, ctx.params.commission_apporteur_pct);
    const collected = (o.contract?.invoices ?? []).flatMap((i) => i.payments.flatMap((p) => p.allocations)).filter((a) => a.component === 'COMMISSION_APPORTEUR').reduce((s, a) => s + a.amount, 0);
    return { orderRef: o.ref, org: o.organisation.name, status: o.status, contractRef: o.contract?.ref, financed: o.financedAmount, total, collected };
  });
}

/** F09 / B12 — paramètres versionnés (propriétaire BANQUE ou SOLINK). */
export async function updateParameter(ctx: Ctx, key: ParamKey, value: unknown) {
  const owner = PARAM_OWNERS[key];
  if (owner === 'BANQUE') assertCan(ctx.actor, 'bank.params');
  else assertCan(ctx.actor, 'params.solink');
  await setParam(ctx.db, key, value, ctx.actor.userId, ctx.at);
  await audit(ctx.db, 'Parameter', key, 'PARAMETRE_MODIFIE', ctx.actor.userId, { value: value as never });
}

export async function updateEnvelope(ctx: Ctx, envelopeId: string, data: { total?: number; perClientCap?: number; endDate?: Date; whitelist?: string[]; active?: boolean }) {
  assertCan(ctx.actor, 'bank.params');
  const env = await ctx.db.envelope.findUniqueOrThrow({ where: { id: envelopeId } });
  if (env.financerId !== ctx.actor.orgId) throw new BusinessError('ACCES_REFUSE', 'Hors périmètre', 403);
  await ctx.db.envelope.update({ where: { id: envelopeId }, data });
  await audit(ctx.db, 'Envelope', envelopeId, 'ENVELOPPE_MODIFIEE', ctx.actor.userId, data as Record<string, unknown>);
}

export async function publishGrid(ctx: Ctx, rows: { durationMonths: number; coefficient: string; range?: Range | null }[]) {
  assertCan(ctx.actor, 'bank.params');
  const count = await ctx.db.coefficientGrid.count({ where: { financerId: ctx.actor.orgId } });
  const version = `BANQUE_PILOTE-${ctx.at.getUTCFullYear()}-v${Math.floor(count / 2) + 1}`;
  await ctx.db.coefficientGrid.updateMany({ where: { financerId: ctx.actor.orgId, effectiveTo: null }, data: { effectiveTo: ctx.at } });
  for (const r of rows) {
    if (!/^\d+(\.\d+)?$/.test(r.coefficient)) throw new BusinessError('COEF_INVALIDE', 'Coefficient invalide');
    await ctx.db.coefficientGrid.create({ data: { financerId: ctx.actor.orgId, version, durationMonths: r.durationMonths, range: r.range ?? null, coefficient: new Prisma.Decimal(r.coefficient), effectiveFrom: ctx.at, validatedBy: ctx.actor.userId } });
  }
  await setParam(ctx.db, 'coefficients', Object.fromEntries(rows.map((r) => [String(r.durationMonths), r.coefficient])), ctx.actor.userId, ctx.at);
  await audit(ctx.db, 'CoefficientGrid', version, 'GRILLE_PUBLIEE', ctx.actor.userId, { rows });
  return version;
}
