import { prisma } from '@solink/db';
import { svc, fcfa } from '@solink/core';
import { currentActor } from '@/lib/session';

/** Exports CSV : facturation Orange (O04/B11), relevé de cantonnement, portefeuille refinanceur. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const actor = await currentActor();
  if (!actor) return new Response('Non authentifié', { status: 401 });
  const period = new URL(req.url).searchParams.get('periode') ?? undefined;
  let csv = '';
  let name = `${kind}.csv`;
  if (kind === 'orange') {
    if (!['APPORTEUR', 'OPERATEUR', 'FINANCEUR'].includes(actor.orgType)) return new Response('Accès refusé', { status: 403 });
    csv = await svc.run(actor, (ctx) => svc.orangeExportCsv(ctx, period));
    name = `facturation_orange_${period ?? 'toutes'}.csv`;
  } else if (kind === 'cantonnement') {
    const bank = await prisma.organisation.findFirstOrThrow({ where: { type: 'FINANCEUR' } });
    csv = await svc.run(actor, (ctx) => svc.cantonmentStatementCsv(ctx, bank.id));
    name = 'releve_cantonnement.csv';
  } else if (kind === 'refinanceur' || kind === 'portefeuille') {
    if (!['REFINANCEUR', 'FINANCEUR', 'OPERATEUR'].includes(actor.orgType)) return new Response('Accès refusé', { status: 403 });
    const contracts = await prisma.contract.findMany({ where: { ...(kind === 'refinanceur' ? { refiEligible: true } : {}), status: { in: ['ACTIF', 'SIGNE', 'FIN_DE_CONTRAT'] } }, include: { order: { include: { organisation: true } }, invoices: true } });
    csv = [
      'ref_contrat;segment;secteur;montant_finance_xof;mensualite_ttc_xof;duree_mois;date_debut;encours_impaye_xof;eligible_refi',
      ...contracts.map((c) => [c.ref, c.order.organisation.segment, c.order.organisation.sector, c.financedAmount, c.monthlyTtc, c.durationMonths, c.startDate?.toISOString().slice(0, 10) ?? '', c.invoices.filter((i) => i.status !== 'PAYEE' && i.dueDate < new Date()).reduce((a, i) => a + i.totalTtc - i.paidAmount, 0), c.refiEligible ? 'OUI' : 'NON'].join(';')),
    ].join('\n');
    name = `portefeuille_${kind}.csv`;
  } else return new Response('Export inconnu', { status: 404 });
  void fcfa;
  return new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"` } });
}
