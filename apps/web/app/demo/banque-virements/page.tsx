import Link from 'next/link';
import { prisma } from '@solink/db';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Input, Alert, EmptyState } from '@solink/ui';
import { fcfa, date } from '@solink/core';
import { ActionForm } from '@/components/action-form';
import { collectInvoiceSim, confirmDepositSim, payDisbursementSim } from './actions';

export const metadata = { title: 'Virements banque (simulation)' };

export default async function Page() {
  const [deposits, disb, invoices] = await Promise.all([
    prisma.contract.findMany({ where: { signedAt: { not: null }, depositReceivedAt: null }, include: { order: { include: { organisation: true } } } }),
    prisma.disbursement.findMany({ where: { status: { in: ['DEMANDEE', 'VALIDEE'] } }, include: { contract: true } }),
    prisma.invoice.findMany({ where: { status: { in: ['EMISE', 'PARTIELLE', 'IMPAYEE'] } }, include: { contract: { include: { order: { include: { organisation: true } } } } }, orderBy: { dueDate: 'asc' } }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Virements banque (simulation)" description="Cette page joue le rôle des systèmes de la banque. La plateforme ne détient aucun fonds et n’émet aucun ordre de paiement : elle reçoit uniquement des confirmations." />
      <Alert tone="info">Relevé de cantonnement : <Link href="/api/export/cantonnement">télécharger le CSV</Link></Alert>
      <Card data-testid="sim-deposits">
        <CardHeader><CardTitle>1. Dépôts de garantie attendus</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {deposits.length === 0 ? <EmptyState title="Aucun dépôt en attente" /> : null}
          {deposits.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{c.order.organisation.name} — {c.ref} — <strong>{fcfa(c.depositTtc)}</strong> — réf. {c.depositReference}</span>
              <ActionForm action={confirmDepositSim} hidden={{ contractId: c.id }} submit="Confirmer la réception du dépôt" size="sm" testId={`depot-${c.ref}`} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card data-testid="sim-disbursements">
        <CardHeader><CardTitle>2. Paiement de SOLINK (décaissements)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {disb.length === 0 ? <EmptyState title="Aucun décaissement en attente" /> : null}
          {disb.map((d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{d.ref} — contrat {d.contract.ref} — <strong>{fcfa(d.amount)}</strong> — {d.status}</span>
              <ActionForm action={payDisbursementSim} hidden={{ id: d.id }} submit="Confirmer le virement à SOLINK" size="sm" testId={`payer-${d.ref}`} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card data-testid="sim-invoices">
        <CardHeader><CardTitle>3. Encaissements clients (factures Orange)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {invoices.length === 0 ? <EmptyState title="Aucune facture à encaisser" /> : null}
          {invoices.map((i) => (
            <div key={i.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm">{i.contract.order.organisation.name} — {i.ref} — échéance {date(i.dueDate)} — reste <strong>{fcfa(i.totalTtc - i.paidAmount)}</strong> — {i.status}</span>
              <ActionForm action={collectInvoiceSim} hidden={{ invoiceId: i.id }} submit="Encaisser" size="sm" inline testId={`encaisser-${i.ref}`}>
                <Input name="amount" defaultValue={i.totalTtc - i.paidAmount} aria-label="Montant encaissé" className="w-40" />
              </ActionForm>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
