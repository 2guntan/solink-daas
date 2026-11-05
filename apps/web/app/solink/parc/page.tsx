import { prisma } from '@solink/db';
import { DEVICE_STATUS_LABEL, dateTime, fcfa, svc } from '@solink/core';
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader, Select } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { executeLockAction, gradeAction } from '../actions';

export const metadata = { title: 'Parc & MDM' };

/** B09 — parc, MDM (verrouillage exécuté seulement sur ordre banque), restitution A–E. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('solink');
  const [devices, locks, ending] = await Promise.all([
    prisma.device.findMany({ include: { product: true, site: true, contract: true, owner: true, order: { include: { organisation: true } } }, orderBy: { serial: 'asc' } }),
    prisma.lockOrder.findMany({ where: { status: { in: ['PROPOSE', 'ORDONNE', 'EXECUTE'] } }, include: { contract: { include: { order: { include: { organisation: true } } } } } }),
    prisma.contract.findMany({ where: { status: { in: ['FIN_DE_CONTRAT'] } }, include: { devices: { include: { product: true } }, order: { include: { organisation: true } } } }),
  ]);
  const summaries = await Promise.all(ending.map((c) => svc.run(actor, (ctx) => svc.returnSummary(ctx, c.id))));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Parc et MDM" />
      <Card data-testid="ordres-verrouillage">
        <CardHeader><CardTitle>Ordres de verrouillage</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {locks.length === 0 ? <p className="text-sm text-slate-500">Aucun ordre en cours.</p> : null}
          {locks.map((l) => (
            <div key={l.id} className="flex flex-col gap-2 rounded border p-3 text-sm md:flex-row md:items-center md:justify-between">
              <span>{l.contract.order.organisation.name} — {l.contract.ref} — {l.reason} — <Badge tone={l.status === 'ORDONNE' ? 'danger' : 'warning'}>{l.status === 'PROPOSE' ? 'proposé à la banque (attente décision)' : l.status === 'ORDONNE' ? `ordonné par la banque ${dateTime(l.orderedAt)}` : `exécuté ${dateTime(l.executedAt)}`}</Badge></span>
              {l.status === 'ORDONNE' ? <ActionForm action={executeLockAction} hidden={{ lockOrderId: l.id }} submit="Exécuter le verrouillage MDM" variant="destructive" size="sm" confirm="Verrouiller tous les équipements actifs du contrat (ordre banque reçu) ?" reason="Référence de l’ordre / commentaire" testId="executer-verrouillage" /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
      {ending.map((c, i) => (
        <Card key={c.id}>
          <CardHeader><CardTitle>Restitution — {c.order.organisation.name} — {c.ref}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Alert tone="info">Pénalités {fcfa(summaries[i].penalties)} · dépôt {fcfa(summaries[i].deposit)} · solde {summaries[i].balance > 0 ? `à facturer ${fcfa(summaries[i].balance)}` : `à restituer ${fcfa(-summaries[i].balance)}`}</Alert>
            {c.devices.filter((d) => !['GRADE', 'RETOURNE'].includes(d.status)).map((d) => (
              <ActionForm key={d.id} action={gradeAction} hidden={{ deviceId: d.id }} submit="Enregistrer le grade" size="sm" className="sm:flex-row sm:items-center">
                <span className="text-sm">{d.serial} — {d.product.name}</span>
                <Select name="grade" aria-label="Grade" className="w-48"><option value="A">A — comme neuf (0 %)</option><option value="B">B — usure légère (5 %)</option><option value="C">C — usure marquée (15 %)</option><option value="D">D — endommagé (40 %)</option><option value="E">E — hors d’usage (100 %)</option></Select>
              </ActionForm>
            ))}
          </CardContent>
        </Card>
      ))}
      <ListView rows={devices} rowKey={(d) => d.id} basePath="/solink/parc" searchParams={await searchParams} search={(d) => `${d.serial} ${d.product.name} ${d.order?.organisation.name ?? ''}`}
        filters={[{ key: 'etat', label: 'État', options: Object.entries(DEVICE_STATUS_LABEL).map(([value, label]) => ({ value, label })), match: (d, v) => d.status === v }]}
        columns={[
          { key: 'serie', label: 'Série', render: (d) => <span className="font-mono text-xs">{d.serial}</span>, sort: (d) => d.serial },
          { key: 'client', label: 'Client', render: (d) => d.order?.organisation.name ?? '—', sort: (d) => d.order?.organisation.name ?? '' },
          { key: 'produit', label: 'Produit', render: (d) => d.product.name },
          { key: 'proprio', label: 'Propriétaire', render: (d) => d.owner?.name ?? '—' },
          { key: 'mdm', label: 'MDM', render: (d) => <span className="font-mono text-xs">{d.mdmId ?? '—'}</span> },
          { key: 'autopilot', label: 'Autopilot', render: (d) => (d.autopilotHash ? '✓' : '—') },
          { key: 'etat', label: 'État', render: (d) => <Badge tone={d.status === 'VERROUILLE' ? 'danger' : 'neutral'}>{DEVICE_STATUS_LABEL[d.status]}</Badge> },
        ]} pageSize={15} />
    </div>
  );
}
