import { prisma } from '@solink/db';
import { SYSTEM } from '../authz';
import { transition } from '../order-machine';
import { STATUS_INFO } from '../status';
import { addDays } from '../clock';
import { run, notifyRoles, orgByType, type Ctx } from './context';
import { generateDueInvoices, runDunning } from './billing';
import { processContractEnds } from './lifecycle';
import { releaseForOrder } from './envelope';

/** Expiration des devis (statut du devis) puis des commandes inactives 30 j après expiration. */
async function expireQuotes(ctx: Ctx) {
  const expired = await ctx.db.quote.findMany({ where: { status: 'EMIS', validUntil: { lt: ctx.at } }, include: { order: true } });
  for (const q of expired) {
    await ctx.db.quote.update({ where: { id: q.id }, data: { status: 'EXPIRE' } });
    if (q.order.status === 'DEVIS_EMIS' && addDays(q.validUntil, 30) < ctx.at) await transition(ctx.db, q.orderId, 'EXPIRE', SYSTEM, 'Devis expiré depuis plus de 30 jours');
  }
  // Rappel J-2
  const soon = await ctx.db.quote.findMany({ where: { status: 'EMIS', validUntil: { gt: ctx.at, lt: addDays(ctx.at, 2) } }, include: { order: true } });
  for (const q of soon) {
    const key = `devis-j2:${q.id}`;
    if (await ctx.db.jobRun.findUnique({ where: { key } })) continue;
    await ctx.db.jobRun.create({ data: { name: 'devis-j2', key, at: ctx.at } });
    await notifyRoles(ctx, q.order.organisationId, ['CLIENT_ADMIN'], 'DEVIS_EXPIRE_J2', { ref: `${q.ref}-v${q.version}`, validUntil: q.validUntil.toISOString().slice(0, 10) }, `/client/commandes/${q.orderId}`);
  }
  return expired.length;
}

async function expireAccords(ctx: Ctx) {
  const orders = await ctx.db.order.findMany({ where: { status: { in: ['ACCORDE', 'ACCORDE_SOUS_CONDITIONS'] } }, include: { creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1 } } } } });
  let n = 0;
  for (const o of orders) {
    const d = o.creditFile?.decisions[0];
    if (d?.validUntil && d.validUntil < ctx.at) {
      await transition(ctx.db, o.id, 'EXPIRE', SYSTEM, 'Validité de l’accord dépassée');
      await releaseForOrder(ctx, o.id);
      n++;
    }
  }
  return n;
}

/** Minuteries SLA : alerte au propriétaire puis escalade (une fois par état). */
async function slaAlerts(ctx: Ctx) {
  const orders = await ctx.db.order.findMany({ where: { status: { in: ['PRE_CONTROLE', 'TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'CONTRESIGNATURE', 'DECAISSEMENT_DEMANDE', 'DOSSIER_EN_COURS'] } } });
  let n = 0;
  for (const o of orders) {
    const info = STATUS_INFO[o.status];
    if (!info.slaHours) continue;
    const deadline = new Date(o.statusChangedAt.getTime() + info.slaHours * 3600_000);
    if (deadline > ctx.at) continue;
    const key = `sla:${o.id}:${o.status}:${o.statusChangedAt.toISOString()}`;
    if (await ctx.db.jobRun.findUnique({ where: { key } })) continue;
    await ctx.db.jobRun.create({ data: { name: 'sla', key, at: ctx.at } });
    const bankSide = ['TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'CONTRESIGNATURE', 'DECAISSEMENT_DEMANDE'].includes(o.status);
    if (bankSide) await notifyRoles(ctx, o.financerId, ['BANQUE_VALIDEUR'], 'SLA_DEPASSE', { ref: o.ref, state: info.label, to: 'valideur' }, `/banque/dossiers/${o.id}`, ['EMAIL', 'PORTAIL']);
    else if (o.status === 'DOSSIER_EN_COURS') await notifyRoles(ctx, o.organisationId, ['CLIENT_ADMIN'], 'DOSSIER_INACTIF', { ref: o.ref, action: 'compléter le dossier de financement' }, `/client/commandes/${o.id}/dossier`, ['WHATSAPP']);
    else {
      const solink = await orgByType(ctx.db, 'OPERATEUR');
      await notifyRoles(ctx, solink.id, ['SOLINK_ADMIN'], 'SLA_DEPASSE', { ref: o.ref, state: info.label, to: 'admin SOLINK' }, `/solink/commandes/${o.id}`, ['EMAIL', 'PORTAIL']);
    }
    n++;
  }
  return n;
}

export interface SchedulerReport {
  at: string;
  quotesExpired: number;
  accordsExpired: number;
  slaAlerts: number;
  invoicesCreated: number;
  dunningSent: number;
  contractsEnded: number;
}

/** Exécute tous les traitements dus (appelé par pg-boss et immédiatement après un saut d'horloge). */
export async function runScheduler(): Promise<SchedulerReport> {
  return run(SYSTEM, async (ctx) => {
    const r: SchedulerReport = {
      at: ctx.at.toISOString(),
      quotesExpired: await expireQuotes(ctx),
      accordsExpired: await expireAccords(ctx),
      slaAlerts: await slaAlerts(ctx),
      invoicesCreated: await generateDueInvoices(ctx),
      dunningSent: await runDunning(ctx),
      contractsEnded: await processContractEnds(ctx),
    };
    await ctx.db.jobRun.create({ data: { name: 'scheduler', key: `scheduler:${Date.now()}:${Math.random()}`, at: ctx.at, result: r as object } });
    return r;
  });
}

export { prisma };
