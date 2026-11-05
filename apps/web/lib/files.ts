import 'server-only';
import { prisma } from '@solink/db';
import type { Actor } from '@solink/core';

/** Journal d'accès + cloisonnement : un client ne voit que les fichiers de ses commandes ; Orange jamais les pièces. */
export async function fileAccessible(actor: Actor, fileId: string): Promise<boolean> {
  if (actor.orgType === 'OPERATEUR' || actor.orgType === 'FINANCEUR') return true;
  const orgFilter =
    actor.orgType === 'CLIENT' ? { organisationId: actor.orgId } : actor.orgType === 'APPORTEUR' ? { apporteurId: actor.orgId } : { contract: { refiEligible: true } };
  const [doc, quote, cdoc, inv, pv] = await Promise.all([
    actor.orgType === 'CLIENT' ? prisma.document.findFirst({ where: { fileId, creditFile: { order: orgFilter } } }) : null,
    actor.orgType !== 'REFINANCEUR' ? prisma.quote.findFirst({ where: { pdfFileId: fileId, order: orgFilter } }) : null,
    prisma.contractDocument.findFirst({ where: { OR: [{ fileId }, { signedFileId: fileId }], contract: { order: orgFilter } } }),
    prisma.invoice.findFirst({ where: { fileId, contract: { order: orgFilter } } }),
    actor.orgType === 'CLIENT' ? prisma.deliveryReceipt.findFirst({ where: { fileId, delivery: { order: orgFilter } } }) : null,
  ]);
  return !!(doc || quote || cdoc || inv || pv);
}
