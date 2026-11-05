import type { DunningLevel } from '@solink/db';
import { fileStore, mdm, orangeBilling, payments } from '@solink/adapters';
import { SYSTEM, assertCan, assertOrderAccess } from '../authz';
import { BusinessError } from '../errors';
import { audit } from '../audit';
import { daysBetween, periodOf } from '../clock';
import { fcfa, date } from '../format';
import { renderPdf } from '../pdf/render';
import { invoiceSpec } from '../pdf/documents';
import { nextRef } from '../refs';
import { allocate, dunningLevelsDue, DUNNING_TEMPLATES, invoiceLines, targetBuckets, type Bucket, type InvoiceBreakdown } from '../billing';
import { commissionSchedule } from '../pricing';
import { notifyRoles, orgByType, type Ctx } from './context';
import { contractAmounts } from './fulfilment';
import { emitWebhook } from './webhooks';

/** Job mensuel OrangeBilling : factures 2 lignes émises le 1er (échéance le 15) pour chaque échéance due. */
export async function generateDueInvoices(ctx: Ctx) {
  const due = await ctx.db.installment.findMany({
    where: { invoiceId: null, contract: { status: { in: ['ACTIF', 'FIN_DE_CONTRAT'] } } },
    include: { contract: { include: { order: { include: { organisation: true, financer: true } } } } },
    orderBy: { number: 'asc' },
  });
  let created = 0;
  for (const inst of due) {
    const issueDate = new Date(Date.UTC(inst.dueDate.getUTCFullYear(), inst.dueDate.getUTCMonth(), ctx.params.facture_jour_emission));
    if (issueDate > ctx.at) continue;
    const c = inst.contract;
    const amounts = await contractAmounts(ctx, c.orderId);
    const comm = commissionSchedule(c.financedAmount, ctx.params.commission_apporteur_pct, c.durationMonths)[inst.number - 1] ?? 0;
    const lines = invoiceLines(amounts, comm);
    const ref = await nextRef(ctx.db, 'FO', issueDate.getUTCFullYear());
    const period = periodOf(inst.dueDate);
    const pdf = await renderPdf(invoiceSpec({ ref, period, issueDate, dueDate: inst.dueDate, client: c.order.organisation.name, ninea: c.order.organisation.ninea, contractRef: c.ref, financer: c.order.financer.name, ...lines }));
    const stored = await fileStore.put(ctx.db, `${ref}.pdf`, 'application/pdf', pdf, 'factures');
    const inv = await ctx.db.invoice.create({
      data: { ref, contractId: c.id, period, issueDate, dueDate: inst.dueDate, ...lines, breakdown: lines.breakdown as object, fileId: stored.id },
    });
    await ctx.db.installment.update({ where: { id: inst.id }, data: { invoiceId: inv.id } });
    await notifyRoles(ctx, c.order.organisationId, ['CLIENT_FINANCE'], 'FACTURE_EMISE', { ref, amount: fcfa(lines.totalTtc), due: date(inst.dueDate) }, '/client/factures');
    created++;
  }
  // Statut impayé après échéance
  await ctx.db.invoice.updateMany({ where: { status: { in: ['EMISE', 'PARTIELLE'] }, dueDate: { lt: ctx.at } }, data: { status: 'IMPAYEE' } });
  return created;
}

async function remainingBuckets(ctx: Ctx, invoiceId: string): Promise<Bucket[]> {
  const inv = await ctx.db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { payments: { include: { allocations: true } } } });
  const target = targetBuckets(inv.breakdown as unknown as InvoiceBreakdown);
  const done = inv.payments.flatMap((p) => p.allocations);
  return target.map((b) => ({ ...b, amount: b.amount - done.filter((a) => a.component === b.component).reduce((s, a) => s + a.amount, 0) }));
}

/** Encaissement confirmé par la banque (cantonnement) → ventilation déterministe Banque / Orange / SOLINK. */
export async function recordPayment(ctx: Ctx, invoiceId: string, amount: number, reference?: string) {
  if (!['FINANCEUR'].includes(ctx.actor.orgType) && ctx.actor.userId !== 'SYSTEME') throw new BusinessError('ACCES_REFUSE', 'Seule la banque confirme un encaissement', 403);
  if (!Number.isInteger(amount) || amount <= 0) throw new BusinessError('MONTANT_INVALIDE', 'Montant invalide');
  const inv = await ctx.db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { contract: { include: { order: true } } } });
  assertOrderAccess(ctx.actor, inv.contract.order);
  const rest = inv.totalTtc - inv.paidAmount;
  if (rest <= 0) throw new BusinessError('FACTURE_SOLDEE', 'Facture déjà soldée');
  if (amount > rest) throw new BusinessError('MONTANT_SUPERIEUR', `Montant supérieur au reste dû (${fcfa(rest)})`);
  const ref = reference || `ENC-${inv.ref}-${inv.paidAmount + amount}`;
  const parts = allocate(amount, await remainingBuckets(ctx, invoiceId));
  const pay = await ctx.db.payment.create({ data: { invoiceId, amount, at: ctx.at, reference: ref, allocations: { create: parts.map((p) => ({ beneficiary: p.beneficiary, component: p.component, amount: p.amount })) } } });
  const paid = inv.paidAmount + amount;
  const status = paid >= inv.totalTtc ? 'PAYEE' : 'PARTIELLE';
  await ctx.db.invoice.update({ where: { id: invoiceId }, data: { paidAmount: paid, status } });
  await audit(ctx.db, 'Payment', pay.id, 'ENCAISSEMENT_VENTILE', ctx.actor.userId, { invoice: inv.ref, amount, parts });
  await notifyRoles(ctx, inv.contract.order.organisationId, ['CLIENT_FINANCE'], 'REGULARISATION', { amount: fcfa(amount), ref: inv.ref }, '/client/factures', ['EMAIL']);
  if (status === 'PAYEE') await regularize(ctx, inv.contractId);
  return pay;
}

/** Régularisation : plus aucune facture échue impayée → levée des verrouillages (exécution MDM tracée). */
async function regularize(ctx: Ctx, contractId: string) {
  const overdue = await ctx.db.invoice.count({ where: { contractId, status: { in: ['IMPAYEE', 'PARTIELLE'] }, dueDate: { lt: ctx.at } } });
  if (overdue) return;
  const locks = await ctx.db.lockOrder.findMany({ where: { contractId, status: { in: ['PROPOSE', 'ORDONNE', 'EXECUTE'] } }, include: { contract: { include: { order: true } } } });
  for (const l of locks) {
    if (l.status === 'EXECUTE') {
      const devices = await ctx.db.device.findMany({ where: { contractId, status: 'VERROUILLE' } });
      for (const d of devices) {
        await mdm.unlock(d.mdmId ?? d.serial);
        await ctx.db.device.update({ where: { id: d.id }, data: { status: 'ACTIF', lockedAt: null } });
        await ctx.db.mdmAction.create({ data: { deviceId: d.id, action: 'DEVERROUILLER', lockOrderId: l.id, executedById: 'SYSTEME', at: ctx.at } });
      }
      await notifyRoles(ctx, l.contract.order.organisationId, ['CLIENT_ADMIN', 'CLIENT_FINANCE'], 'DEVERROUILLAGE', { contract: l.contract.ref }, '/client/parc');
    }
    await ctx.db.lockOrder.update({ where: { id: l.id }, data: { status: 'LEVE', liftedAt: ctx.at } });
    await audit(ctx.db, 'LockOrder', l.id, 'VERROUILLAGE_LEVE_REGULARISATION', ctx.actor.userId, {});
  }
}

/** Relances impayé J+1 / J+7 / J+15 (proposition de verrouillage à la banque) / J+30 / J+60. */
export async function runDunning(ctx: Ctx) {
  const invoices = await ctx.db.invoice.findMany({
    where: { status: { in: ['EMISE', 'PARTIELLE', 'IMPAYEE'] }, dueDate: { lt: ctx.at } },
    include: { dunnings: true, contract: { include: { order: { include: { organisation: true } } } } },
  });
  let sent = 0;
  for (const inv of invoices) {
    const days = daysBetween(inv.dueDate, ctx.at);
    const levels = dunningLevelsDue(days, ctx.params.relances_jours) as DunningLevel[];
    for (const level of levels) {
      if (inv.dunnings.some((d) => d.level === level)) continue;
      await ctx.db.dunning.create({ data: { invoiceId: inv.id, level, at: ctx.at } });
      sent++;
      const c = inv.contract;
      const rest = fcfa(inv.totalTtc - inv.paidAmount);
      const vars = { ref: inv.ref, amount: rest, due: date(inv.dueDate), days, contract: c.ref };
      const orgId = c.order.organisationId;
      const tpl = DUNNING_TEMPLATES[level].template;
      if (level === 'J1_RAPPEL' || level === 'J7_RELANCE' || level === 'J30_MISE_EN_DEMEURE') {
        await notifyRoles(ctx, orgId, ['CLIENT_FINANCE', 'CLIENT_ADMIN'], tpl, vars, '/client/factures');
      }
      if (level === 'J1_RAPPEL') await emitWebhook(ctx, 'invoice.unpaid', { invoice: inv.ref, contract: c.ref, days_overdue: days });
      if (level === 'J15_VERROUILLAGE') {
        const existing = await ctx.db.lockOrder.findFirst({ where: { contractId: c.id, status: { in: ['PROPOSE', 'ORDONNE', 'EXECUTE'] } } });
        if (!existing) await ctx.db.lockOrder.create({ data: { contractId: c.id, invoiceId: inv.id, reason: `Impayé J+${days} sur ${inv.ref} (${rest})`, proposedAt: ctx.at } });
        await notifyRoles(ctx, c.financerId, ['BANQUE_RISK', 'BANQUE_VALIDEUR', 'BANQUE_ANALYSTE'], tpl, vars, '/banque/verrouillages', ['EMAIL', 'PORTAIL']);
        await notifyRoles(ctx, orgId, ['CLIENT_FINANCE', 'CLIENT_ADMIN'], 'IMPAYE_PRE_VERROUILLAGE_CLIENT', vars, '/client/factures');
        await emitWebhook(ctx, 'invoice.unpaid', { invoice: inv.ref, contract: c.ref, days_overdue: days, lock_proposed: true });
      }
      if (level === 'J60_RESILIATION') await notifyRoles(ctx, c.financerId, ['BANQUE_RISK', 'BANQUE_VALIDEUR'], tpl, vars, '/banque/portefeuille', ['EMAIL', 'PORTAIL']);
      await audit(ctx.db, 'Invoice', inv.id, `RELANCE_${level}`, 'SYSTEME', { days });
    }
  }
  return sent;
}

/** Ordre de verrouillage : décidé par la banque (écran de confirmation + motif). */
export async function orderLock(ctx: Ctx, lockOrderId: string, reason: string) {
  assertCan(ctx.actor, 'bank.lock');
  if (!reason.trim()) throw new BusinessError('MOTIF_REQUIS', 'Motif requis');
  const l = await ctx.db.lockOrder.findUniqueOrThrow({ where: { id: lockOrderId }, include: { contract: { include: { order: true } } } });
  assertOrderAccess(ctx.actor, l.contract.order);
  if (l.status !== 'PROPOSE') throw new BusinessError('ETAPE_INVALIDE', 'Ordre déjà traité');
  await ctx.db.lockOrder.update({ where: { id: lockOrderId }, data: { status: 'ORDONNE', orderedById: ctx.actor.userId, orderedAt: ctx.at, reason: `${l.reason} — ${reason}` } });
  await audit(ctx.db, 'LockOrder', lockOrderId, 'VERROUILLAGE_ORDONNE_BANQUE', ctx.actor.userId, { reason });
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  await notifyRoles(ctx, solink.id, ['SOLINK_MDM', 'SOLINK_ADMIN'], 'VERROUILLAGE_ORDONNE', { contract: l.contract.ref }, '/solink/parc', ['EMAIL', 'PORTAIL']);
}

export async function refuseLock(ctx: Ctx, lockOrderId: string, reason: string) {
  assertCan(ctx.actor, 'bank.lock');
  const l = await ctx.db.lockOrder.findUniqueOrThrow({ where: { id: lockOrderId }, include: { contract: { include: { order: true } } } });
  assertOrderAccess(ctx.actor, l.contract.order);
  await ctx.db.lockOrder.update({ where: { id: lockOrderId }, data: { status: 'REFUSE', reason: `${l.reason} — refus : ${reason}` } });
  await audit(ctx.db, 'LockOrder', lockOrderId, 'VERROUILLAGE_REFUSE_BANQUE', ctx.actor.userId, { reason });
}

/** Exécution MDM par SOLINK — uniquement après ordre banque. */
export async function executeLock(ctx: Ctx, lockOrderId: string) {
  assertCan(ctx.actor, 'mdm.execute');
  const l = await ctx.db.lockOrder.findUniqueOrThrow({ where: { id: lockOrderId }, include: { contract: { include: { order: true } } } });
  if (l.status !== 'ORDONNE') throw new BusinessError('ORDRE_BANQUE_REQUIS', 'Verrouillage impossible sans ordre de la banque');
  const devices = await ctx.db.device.findMany({ where: { contractId: l.contractId, status: 'ACTIF' } });
  for (const d of devices) {
    await mdm.lock(d.mdmId ?? d.serial);
    await ctx.db.device.update({ where: { id: d.id }, data: { status: 'VERROUILLE', lockedAt: ctx.at } });
    await ctx.db.mdmAction.create({ data: { deviceId: d.id, action: 'VERROUILLER', lockOrderId, executedById: ctx.actor.userId, at: ctx.at } });
    await emitWebhook(ctx, 'device.locked', { serial: d.serial, contract: l.contract.ref });
  }
  await ctx.db.lockOrder.update({ where: { id: lockOrderId }, data: { status: 'EXECUTE', executedById: ctx.actor.userId, executedAt: ctx.at } });
  await audit(ctx.db, 'LockOrder', lockOrderId, 'VERROUILLAGE_EXECUTE_MDM', ctx.actor.userId, { devices: devices.length });
  const inv = l.invoiceId ? await ctx.db.invoice.findUnique({ where: { id: l.invoiceId } }) : null;
  await notifyRoles(ctx, l.contract.order.organisationId, ['CLIENT_ADMIN', 'CLIENT_FINANCE'], 'VERROUILLAGE_EXECUTE', { contract: l.contract.ref, ref: inv?.ref ?? '' }, '/client/factures');
  return devices.length;
}

/** Rapprochement : facturé / encaissé / ventilé (écart attendu = 0). */
export async function reconciliation(ctx: Ctx, where: { financerId?: string; organisationId?: string } = {}) {
  const invoices = await ctx.db.invoice.findMany({ where: { contract: { ...(where.financerId ? { financerId: where.financerId } : {}), ...(where.organisationId ? { order: { organisationId: where.organisationId } } : {}) } }, include: { payments: { include: { allocations: true } } } });
  const invoiced = invoices.reduce((a, i) => a + i.totalTtc, 0);
  const collected = invoices.reduce((a, i) => a + i.payments.reduce((s, p) => s + p.amount, 0), 0);
  const allocs = invoices.flatMap((i) => i.payments.flatMap((p) => p.allocations));
  const allocated = allocs.reduce((a, x) => a + x.amount, 0);
  const by = (b: string) => allocs.filter((a) => a.beneficiary === b).reduce((s, a) => s + a.amount, 0);
  const paidInvoicesTotal = invoices.filter((i) => i.status === 'PAYEE').reduce((a, i) => a + i.totalTtc, 0);
  const paidCollected = invoices.filter((i) => i.status === 'PAYEE').reduce((a, i) => a + i.payments.reduce((s, p) => s + p.amount, 0), 0);
  return {
    invoiced,
    collected,
    allocated,
    outstanding: invoiced - collected,
    gapCollectedAllocated: collected - allocated,
    gapPaidInvoices: paidInvoicesTotal - paidCollected,
    banque: by('BANQUE'),
    orange: by('ORANGE'),
    solink: by('SOLINK'),
  };
}

export async function cantonmentStatementCsv(ctx: Ctx, financerId: string) {
  const pays = await ctx.db.payment.findMany({ where: { invoice: { contract: { financerId } } }, include: { allocations: true, invoice: true }, orderBy: { at: 'asc' } });
  const rows = pays.flatMap((p) => [
    { date: date(p.at), reference: p.reference, label: `Encaissement ${p.invoice.ref}`, debit: 0, credit: p.amount },
    ...p.allocations.map((a) => ({ date: date(p.at), reference: p.reference, label: `Ventilation ${a.component}`, debit: a.amount, credit: 0, beneficiary: a.beneficiary })),
  ]);
  return payments.statementCsv(rows);
}

export async function orangeExportCsv(ctx: Ctx, period?: string) {
  const invoices = await ctx.db.invoice.findMany({ where: period ? { period } : {}, include: { contract: { include: { order: { include: { organisation: true, financer: true } } } } }, orderBy: { issueDate: 'asc' } });
  return orangeBilling.exportCsv(
    invoices.map((i) => ({
      invoiceRef: i.ref,
      period: i.period,
      issueDate: i.issueDate.toISOString().slice(0, 10),
      dueDate: i.dueDate.toISOString().slice(0, 10),
      clientName: i.contract.order.organisation.name,
      clientNinea: i.contract.order.organisation.ninea ?? '',
      contractRef: i.contract.ref,
      financer: i.contract.order.financer.name,
      line1Ht: i.line1Ht,
      line1Tva: i.line1Tva,
      line1Ttc: i.line1Ttc,
      line2Ht: i.line2Ht,
      line2Tva: i.line2Tva,
      line2Ttc: i.line2Ttc,
      totalTtc: i.totalTtc,
      status: i.status,
    })),
  );
}

export { SYSTEM };
