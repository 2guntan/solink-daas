import { audit } from '../audit';
import { available, isUsable, newlyCrossed, remainingPct, type EnvelopeState } from '../envelope';
import { fcfa } from '../format';
import { notifyRoles, orgByType, type Ctx } from './context';

export async function activeEnvelope(ctx: Ctx, financerId: string) {
  return ctx.db.envelope.findFirst({ where: { financerId, active: true }, orderBy: { endDate: 'desc' } });
}

/** Encours d'un client sur l'enveloppe (réservé + consommé net des libérations). */
export async function clientExposure(ctx: Ctx, envelopeId: string, orgId: string, excludeOrderId?: string) {
  const mvts = await ctx.db.envelopeMovement.findMany({ where: { envelopeId, order: { organisationId: orgId }, ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {}) } });
  return mvts.reduce((a, m) => a + (m.type === 'RESERVATION' ? m.amount : m.type === 'LIBERATION' ? -m.amount : 0), 0);
}

async function alertIfCrossed(ctx: Ctx, env: { id: string; name: string; financerId: string }, before: EnvelopeState, after: EnvelopeState) {
  for (const p of newlyCrossed(before, after)) {
    const vars = { name: env.name, pct: Math.round(remainingPct(after)), available: fcfa(available(after)) };
    await notifyRoles(ctx, env.financerId, ['BANQUE_RISK', 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE'], 'ENVELOPPE_ALERTE', vars, '/banque/parametrage', ['EMAIL', 'PORTAIL']);
    const solink = await orgByType(ctx.db, 'OPERATEUR');
    await notifyRoles(ctx, solink.id, ['SOLINK_ADMIN'], 'ENVELOPPE_ALERTE', vars, '/solink', ['EMAIL']);
    await audit(ctx.db, 'Envelope', env.id, `ALERTE_SEUIL_${p}`, 'SYSTEME', vars);
  }
}

function state(e: { total: number; reserved: number; consumed: number; endDate: Date; alertPcts: number[]; active: boolean }): EnvelopeState {
  return { total: e.total, reserved: e.reserved, consumed: e.consumed, endDate: e.endDate, alertPcts: e.alertPcts, active: e.active };
}

export async function reserveForOrder(ctx: Ctx, orderId: string, amount: number) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  const env = await activeEnvelope(ctx, order.financerId);
  if (!env) return null;
  const already = await ctx.db.envelopeMovement.findFirst({ where: { orderId, type: 'RESERVATION' } });
  if (already) return env;
  const before = state(env);
  const updated = await ctx.db.envelope.update({ where: { id: env.id }, data: { reserved: { increment: amount } } });
  await ctx.db.envelopeMovement.create({ data: { envelopeId: env.id, orderId, type: 'RESERVATION', amount, at: ctx.at } });
  await audit(ctx.db, 'Envelope', env.id, 'RESERVATION', ctx.actor.userId, { orderId, amount });
  await alertIfCrossed(ctx, env, before, state(updated));
  return updated;
}

export async function consumeForOrder(ctx: Ctx, orderId: string) {
  const res = await ctx.db.envelopeMovement.findFirst({ where: { orderId, type: 'RESERVATION' } });
  if (!res) return;
  const done = await ctx.db.envelopeMovement.findFirst({ where: { orderId, type: { in: ['CONSOMMATION', 'LIBERATION'] } } });
  if (done) return;
  await ctx.db.envelope.update({ where: { id: res.envelopeId }, data: { reserved: { decrement: res.amount }, consumed: { increment: res.amount } } });
  await ctx.db.envelopeMovement.create({ data: { envelopeId: res.envelopeId, orderId, type: 'CONSOMMATION', amount: res.amount, at: ctx.at } });
  await audit(ctx.db, 'Envelope', res.envelopeId, 'CONSOMMATION', ctx.actor.userId, { orderId, amount: res.amount });
}

export async function releaseForOrder(ctx: Ctx, orderId: string) {
  const res = await ctx.db.envelopeMovement.findFirst({ where: { orderId, type: 'RESERVATION' } });
  if (!res) return;
  const done = await ctx.db.envelopeMovement.findFirst({ where: { orderId, type: { in: ['CONSOMMATION', 'LIBERATION'] } } });
  if (done) return;
  await ctx.db.envelope.update({ where: { id: res.envelopeId }, data: { reserved: { decrement: res.amount } } });
  await ctx.db.envelopeMovement.create({ data: { envelopeId: res.envelopeId, orderId, type: 'LIBERATION', amount: res.amount, at: ctx.at } });
  await audit(ctx.db, 'Envelope', res.envelopeId, 'LIBERATION', ctx.actor.userId, { orderId, amount: res.amount });
}

export { isUsable, available };
