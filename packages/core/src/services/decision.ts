import type { ConditionNature, ConditionType, DecisionResult } from '@solink/db';
import { creditBureau, orangeHistory } from '@solink/adapters';
import { SYSTEM, assertCan, assertOrderAccess, type Actor } from '../authz';
import { BusinessError } from '../errors';
import { transition } from '../order-machine';
import { audit } from '../audit';
import { addBusinessDays, addDays } from '../clock';
import { DOC_TYPES, type DossierBlocks } from '../checklist';
import { isSampled, recommendRoute, score, SCORING_RULESET_VERSION } from '../scoring';
import { fcfa, date } from '../format';
import { available, isUsable } from '../envelope';
import { notifyRoles, orgByType, type Ctx } from './context';
import { buildAndTransmitDfs } from './dfs';
import { clientExposure, releaseForOrder, reserveForOrder } from './envelope';
import { emitWebhook } from './webhooks';

export const AUTO_RULE_VERSION = 'BANQUE_PILOTE-ACCORD-AUTO-v1';
/** Délégations (F04) : montant maximal par niveau. */
export const DELEGATION = { N1: { label: 'Analyste (N1)', max: 100_000_000 }, N2: { label: 'Valideur (N2)', max: Number.MAX_SAFE_INTEGER } };

export function delegationOf(actor: Actor) {
  return actor.roles.includes('BANQUE_VALIDEUR') ? 'N2' : 'N1';
}

export async function computeScoring(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: true, creditFile: true, quotes: { orderBy: { version: 'desc' }, take: 1, include: { lines: true } } } });
  const org = order.organisation;
  const blocks = (order.creditFile?.blocks ?? {}) as DossierBlocks;
  const years = [...(blocks.finances?.years ?? [])].sort((a, b) => b.year - a.year);
  const y = years[0] ?? { ca: 0, rex: 0, rn: 0, cp: 0, dettes: 0, tresorerie: 0, year: 0 };
  const rentMonthly = (order.quotes[0]?.lines ?? []).reduce((a, l) => a + ((l.components as { rentHt: number }).rentHt ?? 0) * l.quantity, 0);
  const bic = await creditBureau.lookup(org.ninea ?? '');
  const os = await orangeHistory.paymentScore(org.ninea ?? '');
  const persons = blocks.dirigeants?.persons ?? [];
  const beDeclared = org.segment === 'PUBLIC' || persons.some((p) => p.type === 'BENEFICIAIRE_EFFECTIF');
  const result = score(
    { createdOn: org.createdOn, today: ctx.at, sector: org.sector, beDeclared, ca: y.ca, rex: y.rex, rn: y.rn, cp: y.cp, dettes: y.dettes, annualRentHt: rentMonthly * 12, bic: bic.result, orangeScore: os },
    ctx.params,
  );
  const env = await ctx.db.envelope.findFirst({ where: { financerId: order.financerId, active: true } });
  const exposure = env ? await clientExposure(ctx, env.id, org.id, orderId) : 0;
  const route = recommendRoute(
    {
      score: result.score,
      knockouts: result.knockouts,
      whitelisted: !!env?.whitelist.includes(org.id),
      amount: order.financedAmount,
      perClientCap: env?.perClientCap ?? 0,
      clientExposure: exposure,
      envelopeAvailable: env ? available(env) : 0,
      envelopeActive: !!env && isUsable({ ...env }, ctx.at),
    },
    ctx.params,
  );
  return { result, route, bic, orangeScore: os };
}

/** Transmission au financeur : scoring, DFS v1 scellé (portail + SFTP), webhook, voie de décision. */
export async function transmitToFinancer(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: true, financer: true } });
  const { result, route } = await computeScoring(ctx, orderId);
  await ctx.db.creditFile.update({
    where: { orderId },
    data: { score: result.score, riskClass: result.riskClass, factors: result.factors as object, knockouts: result.knockouts as object, route: route.route },
  });
  await transition(ctx.db, orderId, 'TRANSMIS_FINANCEUR', ctx.actor, `DFS transmis — voie recommandée : ${route.route} (${route.reasons.join(' ; ')})`);
  const { pkg } = await buildAndTransmitDfs(ctx, orderId);
  await emitWebhook(ctx, 'financing_request.submitted', { financing_request: order.ref.replace('CMD', 'FR'), package_id: pkg.packageId, manifest_sha256: pkg.manifestSha256, route: route.route });
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN'], 'DOSSIER_TRANSMIS', { ref: order.ref, financer: order.financer.name }, `/client/commandes/${orderId}`, ['EMAIL']);
  if (route.route === 'AUTO') {
    await autoApprove(ctx, orderId);
    return { result: 'ACCORD_AUTO' as const, score: result.score };
  }
  const sla = addBusinessDays(ctx.at, ctx.params.sla_analyste_jours_ouvres);
  await notifyRoles(ctx, order.financerId, ['BANQUE_ANALYSTE'], 'DOSSIER_A_INSTRUIRE', { ref: order.ref, org: order.organisation.name, amount: fcfa(order.financedAmount), sla: date(sla) }, `/banque/dossiers/${orderId}`, ['EMAIL', 'PORTAIL']);
  return { result: route.route, score: result.score };
}

/**
 * Accord automatique = exécution de la règle écrite et paramétrée par le financeur (pas une décision SOLINK ni IA).
 * Réserve l'enveloppe, référence la version de la règle, entre dans la population d'échantillonnage.
 */
export async function autoApprove(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { creditFile: true, organisation: true } });
  const validUntil = addDays(ctx.at, ctx.params.validite_accord_jours);
  const coef = ctx.params.coefficients[String(order.durationMonths)];
  const decision = await ctx.db.decision.create({
    data: {
      creditFileId: order.creditFile!.id,
      financerId: order.financerId,
      result: 'ACCORDE',
      amount: order.financedAmount,
      durationMonths: order.durationMonths,
      coefficient: coef,
      validUntil,
      automatic: true,
      ruleVersion: AUTO_RULE_VERSION,
      deciderId: 'SYSTEME',
      delegationLevel: 'REGLE',
      internalReason: `Liste blanche, score ${order.creditFile!.score} ≥ ${ctx.params.accord_auto_score_min}, montant ≤ plafond, aucun knock-out`,
      at: ctx.at,
    },
  });
  const sampled = isSampled(order.ref, ctx.params.echantillonnage_auto_pct);
  await ctx.db.order.update({ where: { id: orderId }, data: { sampled } });
  await reserveForOrder({ ...ctx, actor: SYSTEM }, orderId, order.financedAmount);
  await transition(ctx.db, orderId, 'ACCORDE', SYSTEM, `Accord automatique — règle ${AUTO_RULE_VERSION}`);
  await audit(ctx.db, 'Decision', decision.id, 'ACCORD_AUTOMATIQUE', 'SYSTEME', { rule: AUTO_RULE_VERSION, ruleset: SCORING_RULESET_VERSION, sampled, samplingPct: ctx.params.echantillonnage_auto_pct });
  if (sampled) await notifyRoles(ctx, order.financerId, ['BANQUE_RISK', 'BANQUE_VALIDEUR'], 'ECHANTILLON', { ref: order.ref }, `/banque/dossiers/${orderId}`, ['PORTAIL']);
  await afterApproval(ctx, orderId, 'ACCORDE');
}

async function afterApproval(ctx: Ctx, orderId: string, result: DecisionResult) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: true } });
  const labels: Record<string, [string, string]> = {
    ACCORDE: ['Accordé', 'signature électronique du contrat'],
    ACCORDE_SOUS_CONDITIONS: ['Accordé sous conditions', 'acceptez les conditions puis signez'],
    REFUSE: ['Non accordé', 'contactez votre chargé de dossier SOLINK'],
    SANS_SUITE: ['Sans suite', '—'],
  };
  const [r, next] = labels[result] ?? [result, ''];
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], 'DECISION', { ref: order.ref, result: r, next }, `/client/commandes/${orderId}`);
  if (order.apporteurId) await notifyRoles(ctx, order.apporteurId, ['ORANGE_COMMERCIAL'], 'DECISION_ORANGE', { ref: order.ref, org: order.organisation.name, result: r }, '/orange', ['EMAIL']);
  if (result === 'ACCORDE') {
    const { issueOffer } = await import('./contract');
    await issueOffer({ ...ctx, actor: SYSTEM }, orderId);
  }
}

async function loadBankOrder(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { creditFile: { include: { documents: true } }, organisation: true } });
  assertOrderAccess(ctx.actor, order);
  return order;
}

export async function acknowledge(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'bank.analyse');
  const order = await loadBankOrder(ctx, orderId);
  if (order.status !== 'TRANSMIS_FINANCEUR') return;
  await ctx.db.dfsPackage.updateMany({ where: { creditFileId: order.creditFile!.id, acknowledgedAt: null }, data: { acknowledgedAt: ctx.at } });
  await ctx.db.creditFile.update({ where: { orderId }, data: { analystId: ctx.actor.userId } });
  await transition(ctx.db, orderId, 'EN_ANALYSE', ctx.actor, 'Accusé de réception — instruction ouverte');
}

/** F05 — demande de pièces complémentaires. */
export async function requestDocuments(ctx: Ctx, orderId: string, items: { type: string; message: string; dueDays: number }[]) {
  assertCan(ctx.actor, 'bank.analyse');
  if (!items.length) throw new BusinessError('PIECES_REQUISES', 'Choisissez au moins une pièce');
  const order = await loadBankOrder(ctx, orderId);
  if (order.status === 'TRANSMIS_FINANCEUR') await acknowledge(ctx, orderId);
  const created = [];
  for (const it of items) {
    const due = addDays(ctx.at, it.dueDays || 3);
    created.push(
      await ctx.db.document.create({
        data: { creditFileId: order.creditFile!.id, type: it.type, label: DOC_TYPES[it.type]?.label ?? it.type, required: true, origin: 'DEMANDE_BANQUE', requestMessage: it.message, dueDate: due },
      }),
    );
  }
  await transition(ctx.db, orderId, 'PIECES_COMPLEMENTAIRES', ctx.actor, `Pièces demandées : ${created.map((d) => d.label).join(', ')}`);
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN', 'CLIENT_FINANCE'], 'PIECES_COMPLEMENTAIRES', { pieces: created.map((d) => d.label).join(', '), due: date(created[0].dueDate) }, `/client/commandes/${orderId}/dossier`);
  return created;
}

/** Le client a fourni les pièces : nouvelle version du DFS (manifest référençant le hash précédent) + différentiel. */
export async function provideComplements(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { creditFile: true } });
  assertOrderAccess(ctx.actor, order);
  await transition(ctx.db, orderId, 'EN_ANALYSE', ctx.actor, 'Pièces complémentaires fournies');
  await ctx.db.creditFile.update({ where: { orderId }, data: { version: { increment: 1 } } });
  const { pkg, diff } = await buildAndTransmitDfs(ctx, orderId);
  await emitWebhook(ctx, 'financing_request.updated', { financing_request: order.ref.replace('CMD', 'FR'), package_id: pkg.packageId, previous_package_sha256: pkg.previousSha256, diff });
  await notifyRoles(ctx, order.financerId, ['BANQUE_ANALYSTE'], 'DOSSIER_A_INSTRUIRE', { ref: order.ref, org: '', amount: fcfa(order.financedAmount), sla: `nouvelle version ${pkg.packageId}` }, `/banque/dossiers/${orderId}`, ['PORTAIL', 'EMAIL']);
  return { pkg, diff };
}

export interface DecisionInput {
  result: DecisionResult;
  amount?: number;
  durationMonths?: number;
  validityDays?: number;
  internalReason?: string;
  conditions?: { type: ConditionType; nature: ConditionNature; label: string; value?: string }[];
  idempotencyKey?: string;
}

/** F04 — décision du financeur (accord, accord sous conditions, refus, sans suite). Contrôle de délégation. */
export async function decide(ctx: Ctx, orderId: string, input: DecisionInput) {
  assertCan(ctx.actor, 'bank.decide');
  if (input.idempotencyKey) {
    const existing = await ctx.db.decision.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  const order = await loadBankOrder(ctx, orderId);
  if (order.status === 'TRANSMIS_FINANCEUR') await acknowledge(ctx, orderId);
  const fresh = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (fresh.status !== 'EN_ANALYSE') throw new BusinessError('ETAPE_INVALIDE', `Décision impossible au statut ${fresh.status}`);
  if (input.result === 'PIECES_COMPLEMENTAIRES') throw new BusinessError('UTILISER_DEMANDE_PIECES', 'Utilisez la demande de pièces');
  const amount = input.amount ?? order.financedAmount;
  const level = delegationOf(ctx.actor);
  if (['ACCORDE', 'ACCORDE_SOUS_CONDITIONS'].includes(input.result) && amount > DELEGATION[level].max)
    throw new BusinessError('DELEGATION_INSUFFISANTE', `Montant supérieur à votre délégation (${DELEGATION[level].label}) — décision réservée au valideur`, 403);
  const conditions = input.result === 'ACCORDE_SOUS_CONDITIONS' ? (input.conditions ?? []) : [];
  if (input.result === 'ACCORDE_SOUS_CONDITIONS' && !conditions.length) throw new BusinessError('CONDITIONS_REQUISES', 'Ajoutez au moins une condition');
  const decision = await ctx.db.decision.create({
    data: {
      creditFileId: order.creditFile!.id,
      financerId: order.financerId,
      result: input.result,
      amount: input.result === 'REFUSE' || input.result === 'SANS_SUITE' ? null : amount,
      durationMonths: input.durationMonths ?? order.durationMonths,
      coefficient: ctx.params.coefficients[String(input.durationMonths ?? order.durationMonths)],
      validUntil: addDays(ctx.at, input.validityDays ?? ctx.params.validite_accord_jours),
      deciderId: ctx.actor.userId,
      delegationLevel: level,
      internalReason: input.internalReason ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      at: ctx.at,
      conditions: { create: conditions.map((c) => ({ type: c.type, nature: c.nature, label: c.label, value: c.value ?? null })) },
    },
  });
  await audit(ctx.db, 'Decision', decision.id, `DECISION_${input.result}`, ctx.actor.userId, { amount, level, conditions: conditions.length });
  const to = input.result === 'SANS_SUITE' ? 'ANNULE' : input.result;
  await transition(ctx.db, orderId, to, ctx.actor, `Décision financeur : ${input.result}`);
  if (input.result === 'ACCORDE' || input.result === 'ACCORDE_SOUS_CONDITIONS') await reserveForOrder(ctx, orderId, amount);
  else await releaseForOrder(ctx, orderId);
  await afterApproval(ctx, orderId, input.result);
  return decision;
}

/** Accord sous conditions : le client accepte la nouvelle offre (conditions préalables à lever avant signature). */
export async function acceptConditions(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'quote.accept');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  assertOrderAccess(ctx.actor, order);
  if (order.status !== 'ACCORDE_SOUS_CONDITIONS') throw new BusinessError('ETAPE_INVALIDE', 'Aucune offre conditionnelle à accepter');
  const { issueOffer } = await import('./contract');
  await issueOffer(ctx, orderId, true);
}

/** Import des décisions déposées par la banque en CSV sur le SFTP simulé (./storage/sftp/in). */
export async function importSftpDecisions(ctx: Ctx) {
  const { financerTransport } = await import('@solink/adapters');
  const rows = await financerTransport.pullDecisions();
  const report: { line: number; ref: string; ok: boolean; message: string }[] = [];
  const files = new Set<string>();
  for (const r of rows) {
    files.add(r.file);
    const order = await ctx.db.order.findFirst({ where: { ref: r.financingRequest.replace(/^FR/, 'CMD'), financerId: ctx.actor.orgId } });
    if (!order) {
      report.push({ line: r.line, ref: r.financingRequest, ok: false, message: 'Dossier introuvable' });
      continue;
    }
    try {
      await decide(ctx, order.id, {
        result: r.result as DecisionResult,
        amount: r.amount ?? undefined,
        durationMonths: r.duration ?? undefined,
        internalReason: r.reason,
        idempotencyKey: `sftp:${r.file}:${r.line}`,
      });
      report.push({ line: r.line, ref: r.financingRequest, ok: true, message: `Décision ${r.result} importée` });
    } catch (e) {
      report.push({ line: r.line, ref: r.financingRequest, ok: false, message: (e as Error).message });
    }
  }
  ctx.after.push(async () => {
    for (const f of files) await financerTransport.archiveDecisionFile(f);
  });
  return report;
}

export async function solinkOrg(ctx: Ctx) {
  return orgByType(ctx.db, 'OPERATEUR');
}
