import type { ConsentType, DocStatus, Prisma } from '@solink/db';
import { fileStore, ocr } from '@solink/adapters';
import { assertCan, assertOrderAccess } from '../authz';
import { BusinessError } from '../errors';
import { transition } from '../order-machine';
import { audit } from '../audit';
import { addDays } from '../clock';
import { CHECKLIST_VERSION, DOC_TYPES, checklistFor, validityCheck, type DossierBlocks, type FinancialYear } from '../checklist';
import { renderPdf } from '../pdf/render';
import { demoPieceSpec } from '../pdf/documents';
import { notifyRoles, notifyUser, orgByType, type Ctx } from './context';
import { currentQuote } from './orders';

export const CONSENT_TEXTS: Record<ConsentType, { version: string; text: string }> = {
  CGU: { version: 'CGU-2026-11', text: 'J’accepte les conditions générales d’utilisation de la plateforme SOLINK DaaS.' },
  DONNEES_FINANCEMENT: {
    version: 'DONNEES-2026-11',
    text: 'J’autorise le traitement de mes données pour l’étude de financement et leur transmission au financeur Banque Pilote (démo) et, s’il y a lieu, au refinanceur Fonds Refi Démo.',
  },
  BIC: { version: 'BIC-2026-11', text: 'J’autorise le financeur à consulter le Bureau d’Information sur le Crédit (BIC) pour cette demande.' },
  ORANGE_HISTORIQUE: { version: 'ORANGE-2026-11', text: 'J’accepte l’échange de mon historique de paiement Orange avec le financeur, utilisé dans le scoring.' },
  EXACTITUDE: { version: 'EXACT-2026-11', text: 'Je certifie l’exactitude des informations et pièces fournies.' },
  PPE: { version: 'PPE-2026-11', text: 'Je déclare le statut de personne politiquement exposée (PPE) des dirigeants et bénéficiaires effectifs.' },
};

async function saveConsent(ctx: Ctx, orderId: string, type: ConsentType, meta: { ip?: string | null; userAgent?: string | null }) {
  const t = CONSENT_TEXTS[type];
  await ctx.db.consent.create({ data: { orderId, type, textVersion: t.version, text: t.text, at: ctx.at, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null, userId: ctx.actor.userId } });
}

/**
 * E13 — « Demander le financement » : en une transaction, crée DossierCredit, consentements horodatés
 * (IP, user-agent, version du texte), gèle les prix, ouvre le dossier pré-rempli, événement d'audit.
 */
export async function requestFinancing(
  ctx: Ctx,
  orderId: string,
  input: { cgu: boolean; donnees: boolean; bic: boolean; ip?: string | null; userAgent?: string | null },
) {
  assertCan(ctx.actor, 'financing.request');
  if (!input.cgu || !input.donnees || !input.bic) throw new BusinessError('CONSENTEMENTS_REQUIS', 'Les trois consentements sont obligatoires');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { organisation: { include: { persons: true } } } });
  assertOrderAccess(ctx.actor, order);
  const q = await currentQuote(ctx, orderId);
  if (!q || q.status !== 'ACCEPTE') throw new BusinessError('DEVIS_NON_ACCEPTE', 'Le devis doit être accepté');
  if (q.validUntil <= ctx.at) throw new BusinessError('DEVIS_EXPIRE', 'Le devis est expiré');
  const org = order.organisation;
  if (!org.segment) throw new BusinessError('SEGMENT_MANQUANT', 'Renseignez le segment de l’entreprise');
  const env = await ctx.db.envelope.findFirst({ where: { financerId: order.financerId, active: true } });
  const whitelisted = !!env?.whitelist.includes(org.id);
  const items = checklistFor(org.segment, { whitelisted });

  const blocks: DossierBlocks = {
    entreprise: {
      name: org.name,
      ninea: org.ninea ?? '',
      rccm: org.rccm ?? '',
      legalForm: org.legalForm ?? '',
      createdOn: org.createdOn ? org.createdOn.toISOString().slice(0, 10) : '',
      capital: org.capital ?? undefined,
      address: org.address ?? '',
      activity: org.sector ?? '',
      employees: org.employees ?? undefined,
      banks: org.currentBanks ?? '',
      group: org.groupName ?? '',
    },
    dirigeants: {
      persons: org.persons.map((p) => ({ type: p.type, firstName: p.firstName, lastName: p.lastName, role: p.role ?? undefined, ownershipPct: p.ownershipPct ?? undefined, ppe: p.ppe })),
    },
    finances: { years: [] },
    declarations: {},
  };
  // Réutilisation des agrégats financiers d'un dossier précédent (P4 « saisir une fois »).
  const prev = await ctx.db.creditFile.findFirst({ where: { order: { organisationId: org.id }, submittedAt: { not: null } }, orderBy: { submittedAt: 'desc' } });
  const prevBlocks = (prev?.blocks ?? {}) as DossierBlocks;
  if (prevBlocks.finances?.years?.length) blocks.finances = { years: prevBlocks.finances.years, commitments: prevBlocks.finances.commitments };

  const cf = await ctx.db.creditFile.create({
    data: { orderId, checklistVersion: CHECKLIST_VERSION(org.segment), blocks: blocks as Prisma.InputJsonValue },
  });
  // Pièces : checklist + réutilisation des pièces encore valides d'un dossier précédent (E18).
  for (const it of items) {
    const reusable = await ctx.db.document.findFirst({
      where: { type: it.type, status: 'VALIDEE', creditFile: { order: { organisationId: org.id } }, OR: [{ validUntil: null }, { validUntil: { gt: ctx.at } }] },
      orderBy: { updatedAt: 'desc' },
    });
    const stillValid = reusable && !validityCheck(it.type, reusable.docDate, ctx.at);
    await ctx.db.document.create({
      data: {
        creditFileId: cf.id,
        type: it.type,
        label: it.label,
        required: true,
        status: stillValid ? 'EN_VERIFICATION' : 'A_FOURNIR',
        version: stillValid ? 1 : 0,
        fileId: stillValid ? reusable.fileId : null,
        sha256: stillValid ? reusable.sha256 : null,
        extraction: stillValid ? (reusable.extraction ?? undefined) : undefined,
        docDate: stillValid ? reusable.docDate : null,
      },
    });
  }
  for (const t of ['CGU', 'DONNEES_FINANCEMENT', 'BIC'] as ConsentType[]) await saveConsent(ctx, orderId, t, input);
  await ctx.db.order.update({ where: { id: orderId }, data: { priceFrozenUntil: q.validUntil } });
  await transition(ctx.db, orderId, 'DOSSIER_EN_COURS', ctx.actor, 'Demande de financement — prix gelés jusqu’à la validité du devis');
  await audit(ctx.db, 'CreditFile', cf.id, 'DOSSIER_OUVERT', ctx.actor.userId, { orderId, checklist: cf.checklistVersion, whitelisted });
  await notifyRoles(ctx, order.organisationId, ['CLIENT_ADMIN', 'CLIENT_FINANCE'], 'DOSSIER_OUVERT', { ref: order.ref }, `/client/commandes/${orderId}/dossier`);
  return cf;
}

const EDITABLE_ORDER = ['DOSSIER_EN_COURS', 'DOSSIER_A_REPRENDRE', 'PIECES_COMPLEMENTAIRES'];

async function loadFile(ctx: Ctx, orderId: string, editable = true) {
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { creditFile: true, organisation: true } });
  assertOrderAccess(ctx.actor, order);
  if (!order.creditFile) throw new BusinessError('DOSSIER_ABSENT', 'Dossier absent');
  if (editable && !EDITABLE_ORDER.includes(order.status)) throw new BusinessError('DOSSIER_SCELLE', 'Dossier scellé : modification impossible à ce stade');
  return { order, cf: order.creditFile };
}

export async function saveBlock(ctx: Ctx, orderId: string, key: 'entreprise' | 'dirigeants' | 'finances', value: unknown) {
  assertCan(ctx.actor, 'dossier.edit');
  const { order, cf } = await loadFile(ctx, orderId);
  if (key === 'dirigeants' && ctx.actor.roles.length === 1 && ctx.actor.roles[0] === 'CLIENT_FINANCE')
    throw new BusinessError('ACCES_REFUSE', 'Le responsable financier a accès au bloc Finances uniquement', 403);
  const blocks = { ...((cf.blocks ?? {}) as DossierBlocks) } as Record<string, unknown>;
  if (key === 'finances') {
    const v = value as { years: FinancialYear[]; commitments?: string };
    for (const y of v.years) for (const k of ['ca', 'rex', 'rn', 'cp', 'dettes', 'tresorerie'] as const) if (!Number.isFinite(y[k])) throw new BusinessError('AGREGAT_INVALIDE', `Valeur invalide : ${k}`);
  }
  blocks[key] = value;
  await ctx.db.creditFile.update({ where: { id: cf.id }, data: { blocks: blocks as Prisma.InputJsonValue } });
  if (key === 'entreprise') {
    const e = value as NonNullable<DossierBlocks['entreprise']>;
    await ctx.db.organisation.update({
      where: { id: order.organisationId },
      data: { legalForm: e.legalForm || undefined, address: e.address || undefined, employees: e.employees || undefined, currentBanks: e.banks || undefined, groupName: e.group || undefined, capital: e.capital || undefined, rccm: e.rccm || undefined },
    });
  }
  if (key === 'dirigeants') {
    const persons = (value as NonNullable<DossierBlocks['dirigeants']>).persons ?? [];
    await ctx.db.organisation.update({ where: { id: order.organisationId }, data: { beDeclared: persons.some((p) => p.type === 'BENEFICIAIRE_EFFECTIF') || order.organisation.segment === 'PUBLIC' } });
  }
  await audit(ctx.db, 'CreditFile', cf.id, `BLOC_${key.toUpperCase()}_MAJ`, ctx.actor.userId, {});
}

export async function saveDeclarations(ctx: Ctx, orderId: string, d: { exactitude: boolean; ppe: boolean; orange: boolean }, meta: { ip?: string | null; userAgent?: string | null }) {
  assertCan(ctx.actor, 'dossier.edit');
  const { cf } = await loadFile(ctx, orderId);
  const blocks = { ...((cf.blocks ?? {}) as DossierBlocks), declarations: d };
  await ctx.db.creditFile.update({ where: { id: cf.id }, data: { blocks: blocks as unknown as Prisma.InputJsonValue } });
  if (d.exactitude) await saveConsent(ctx, orderId, 'EXACTITUDE', meta);
  if (d.ppe) await saveConsent(ctx, orderId, 'PPE', meta);
  if (d.orange) await saveConsent(ctx, orderId, 'ORANGE_HISTORIQUE', meta);
}

/** Génère une pièce PDF fictive « DOCUMENT FICTIF — DÉMO » pour un type de la checklist. */
export async function demoPieceBuffer(type: string, org: { name: string; ninea: string | null }, docDate: Date) {
  return renderPdf(demoPieceSpec(DOC_TYPES[type]?.label ?? type, org, [['Date du document', docDate.toISOString().slice(0, 10)]]));
}

/**
 * E18 — téléversement d'une pièce (fichier réel ou pièce de démo) : OCR simulé, contrôle de validité,
 * statut En vérification ou À reprendre (motif automatique), notification WhatsApp à l'auteur.
 */
export async function uploadDocument(
  ctx: Ctx,
  documentId: string,
  file: { name: string; mime: string; data: Buffer } | { demo: true; ageDays?: number },
) {
  assertCan(ctx.actor, 'dossier.edit');
  const doc = await ctx.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { creditFile: true } });
  const { order } = await loadFile(ctx, doc.creditFile.orderId);
  if (order.status === 'PIECES_COMPLEMENTAIRES' && doc.origin !== 'DEMANDE_BANQUE' && doc.status !== 'A_REPRENDRE')
    throw new BusinessError('DOSSIER_SCELLE', 'Seules les pièces demandées par la banque peuvent être ajoutées');
  if (['VALIDEE'].includes(doc.status)) throw new BusinessError('PIECE_VALIDEE', 'Pièce déjà validée');
  const allowedMime = ['application/pdf', 'image/jpeg', 'image/png'];
  let data: Buffer;
  let name: string;
  let mime: string;
  let docDate = ctx.at;
  if ('demo' in file) {
    docDate = addDays(ctx.at, -(file.ageDays ?? 15));
    data = await demoPieceBuffer(doc.type, order.organisation, docDate);
    name = `${doc.type}_demo.pdf`;
    mime = 'application/pdf';
  } else {
    if (!allowedMime.includes(file.mime)) throw new BusinessError('TYPE_FICHIER', 'Formats acceptés : PDF, JPG, PNG');
    if (file.data.length > 10 * 1024 * 1024) throw new BusinessError('TAILLE_FICHIER', 'Fichier trop volumineux (10 Mo max)');
    data = file.data;
    name = file.name;
    mime = file.mime;
  }
  const version = doc.version + 1;
  const ninea = (order.organisation.ninea ?? 'NA').replace(/[^\w]/g, '');
  const stamp = ctx.at.toISOString().slice(0, 10).replace(/-/g, '');
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
  const stored = await fileStore.put(ctx.db, `${doc.type}_${ninea}_${stamp}_v${version}.${ext}`, mime, data, 'pieces');
  // Fraude simple : même fichier déjà vu sous un autre NINEA (hash).
  const dup = await ctx.db.document.findFirst({ where: { sha256: stored.sha256, creditFile: { order: { organisationId: { not: order.organisationId } } } } });
  const extraction = await ocr.extract({ type: doc.type, org: order.organisation, today: ctx.at });
  if ('demo' in file) {
    const df = extraction.fields.find((f) => f.key.startsWith('date_'));
    if (df) df.value = docDate.toISOString().slice(0, 10);
  }
  const dateField = extraction.fields.find((f) => f.key === 'date_extrait' || f.key === 'date_document');
  const effectiveDate = dateField ? new Date(dateField.value) : docDate;
  const validityIssue = validityCheck(doc.type, effectiveDate, ctx.at);
  const status: DocStatus = validityIssue || dup ? 'A_REPRENDRE' : 'EN_VERIFICATION';
  const reason = validityIssue ?? (dup ? 'Document déjà transmis sous un autre NINEA' : null);
  const item = DOC_TYPES[doc.type];
  await ctx.db.document.update({
    where: { id: doc.id },
    data: {
      status,
      version,
      fileId: stored.id,
      sha256: stored.sha256,
      extraction: { ...extraction, confirmed: false } as object,
      docDate: effectiveDate,
      validUntil: item?.validityDays ? addDays(effectiveDate, item.validityDays) : null,
      rejectReason: reason,
      uploadedById: ctx.actor.userId,
    },
  });
  await audit(ctx.db, 'Document', doc.id, 'PIECE_TELEVERSEE', ctx.actor.userId, { type: doc.type, version, sha256: stored.sha256, status, originalName: name });
  if (status === 'A_REPRENDRE') await notifyReject(ctx, doc.id, reason!);
  return { status, reason, extraction };
}

export async function confirmExtraction(ctx: Ctx, documentId: string) {
  const doc = await ctx.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { creditFile: true } });
  await loadFile(ctx, doc.creditFile.orderId, false);
  const ex = (doc.extraction ?? {}) as Record<string, unknown>;
  await ctx.db.document.update({ where: { id: documentId }, data: { extraction: { ...ex, confirmed: true, confirmedBy: ctx.actor.userId } } });
}

export async function markNotApplicable(ctx: Ctx, documentId: string, justification: string) {
  assertCan(ctx.actor, 'dossier.edit');
  if (justification.trim().length < 5) throw new BusinessError('JUSTIFICATION_REQUISE', 'Justification requise');
  const doc = await ctx.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { creditFile: true } });
  await loadFile(ctx, doc.creditFile.orderId);
  await ctx.db.document.update({ where: { id: documentId }, data: { status: 'NON_APPLICABLE', naJustification: justification } });
  await audit(ctx.db, 'Document', documentId, 'PIECE_NON_APPLICABLE', ctx.actor.userId, { justification });
}

async function notifyReject(ctx: Ctx, documentId: string, reason: string) {
  const doc = await ctx.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { creditFile: { include: { order: true } } } });
  const link = `/client/commandes/${doc.creditFile.orderId}/dossier#piece-${doc.id}`;
  const vars = { piece: doc.label, motif: reason };
  if (doc.uploadedById) await notifyUser(ctx, doc.uploadedById, 'PIECE_A_REPRENDRE', vars, link, ['WHATSAPP', 'EMAIL']);
  await notifyRoles(ctx, doc.creditFile.order.organisationId, ['CLIENT_ADMIN'], 'PIECE_A_REPRENDRE', vars, link, ['WHATSAPP', 'EMAIL']);
}

/** E04 CA + E20 — soumission : scelle une version du dossier. */
export async function submitDossier(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'dossier.submit');
  const { order, cf } = await loadFile(ctx, orderId);
  const signatories = await ctx.db.membership.count({ where: { organisationId: order.organisationId, isSignatory: true } });
  if (!signatories) throw new BusinessError('SIGNATAIRE_REQUIS', 'Désignez au moins un signataire (Équipe et rôles)');
  const blocks = (cf.blocks ?? {}) as DossierBlocks;
  if (!blocks.declarations?.exactitude) throw new BusinessError('DECLARATIONS_REQUISES', 'Certifiez l’exactitude des informations (bloc 5)');
  const to = order.status === 'DOSSIER_A_REPRENDRE' ? 'PRE_CONTROLE' : 'PRE_CONTROLE';
  await transition(ctx.db, orderId, to, ctx.actor, order.status === 'DOSSIER_A_REPRENDRE' ? 'Dossier re-soumis' : 'Dossier soumis');
  const q = await currentQuote(ctx, orderId);
  // Gel prolongé jusqu'à la décision si le dossier est soumis avant expiration du devis (v4 §6.2).
  if (q && q.validUntil > ctx.at) await ctx.db.order.update({ where: { id: orderId }, data: { priceFrozenUntil: addDays(ctx.at, 60) } });
  await ctx.db.creditFile.update({ where: { id: cf.id }, data: { version: { increment: 1 }, submittedAt: ctx.at } });
  await audit(ctx.db, 'CreditFile', cf.id, 'DOSSIER_SCELLE', ctx.actor.userId, { version: cf.version + 1 });
  const solink = await orgByType(ctx.db, 'OPERATEUR');
  await notifyRoles(ctx, solink.id, ['SOLINK_CHARGE_DOSSIER'], 'DOSSIER_SOUMIS_SOLINK', { ref: order.ref, org: order.organisation.name }, `/solink/commandes/${orderId}`, ['EMAIL', 'PORTAIL']);
}

/** B02 — pré-contrôle SOLINK : complétude uniquement, aucun avis de crédit. */
export async function reviewDocument(ctx: Ctx, documentId: string, decision: 'VALIDEE' | 'A_REPRENDRE', reason?: string) {
  assertCan(ctx.actor, 'precontrole.review');
  const doc = await ctx.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { creditFile: { include: { order: true } } } });
  const st = doc.creditFile.order.status;
  if (!['PRE_CONTROLE', 'EN_ANALYSE', 'PIECES_COMPLEMENTAIRES', 'DOSSIER_EN_COURS'].includes(st)) throw new BusinessError('ETAPE_INVALIDE', 'Pré-contrôle impossible à cette étape');
  if (!doc.fileId && decision === 'VALIDEE' && doc.status !== 'NON_APPLICABLE') throw new BusinessError('PIECE_ABSENTE', 'Aucun fichier à valider');
  if (decision === 'A_REPRENDRE' && !reason?.trim()) throw new BusinessError('MOTIF_REQUIS', 'Motif de reprise requis');
  const keepNa = doc.status === 'NON_APPLICABLE' && decision === 'VALIDEE';
  await ctx.db.document.update({ where: { id: documentId }, data: { status: keepNa ? 'NON_APPLICABLE' : decision, rejectReason: decision === 'A_REPRENDRE' ? reason : null, verifiedById: ctx.actor.userId } });
  await audit(ctx.db, 'Document', documentId, decision === 'VALIDEE' ? 'PIECE_VALIDEE' : 'PIECE_A_REPRENDRE', ctx.actor.userId, { reason });
  if (decision === 'A_REPRENDRE') await notifyReject(ctx, documentId, reason!);
}

export async function validateAllPending(ctx: Ctx, orderId: string) {
  const cf = await ctx.db.creditFile.findUniqueOrThrow({ where: { orderId }, include: { documents: true } });
  for (const d of cf.documents) if (d.status === 'EN_VERIFICATION') await reviewDocument(ctx, d.id, 'VALIDEE');
}

/** Fin du pré-contrôle : à reprendre → client ; complet → scoring, DFS v1, transmission, voie de décision. */
export async function completePrecontrol(ctx: Ctx, orderId: string) {
  assertCan(ctx.actor, 'precontrole.review');
  const order = await ctx.db.order.findUniqueOrThrow({ where: { id: orderId }, include: { creditFile: { include: { documents: true } }, organisation: true } });
  if (order.status !== 'PRE_CONTROLE') throw new BusinessError('ETAPE_INVALIDE', 'Le dossier n’est pas en pré-contrôle');
  const docs = order.creditFile!.documents;
  const toRedo = docs.filter((d) => d.status === 'A_REPRENDRE');
  if (toRedo.length) {
    await transition(ctx.db, orderId, 'DOSSIER_A_REPRENDRE', ctx.actor, `${toRedo.length} pièce(s) à reprendre`);
    return { result: 'A_REPRENDRE' as const };
  }
  if (docs.some((d) => d.required && d.origin === 'CHECKLIST' && d.status === 'EN_VERIFICATION'))
    throw new BusinessError('PIECES_NON_VALIDEES', 'Validez ou faites reprendre chaque pièce avant de terminer');
  const { transmitToFinancer } = await import('./decision');
  return transmitToFinancer(ctx, orderId);
}
