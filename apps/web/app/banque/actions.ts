'use server';

import type { ConditionNature, ConditionType, DecisionResult } from '@solink/db';
import { svc, type ParamKey } from '@solink/core';
import { act, int, str, type ActionResult } from '@/lib/action';

type A = ActionResult | null;
const B = 'banque' as const;

export async function acknowledgeAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.acknowledge(ctx, str(f, 'orderId'));
    return { ok: true, message: 'Accusé de réception envoyé — dossier en analyse.' };
  });
}
export async function requestDocsAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    const types = f.getAll('types').map(String).filter(Boolean);
    const docs = await svc.requestDocuments(ctx, str(f, 'orderId'), types.map((type) => ({ type, message: str(f, 'message'), dueDays: int(f, 'dueDays') || 3 })));
    return { ok: true, message: `${docs.length} pièce(s) demandée(s) au client.` };
  });
}
export async function decideAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    const result = str(f, 'result') as DecisionResult;
    const conditions = f
      .getAll('condType')
      .map(String)
      .map((type, i) => ({ type: type as ConditionType, nature: String(f.getAll('condNature')[i] ?? 'SUSPENSIVE') as ConditionNature, label: String(f.getAll('condLabel')[i] ?? ''), value: String(f.getAll('condValue')[i] ?? '') || undefined }))
      .filter((c) => c.type && c.label);
    await svc.decide(ctx, str(f, 'orderId'), { result, amount: int(f, 'amount') || undefined, durationMonths: int(f, 'duration') || undefined, validityDays: int(f, 'validityDays') || undefined, internalReason: str(f, 'reason'), conditions });
    return { ok: true, message: 'Décision enregistrée et notifiée.' };
  });
}
export async function liftConditionAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.liftCondition(ctx, str(f, 'conditionId'));
    return { ok: true, message: 'Condition levée.' };
  });
}
export async function confirmDepositAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.confirmDeposit(ctx, str(f, 'contractId'));
    return { ok: true, message: 'Dépôt de garantie confirmé.' };
  });
}
export async function activateMandateAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.activateMandate(ctx, str(f, 'contractId'));
    return { ok: true, message: 'Mandat de prélèvement activé.' };
  });
}
export async function validateDisbAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.validateDisbursement(ctx, str(f, 'id'));
    return { ok: true, message: 'Demande validée.' };
  });
}
export async function rejectDisbAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.rejectDisbursement(ctx, str(f, 'id'), str(f, 'reason'));
    return { ok: true, message: 'Demande rejetée.' };
  });
}
export async function paidDisbAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.confirmDisbursementPaid(ctx, str(f, 'id'), str(f, 'ref'));
    return { ok: true, message: 'Paiement confirmé — contrat actif.' };
  });
}
export async function orderLockAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.orderLock(ctx, str(f, 'lockOrderId'), str(f, 'reason'));
    return { ok: true, message: 'Ordre de verrouillage transmis à SOLINK pour exécution.' };
  });
}
export async function refuseLockAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.refuseLock(ctx, str(f, 'lockOrderId'), str(f, 'reason'));
    return { ok: true, message: 'Proposition de verrouillage refusée.' };
  });
}
export async function updateEnvelopeAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    await svc.updateEnvelope(ctx, str(f, 'envelopeId'), { total: int(f, 'total'), perClientCap: int(f, 'perClientCap'), endDate: new Date(`${str(f, 'endDate')}T23:59:00Z`), whitelist: f.getAll('whitelist').map(String), active: f.get('active') === 'on' });
    return { ok: true, message: 'Enveloppe mise à jour.' };
  });
}
export async function publishGridAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    const v = await svc.publishGrid(ctx, [
      { durationMonths: 24, coefficient: str(f, 'c24').replace(',', '.') },
      { durationMonths: 36, coefficient: str(f, 'c36').replace(',', '.') },
    ]);
    return { ok: true, message: `Grille ${v} publiée (les devis déjà émis restent figés).` };
  });
}
export async function bankParamAction(_: A, f: FormData) {
  return act(B, async (ctx) => {
    let value: unknown;
    try {
      value = JSON.parse(str(f, 'value'));
    } catch {
      return { ok: false, error: 'Valeur JSON invalide' };
    }
    await svc.updateParameter(ctx, str(f, 'key') as ParamKey, value);
    return { ok: true, message: 'Paramètre versionné.' };
  });
}
export async function importSftpAction() {
  return act(B, async (ctx) => {
    const r = await svc.importSftpDecisions(ctx);
    return { ok: true, message: r.length ? r.map((x) => `ligne ${x.line} ${x.ref} : ${x.message}`).join(' · ') : 'Aucun fichier de décision dans ./storage/sftp/in' };
  });
}
export async function assignAction(_: A, f: FormData) {
  return act(B, async (ctx, actor) => {
    await ctx.db.creditFile.update({ where: { orderId: str(f, 'orderId') }, data: { analystId: actor.userId } });
    return { ok: true, message: 'Dossier affecté.' };
  });
}
