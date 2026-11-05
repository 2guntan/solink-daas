'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@solink/db';
import { isBusinessError, svc } from '@solink/core';

/** La « banque » simulée : actions exécutées au nom de la trésorerie Banque Pilote (démo). */
async function asTreasury<T>(fn: (ctx: svc.Ctx) => Promise<T>) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: 'tresorerie@banque-demo.sn' } });
  const a = await svc.loadActor(u.id);
  return svc.run(a!, fn);
}
async function asValideur<T>(fn: (ctx: svc.Ctx) => Promise<T>) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: 'valideur@banque-demo.sn' } });
  const a = await svc.loadActor(u.id);
  return svc.run(a!, fn);
}

async function wrap(fn: () => Promise<string>) {
  try {
    const message = await fn();
    revalidatePath('/', 'layout');
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: isBusinessError(e) ? e.message : (e as Error).message };
  }
}

export async function confirmDepositSim(_: unknown, f: FormData) {
  return wrap(async () => {
    await asValideur((ctx) => svc.confirmDeposit(ctx, String(f.get('contractId'))));
    return 'Dépôt de garantie reçu sur le compte désigné par la banque.';
  });
}

export async function payDisbursementSim(_: unknown, f: FormData) {
  return wrap(async () => {
    const id = String(f.get('id'));
    await asTreasury(async (ctx) => {
      const d = await ctx.db.disbursement.findUniqueOrThrow({ where: { id } });
      if (d.status === 'DEMANDEE') await svc.validateDisbursement(ctx, id);
      await svc.confirmDisbursementPaid(ctx, id, String(f.get('ref') || `VIR-${d.ref}`));
    });
    return 'Virement à SOLINK confirmé par la banque (rapprochement).';
  });
}

export async function collectInvoiceSim(_: unknown, f: FormData) {
  return wrap(async () => {
    const id = String(f.get('invoiceId'));
    const amount = Number(String(f.get('amount')).replace(/\s/g, ''));
    await asTreasury((ctx) => svc.recordPayment(ctx, id, amount));
    return 'Encaissement client reçu sur le compte de cantonnement et ventilé.';
  });
}
