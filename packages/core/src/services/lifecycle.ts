import type { Grade } from '@solink/db';
import { SYSTEM, assertCan } from '../authz';
import { BusinessError } from '../errors';
import { transition } from '../order-machine';
import { audit } from '../audit';
import { addDays, daysBetween } from '../clock';
import { returnPenalty } from '../billing';
import { nextRef } from '../refs';
import { notifyRoles, orgByType, type Ctx } from './context';
import { emitWebhook } from './webhooks';
import { monthsBetween } from '../scoring';

export async function createTicket(ctx: Ctx, input: { subject: string; description: string; deviceId?: string | null; priority?: string }) {
  assertCan(ctx.actor, 'ticket.create');
  if (input.subject.trim().length < 3) throw new BusinessError('SUJET_REQUIS', 'Sujet requis');
  if (input.deviceId) {
    const d = await ctx.db.device.findUnique({ where: { id: input.deviceId }, include: { order: true } });
    if (!d || d.order?.organisationId !== ctx.actor.orgId) throw new BusinessError('EQUIPEMENT_INCONNU', 'Équipement inconnu');
  }
  const ref = await nextRef(ctx.db, 'TK', ctx.at.getUTCFullYear());
  const t = await ctx.db.ticket.create({ data: { ref, organisationId: ctx.actor.orgId, deviceId: input.deviceId || null, subject: input.subject, description: input.description, priority: input.priority ?? 'NORMALE', createdById: ctx.actor.userId, createdAt: ctx.at } });
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  await notifyRoles(ctx, solink.id, ['SOLINK_SUPPORT'], 'TICKET', { ref, subject: input.subject, status: 'ouvert' }, '/solink/tickets', ['EMAIL', 'PORTAIL']);
  return t;
}

export async function updateTicket(ctx: Ctx, ticketId: string, status: 'OUVERT' | 'EN_COURS' | 'RESOLU') {
  assertCan(ctx.actor, 'support.manage');
  const t = await ctx.db.ticket.update({ where: { id: ticketId }, data: { status } });
  await notifyRoles(ctx, t.organisationId, ['CLIENT_ADMIN'], 'TICKET', { ref: t.ref, subject: t.subject, status: status.toLowerCase().replace('_', ' ') }, '/client/tickets', ['EMAIL']);
  if (status === 'EN_COURS' && t.deviceId) await ctx.db.device.update({ where: { id: t.deviceId }, data: { status: 'EN_SAV' } });
  if (status === 'RESOLU' && t.deviceId) await ctx.db.device.updateMany({ where: { id: t.deviceId, status: 'EN_SAV' }, data: { status: 'ACTIF' } });
}

/** Fin de contrat (date de fin atteinte) → restitution ; renouvellement proposé à J-120. */
export async function processContractEnds(ctx: Ctx) {
  const contracts = await ctx.db.contract.findMany({ where: { status: 'ACTIF', endDate: { not: null } }, include: { order: true } });
  let ended = 0;
  for (const c of contracts) {
    const days = daysBetween(ctx.at, c.endDate!);
    if (days <= 120 && days > 0) {
      const key = `renouvellement:${c.id}`;
      if (!(await ctx.db.jobRun.findUnique({ where: { key } }))) {
        await ctx.db.jobRun.create({ data: { name: 'renouvellement', key, at: ctx.at } });
        await notifyRoles(ctx, c.order.organisationId, ['CLIENT_ADMIN'], 'RENOUVELLEMENT', { contract: c.ref }, '/client/parc', ['EMAIL']);
      }
    }
    if (c.endDate! <= ctx.at) {
      await ctx.db.contract.update({ where: { id: c.id }, data: { status: 'FIN_DE_CONTRAT', endReason: 'FIN_NORMALE' } });
      await ctx.db.order.update({ where: { id: c.orderId }, data: { endReason: 'FIN_NORMALE' } });
      await transition(ctx.db, c.orderId, 'FIN_DE_CONTRAT', SYSTEM, 'Échéance du contrat atteinte');
      await notifyRoles(ctx, c.order.organisationId, ['CLIENT_ADMIN'], 'FIN_DE_CONTRAT', { contract: c.ref }, '/client/parc');
      ended++;
    }
  }
  return ended;
}

/** Restitution : grade A–E → pénalité (grille A 0 % · B 5 % · C 15 % · D 40 % · E 100 % du prix d'achat résiduel). */
export async function gradeReturn(ctx: Ctx, deviceId: string, grade: Grade) {
  assertCan(ctx.actor, 'returns.manage');
  const d = await ctx.db.device.findUniqueOrThrow({ where: { id: deviceId }, include: { contract: true } });
  if (!d.contract) throw new BusinessError('SANS_CONTRAT', 'Équipement hors contrat');
  if (d.status === 'GRADE' || d.status === 'RETOURNE') throw new BusinessError('DEJA_RESTITUE', 'Équipement déjà restitué');
  const elapsed = d.contract.startDate ? Math.max(0, monthsBetween(d.contract.startDate, ctx.at)) : d.contract.durationMonths;
  const p = returnPenalty(grade, d.purchasePrice, d.contract.durationMonths, elapsed, ctx.params.grille_restitution_pct);
  await ctx.db.deviceReturn.create({ data: { deviceId, contractId: d.contract.id, grade, penaltyPct: p.pct, penalty: p.penalty, at: ctx.at } });
  await ctx.db.device.update({ where: { id: deviceId }, data: { status: 'GRADE', grade } });
  await audit(ctx.db, 'Device', deviceId, `RESTITUTION_GRADE_${grade}`, ctx.actor.userId, p);
  await emitWebhook(ctx, 'device.returned', { serial: d.serial, grade, penalty_xof: p.penalty });
  const remaining = await ctx.db.device.count({ where: { contractId: d.contract.id, status: { notIn: ['GRADE', 'RETOURNE', 'RECONDITIONNE', 'REVENDU', 'REDEPLOYE', 'RECYCLE'] } } });
  if (remaining === 0) {
    const order = await ctx.db.order.findUniqueOrThrow({ where: { id: d.contract.orderId } });
    if (order.status === 'FIN_DE_CONTRAT') {
      await ctx.db.contract.update({ where: { id: d.contract.id }, data: { status: 'CLOS' } });
      await transition(ctx.db, order.id, 'CLOS', ctx.actor, 'Tous les équipements sont restitués');
    }
  }
  return p;
}

export async function returnSummary(ctx: Ctx, contractId: string) {
  const returns = await ctx.db.deviceReturn.findMany({ where: { contractId } });
  const contract = await ctx.db.contract.findUniqueOrThrow({ where: { id: contractId } });
  const penalties = returns.reduce((a, r) => a + r.penalty, 0);
  return { returns: returns.length, penalties, deposit: contract.depositTtc, balance: penalties - contract.depositTtc };
}

export { addDays };
