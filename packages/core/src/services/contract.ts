import type { MandateMethod } from '@solink/db';
import { esign, fileStore, messaging, payments } from '@solink/adapters';
import { SYSTEM, assertCan, assertOrderAccess } from '../authz';
import { BusinessError } from '../errors';
import { transition, suspensiveConditionsLifted } from '../order-machine';
import { audit } from '../audit';
import { addDays } from '../clock';
import { canonical, sha256 } from '../hash';
import { fcfa, dateTime } from '../format';
import { renderPdf } from '../pdf/render';
import { contractPackSpecs, type ContractDocInput } from '../pdf/documents';
import { nextRef } from '../refs';
import { notifyRoles, notifyUser, orgByType, type Ctx } from './context';
import { consumeForOrder } from './envelope';
import { emitWebhook } from './webhooks';

export async function contractDocInput(ctx: Ctx, orderId: string, withSigners = false): Promise<ContractDocInput> {
  const order = await ctx.db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      organisation: true,
      financer: true,
      contract: { include: { ceremonies: { include: { signers: true }, orderBy: { createdAt: 'desc' }, take: 1 }, installments: { orderBy: { number: 'asc' } } } },
      quotes: { where: { status: 'ACCEPTE' }, orderBy: { version: 'desc' }, take: 1, include: { lines: true } },
      creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } },
      devices: { include: { product: true, site: true } },
    },
  });
  const q = order.quotes[0];
  const c = order.contract;
  const signers = c?.ceremonies[0]?.signers ?? [];
  const roleLabel: Record<string, string> = { CLIENT: 'Client — signataire', CO_SIGNATAIRE: 'Co-signataire client', BANQUE: 'Banque (bailleur)' };
  return {
    contractRef: c?.ref ?? '—',
    orderRef: order.ref,
    org: order.organisation,
    financer: order.financer.name,
    duration: order.durationMonths,
    monthlyTtc: order.monthlyTtc,
    depositTtc: c?.depositTtc ?? order.depositTtc,
    financedAmount: order.financedAmount,
    lines: (q?.lines ?? []).map((l) => ({ label: l.label, quantity: l.quantity, site: l.siteName ?? '—', unitTtc: l.unitMonthlyTtc })),
    serials: order.devices.filter((d) => d.contractId).map((d) => ({ serial: d.serial, label: d.product.name, site: d.site?.name ?? '—' })),
    schedule: c?.installments.map((i) => ({ number: i.number, dueDate: i.dueDate, totalTtc: i.totalTtc })),
    conditions: order.creditFile?.decisions[0]?.conditions ?? [],
    depositReference: c?.depositReference ?? '—',
    signers: withSigners
      ? signers
          .sort((a, b) => a.order - b.order)
          .map((s) => ({ role: (s.role === 'BANQUE' ? 'Banque' : s.role === 'CO_SIGNATAIRE' ? 'Co-signataire' : 'Client') + ` — ${roleLabel[s.role]}`, name: s.name, signedAt: s.signedAt ? dateTime(s.signedAt) : undefined, hash: s.signedAt ? sha256(`${s.token}|${s.signedAt.toISOString()}`) : undefined }))
      : undefined,
  };
}

/** Génère (ou régénère) les documents du pack contractuel v4 §9.1. */
export async function generatePack(ctx: Ctx, orderId: string, signed = false, onlyKinds?: string[]) {
  const contract = await ctx.db.contract.findUniqueOrThrow({ where: { orderId } });
  const input = await contractDocInput(ctx, orderId, true);
  const specs = contractPackSpecs(input).filter((s) => !onlyKinds || onlyKinds.includes(s.kind));
  for (const s of specs) {
    const pdf = await renderPdf(s.spec);
    const existing = await ctx.db.contractDocument.findFirst({ where: { contractId: contract.id, kind: s.kind }, orderBy: { version: 'desc' } });
    const stored = await fileStore.put(ctx.db, `${contract.ref}_${s.kind}${signed ? '_signe' : ''}.pdf`, 'application/pdf', pdf, 'contrats');
    if (signed && existing) {
      await ctx.db.contractDocument.update({ where: { id: existing.id }, data: { signedFileId: stored.id, signedSha256: stored.sha256 } });
    } else if (existing) {
      await ctx.db.contractDocument.create({ data: { contractId: contract.id, kind: s.kind, title: s.title, version: existing.version + 1, fileId: stored.id, sha256: stored.sha256, signedFileId: existing.signedFileId ? stored.id : null, signedSha256: existing.signedFileId ? stored.sha256 : null } });
    } else {
      await ctx.db.contractDocument.create({ data: { contractId: contract.id, kind: s.kind, title: s.title, fileId: stored.id, sha256: stored.sha256 } });
    }
  }
}

/** Offre de financement : contrat + pack contractuel + mandat. */
export async function issueOffer(ctx: Ctx, orderId: string, clientAcceptsConditions = false) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { contract: true, creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } } } });
  if (order.contract) return order.contract;
  const decision = order.creditFile?.decisions[0];
  const depositCond = decision?.conditions.find((c) => c.type === 'DEPOT_MAJORE');
  const depositMult = depositCond?.value ? Math.max(1, Number(depositCond.value)) : ctx.params.depot_mensualites;
  const ref = await nextRef(ctx.db, 'CTR', ctx.at.getUTCFullYear());
  const refiLine = await ctx.db.refiLine.findFirst({ where: { financerId: order.financerId } });
  const org = await ctx.db.organisation.findUniqueOrThrow({ where: { id: order.organisationId } });
  const eligibleSegments = ((refiLine?.criteria as { segments?: string[] } | null)?.segments ?? []) as string[];
  const contract = await ctx.db.contract.create({
    data: {
      ref,
      orderId,
      financerId: order.financerId,
      durationMonths: order.durationMonths,
      monthlyTtc: order.monthlyTtc,
      depositTtc: order.monthlyTtc * depositMult,
      financedAmount: order.financedAmount,
      depositReference: payments.depositReference(ref),
      refiEligible: !!org.segment && eligibleSegments.includes(org.segment),
    },
  });
  await ctx.db.mandate.create({ data: { contractId: contract.id, reference: `MDT-${ref.slice(4)}` } });
  await ctx.db.order.update({ where: { id: orderId }, data: { depositTtc: contract.depositTtc } });
  await generatePack(ctx, orderId);
  await transition(ctx.db, orderId, 'OFFRE_EMISE', clientAcceptsConditions ? ctx.actor : SYSTEM, clientAcceptsConditions ? 'Conditions acceptées par le client — offre émise' : 'Offre et pack contractuel émis');
  await audit(ctx.db, 'Contract', contract.id, 'PACK_CONTRACTUEL_GENERE', ctx.actor.userId, { ref });
  await notifyRoles(ctx, order.organisationId, ['CLIENT_SIGNATAIRE'], 'DECISION', { ref: order.ref, result: 'Offre de financement émise', next: 'signez le contrat en ligne' }, `/client/commandes/${orderId}/signature`, ['EMAIL']);
  return contract;
}

/** v4 §9.3 — ouverture de la cérémonie : pouvoirs validés, conditions préalables levées, ordre des signataires. */
export async function startCeremony(ctx: Ctx, orderId: string, method: MandateMethod = 'PRELEVEMENT_BANCAIRE') {
  assertCan(ctx.actor, 'contract.sign');
  const order = await ctx.db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { organisation: true, contract: { include: { documents: true, ceremonies: true } }, creditFile: { include: { documents: true, decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } } },
  });
  assertOrderAccess(ctx.actor, order);
  if (order.status !== 'OFFRE_EMISE') throw new BusinessError('ETAPE_INVALIDE', 'Le contrat n’est pas prêt à signer');
  const powers = order.creditFile?.documents.find((d) => ['POUVOIRS', 'ACTE_NOMINATION'].includes(d.type) && d.origin === 'CHECKLIST');
  if (!powers || powers.status !== 'VALIDEE') throw new BusinessError('POUVOIRS_NON_VALIDES', 'La pièce établissant les pouvoirs des signataires doit être validée');
  const prealables = order.creditFile?.decisions[0]?.conditions.filter((c) => c.nature === 'PREALABLE' && c.status !== 'LEVEE') ?? [];
  if (prealables.length) throw new BusinessError('CONDITIONS_PREALABLES_NON_LEVEES', `Conditions préalables à lever : ${prealables.map((c) => c.label).join(', ')}`);
  const sigMembers = await ctx.db.membership.findMany({ where: { organisationId: order.organisationId, isSignatory: true }, include: { user: true }, orderBy: { createdAt: 'asc' } });
  // Le signataire qui ouvre la cérémonie signe en premier.
  sigMembers.sort((a, b) => (a.userId === ctx.actor.userId ? -1 : b.userId === ctx.actor.userId ? 1 : 0));
  const needed = order.organisation.jointSignature ? 2 : 1;
  if (sigMembers.length < needed) throw new BusinessError('SIGNATAIRES_INSUFFISANTS', `${needed} signataires habilités requis`);
  const clientSigners = sigMembers.slice(0, needed);
  const bank = await ctx.db.membership.findFirst({ where: { organisationId: order.financerId, roles: { has: 'BANQUE_VALIDEUR' }, user: { NOT: { email: { startsWith: 'api@' } } } }, include: { user: true }, orderBy: { createdAt: 'asc' } });
  if (!bank) throw new BusinessError('DELEGATAIRE_ABSENT', 'Aucun délégataire banque');
  const contract = order.contract!;
  await ctx.db.mandate.update({ where: { contractId: contract.id }, data: { method } });
  const signers = [
    ...clientSigners.map((m, i) => ({ userId: m.userId, name: `${m.user.firstName} ${m.user.lastName}`, order: i + 1, role: i === 0 ? 'CLIENT' : 'CO_SIGNATAIRE' })),
    { userId: bank.userId, name: `${bank.user.firstName} ${bank.user.lastName} (Banque Pilote)`, order: clientSigners.length + 1, role: 'BANQUE' },
  ];
  const req = await esign.createRequest({
    contractRef: contract.ref,
    documents: contract.documents.map((d) => ({ id: d.id, title: d.title, sha256: d.sha256 })),
    signers,
    expiresAt: addDays(ctx.at, ctx.params.validite_enveloppe_signature_jours),
  });
  const ceremony = await ctx.db.signatureCeremony.create({
    data: {
      contractId: contract.id,
      providerRef: req.providerRef,
      createdAt: ctx.at,
      expiresAt: addDays(ctx.at, ctx.params.validite_enveloppe_signature_jours),
      signers: {
        create: signers.map((s) => ({ userId: s.userId, name: s.name, role: s.role as 'CLIENT' | 'CO_SIGNATAIRE' | 'BANQUE', order: s.order, token: req.tokens[`${s.userId}:${s.role}`], status: s.order === 1 ? 'A_SIGNER' : 'EN_ATTENTE' })),
      },
    },
    include: { signers: true },
  });
  await transition(ctx.db, orderId, 'SIGNATURE_CLIENT', ctx.actor, `Cérémonie ${req.providerRef} ouverte`);
  const first = ceremony.signers.find((s) => s.order === 1)!;
  await notifyUser(ctx, first.userId, 'SIGNATURE_A_FAIRE', { ref: contract.ref, link: `/signer/${first.token}` }, `/signer/${first.token}`, ['SMS', 'WHATSAPP', 'EMAIL']);
  return ceremony;
}

export async function sendSigningOtp(ctx: Ctx, token: string) {
  const signer = await ctx.db.signer.findUniqueOrThrow({ where: { token }, include: { ceremony: true } });
  const user = await ctx.db.user.findUniqueOrThrow({ where: { id: signer.userId } });
  const code = String(100000 + Math.floor(Math.random() * 900000));
  await ctx.db.otpCode.create({ data: { identifier: `sign:${token}`, code, purpose: 'SIGNATURE', expiresAt: addDays(ctx.at, 1 / 144) } });
  await messaging.send(ctx.db, { to: user.email, channels: ['SMS'], template: 'OTP', vars: { code }, at: ctx.at });
}

async function checkOtp(ctx: Ctx, identifier: string, code: string) {
  if ((process.env.DEMO_MODE ?? 'true') === 'true' && code === '000000') return true;
  const otp = await ctx.db.otpCode.findFirst({ where: { identifier, usedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!otp || otp.expiresAt < ctx.at || otp.attempts >= 5) return false;
  if (otp.code !== code) {
    await ctx.db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await ctx.db.otpCode.update({ where: { id: otp.id }, data: { usedAt: ctx.at } });
  return true;
}

/** Signature d'un signataire (page /signer/[token]) — l'utilisateur connecté doit être le signataire. */
export async function signWithToken(ctx: Ctx, token: string, otp: string, ip: string | null) {
  const signer = await ctx.db.signer.findUniqueOrThrow({ where: { token }, include: { ceremony: { include: { signers: true, contract: true } } } });
  if (signer.userId !== ctx.actor.userId) throw new BusinessError('SIGNATAIRE_INVALIDE', 'Ce lien de signature est nominatif : connectez-vous avec le bon compte', 403);
  if (signer.status === 'SIGNE') return { providerRef: signer.ceremony.providerRef, signerId: signer.id, already: true };
  if (signer.status !== 'A_SIGNER') throw new BusinessError('PAS_VOTRE_TOUR', 'Ce n’est pas encore votre tour de signer');
  if (signer.ceremony.status !== 'EN_COURS' || signer.ceremony.expiresAt < ctx.at) throw new BusinessError('ENVELOPPE_EXPIREE', 'Enveloppe de signature expirée');
  if (!(await checkOtp(ctx, `sign:${token}`, otp))) throw new BusinessError('OTP_INVALIDE', 'Code OTP invalide ou expiré');
  await ctx.db.signer.update({ where: { id: signer.id }, data: { status: 'SIGNE', signedAt: ctx.at, ip } });
  await audit(ctx.db, 'SignatureCeremony', signer.ceremonyId, `SIGNATURE_${signer.role}`, ctx.actor.userId, { signer: signer.name, ip });
  return { providerRef: signer.ceremony.providerRef, signerId: signer.id, already: false };
}

/**
 * Traitement idempotent des webhooks e-sign (signer_done, signature_request_done).
 * Ordre : signataires client → contre-signature banque (sollicitée seulement après la dernière signature client).
 */
export async function handleEsignEvent(ctx: Ctx, event: { type: string; providerRef: string; signerId?: string }) {
  const ceremony = await ctx.db.signatureCeremony.findUniqueOrThrow({ where: { providerRef: event.providerRef }, include: { signers: { orderBy: { order: 'asc' } }, contract: { include: { order: true } } } });
  const order = ceremony.contract.order;
  const pending = ceremony.signers.filter((s) => s.status !== 'SIGNE');
  const next = pending[0];
  if (next && next.status === 'EN_ATTENTE') {
    await ctx.db.signer.update({ where: { id: next.id }, data: { status: 'A_SIGNER' } });
    if (next.role === 'BANQUE') {
      if (order.status === 'SIGNATURE_CLIENT') {
        await transition(ctx.db, order.id, 'CONTRESIGNATURE', SYSTEM, 'Toutes les signatures client recueillies');
        await emitWebhook(ctx, 'contract.client_signed', { contract: ceremony.contract.ref, provider_ref: ceremony.providerRef });
      }
      await notifyUser(ctx, next.userId, 'CONTRESIGNATURE', { ref: ceremony.contract.ref }, `/banque/dossiers/${order.id}`, ['EMAIL', 'PORTAIL']);
    } else {
      await notifyUser(ctx, next.userId, 'SIGNATURE_A_FAIRE', { ref: ceremony.contract.ref, link: `/signer/${next.token}` }, `/signer/${next.token}`, ['SMS', 'WHATSAPP', 'EMAIL']);
    }
    return { state: 'EN_COURS' };
  }
  if (!pending.length && ceremony.status === 'EN_COURS') {
    await finalizeCeremony(ctx, ceremony.id);
    return { state: 'TERMINEE' };
  }
  return { state: ceremony.status };
}

async function finalizeCeremony(ctx: Ctx, ceremonyId: string) {
  const ceremony = await ctx.db.signatureCeremony.findUniqueOrThrow({ where: { id: ceremonyId }, include: { signers: true, contract: { include: { order: true, documents: true } } } });
  const contract = ceremony.contract;
  const orderId = contract.orderId;
  await generatePack(ctx, orderId, true);
  const docs = await ctx.db.contractDocument.findMany({ where: { contractId: contract.id } });
  const proof = esign.proof({
    providerRef: ceremony.providerRef,
    contractRef: contract.ref,
    signers: ceremony.signers.map((s) => ({ name: s.name, role: s.role, signedAt: s.signedAt!.toISOString(), ip: s.ip, otpVerified: true })),
    documents: docs.map((d) => ({ title: d.title, sha256: d.sha256, signedSha256: d.signedSha256 ?? '' })),
  });
  const proofBuf = Buffer.from(JSON.stringify({ ...proof, proofHash: sha256(canonical(proof)) }, null, 2));
  const stored = await fileStore.put(ctx.db, `${contract.ref}_dossier_de_preuve.json`, 'application/json', proofBuf, 'contrats');
  await ctx.db.signatureCeremony.update({ where: { id: ceremonyId }, data: { status: 'TERMINEE', completedAt: ctx.at, proofFileId: stored.id } });
  await ctx.db.contract.update({ where: { id: contract.id }, data: { status: 'SIGNE', signedAt: ctx.at, insuranceIssuedAt: ctx.at } });
  await ctx.db.mandate.update({ where: { contractId: contract.id }, data: { status: 'SIGNE' } });
  await consumeForOrder({ ...ctx, actor: SYSTEM }, orderId);
  await transition(ctx.db, orderId, 'CONDITIONS_SUSPENSIVES', SYSTEM, 'Contre-signature banque — contrat signé par toutes les parties');
  await audit(ctx.db, 'Contract', contract.id, 'CONTRAT_SCELLE', 'SYSTEME', { proof: sha256(proofBuf) });
  await emitWebhook(ctx, 'contract.fully_signed', { contract: contract.ref, proof_sha256: sha256(proofBuf) });
  await notifyRoles(ctx, contract.order.organisationId, ['CLIENT_FINANCE', 'CLIENT_ADMIN'], 'DEPOT_MANDAT', { amount: fcfa(contract.depositTtc), depositRef: contract.depositReference }, `/client/commandes/${orderId}/signature`);
  await checkSuspensive(ctx, orderId);
}

/** F07 — levée d'une condition de la décision (caution, garantie, pièce…). */
export async function liftCondition(ctx: Ctx, conditionId: string) {
  assertCan(ctx.actor, 'bank.conditions');
  const c = await ctx.db.condition.findUniqueOrThrow({ where: { id: conditionId }, include: { decision: { include: { creditFile: { include: { order: true } } } } } });
  assertOrderAccess(ctx.actor, c.decision.creditFile.order);
  await ctx.db.condition.update({ where: { id: conditionId }, data: { status: 'LEVEE', liftedAt: ctx.at, liftedById: ctx.actor.userId } });
  await audit(ctx.db, 'Condition', conditionId, 'CONDITION_LEVEE', ctx.actor.userId, { type: c.type });
  await checkSuspensive(ctx, c.decision.creditFile.orderId);
}

/** Confirmation banque : dépôt de garantie reçu sur le compte désigné (jamais via SOLINK). */
export async function confirmDeposit(ctx: Ctx, contractId: string) {
  assertCan(ctx.actor, 'bank.conditions');
  const c = await ctx.db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { order: true } });
  assertOrderAccess(ctx.actor, c.order);
  if (!c.depositReceivedAt) {
    await ctx.db.contract.update({ where: { id: contractId }, data: { depositReceivedAt: ctx.at } });
    await audit(ctx.db, 'Contract', contractId, 'DEPOT_RECU_CONFIRME_BANQUE', ctx.actor.userId, { amount: c.depositTtc, ref: c.depositReference });
  }
  await checkSuspensive(ctx, c.orderId);
}

export async function activateMandate(ctx: Ctx, contractId: string) {
  assertCan(ctx.actor, 'bank.conditions');
  const c = await ctx.db.contract.findUniqueOrThrow({ where: { id: contractId }, include: { order: true, mandate: true } });
  assertOrderAccess(ctx.actor, c.order);
  if (c.mandate?.status === 'EN_ATTENTE') throw new BusinessError('MANDAT_NON_SIGNE', 'Le mandat n’est pas encore signé');
  await ctx.db.mandate.update({ where: { contractId }, data: { status: 'ACTIF', activatedAt: ctx.at } });
  await audit(ctx.db, 'Mandate', c.mandate!.id, 'MANDAT_ACTIVE', ctx.actor.userId, {});
  await checkSuspensive(ctx, c.orderId);
}

/** v4 §9.4 — passage à PRÊT POUR ACHAT dès que toutes les conditions suspensives sont levées. */
export async function checkSuspensive(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== 'CONDITIONS_SUSPENSIVES') return false;
  if (await suspensiveConditionsLifted(ctx.db, orderId)) return false;
  await transition(ctx.db, orderId, 'PRET_POUR_ACHAT', SYSTEM, 'Toutes les conditions suspensives sont levées');
  await emitWebhook(ctx, 'conditions.all_lifted', { order: order.ref });
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  await notifyRoles(ctx, solink.id, ['SOLINK_ACHATS'], 'DOSSIER_SOUMIS_SOLINK', { ref: order.ref, org: 'Prêt pour achat' }, `/solink/achats`, ['PORTAIL', 'EMAIL']);
  return true;
}

export async function suspensiveStatus(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: true, contract: { include: { mandate: true } }, creditFile: { include: { decisions: { orderBy: { at: 'desc' }, take: 1, include: { conditions: true } } } } },
  });
  const c = order.contract;
  const conds = order.creditFile?.decisions[0]?.conditions ?? [];
  return [
    { key: 'signature', label: 'Contrat signé par toutes les parties', owner: 'Client / Banque', ok: !!c?.signedAt },
    ...conds.map((x) => ({ key: x.id, label: `Condition : ${x.label}`, owner: 'Banque', ok: x.status === 'LEVEE' })),
    { key: 'depot', label: `Dépôt de garantie reçu (${fcfa(c?.depositTtc ?? 0)}, réf. ${c?.depositReference ?? '—'})`, owner: 'Client → compte banque', ok: !!c?.depositReceivedAt },
    { key: 'mandat', label: 'Mandat de prélèvement actif', owner: 'Banque', ok: c?.mandate?.status === 'ACTIF' },
    ...(order.lines.some((l) => l.insurance) ? [{ key: 'assurance', label: 'Assurance émise', owner: 'SOLINK / assureur', ok: !!c?.insuranceIssuedAt }] : []),
    { key: 'stock', label: 'Commande distributeur possible', owner: 'SOLINK', ok: true },
  ];
}
