import { prisma } from '@solink/db';
import { DEVICE_STATUS_LABEL, date, fcfa } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, KV, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ListView } from '@/components/list-view';

export const metadata = { title: 'Parc et contrat' };

/** E24 — parc par site et par collaborateur, état MDM, documents, échéancier. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('client');
  const [devices, contracts] = await Promise.all([
    prisma.device.findMany({ where: { order: { organisationId: actor.orgId } }, include: { product: true, site: true, contract: true, returns: true }, orderBy: { serial: 'asc' } }),
    prisma.contract.findMany({ where: { order: { organisationId: actor.orgId } }, include: { documents: true, installments: { orderBy: { number: 'asc' } }, order: true } }),
  ]);
  const prices = !actor.roles.every((r) => ['CLIENT_RECEPTION', 'CLIENT_EMPLOYE'].includes(r));
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Parc et contrats" description="Équipements propriété de la banque, gérés par SOLINK." />
      {contracts.map((c) => (
        <Card key={c.id}>
          <CardHeader><CardTitle>Contrat {c.ref} <Badge tone={c.status === 'ACTIF' ? 'success' : 'neutral'}>{c.status.replace(/_/g, ' ').toLowerCase()}</Badge></CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <KV rows={[['Début', date(c.startDate)], ['Fin', date(c.endDate)], ...(prices ? ([['Mensualité TTC', fcfa(c.monthlyTtc)], ['Dépôt de garantie', fcfa(c.depositTtc)]] as [string, string][]) : []), ['Renouvellement', c.endDate ? `proposé à J-120 (${date(new Date(c.endDate.getTime() - 120 * 86400000))})` : '—']]} />
            <div className="text-sm">
              <p className="font-medium">Documents</p>
              <ul>{Object.values(Object.fromEntries(c.documents.map((d) => [d.kind, d]))).map((d) => <li key={d.id}>· <a href={`/api/files/${d.signedFileId ?? d.fileId}`} target="_blank">{d.title}</a></li>)}</ul>
              {prices && c.installments.length ? <p className="mt-2">Échéancier : {c.installments.length} échéances de {fcfa(c.installments[0].totalTtc)} (1re le {date(c.installments[0].dueDate)})</p> : null}
            </div>
          </CardContent>
        </Card>
      ))}
      <ListView
        rows={devices}
        rowKey={(d) => d.id}
        basePath="/client/parc"
        searchParams={sp}
        search={(d) => `${d.serial} ${d.product.name} ${d.site?.name ?? ''} ${d.assignedTo ?? ''}`}
        filters={[
          { key: 'site', label: 'Site', options: [...new Map(devices.filter((d) => d.site).map((d) => [d.site!.id, d.site!.name]))].map(([value, label]) => ({ value, label })), match: (d, v) => d.siteId === v },
          { key: 'etat', label: 'État', options: [...new Set(devices.map((d) => d.status))].map((s) => ({ value: s, label: DEVICE_STATUS_LABEL[s] })), match: (d, v) => d.status === v },
        ]}
        columns={[
          { key: 'serie', label: 'N° de série', render: (d) => <span className="font-mono text-xs">{d.serial}</span>, sort: (d) => d.serial },
          { key: 'produit', label: 'Équipement', render: (d) => d.product.name, sort: (d) => d.product.name },
          { key: 'site', label: 'Site', render: (d) => d.site?.name ?? '—', sort: (d) => d.site?.name ?? '' },
          { key: 'collab', label: 'Collaborateur', render: (d) => d.assignedTo ?? '—' },
          { key: 'etat', label: 'État / MDM', render: (d) => <Badge tone={d.status === 'VERROUILLE' ? 'danger' : d.status === 'ACTIF' ? 'success' : 'neutral'} data-device-status={d.status}>{DEVICE_STATUS_LABEL[d.status]}</Badge> },
          { key: 'grade', label: 'Restitution', render: (d) => (d.returns[0] ? `Grade ${d.returns[0].grade}${prices ? ` · ${fcfa(d.returns[0].penalty)}` : ''}` : '—') },
        ]}
        empty={{ title: 'Aucun équipement', description: 'Vos équipements apparaîtront après la réception.' }}
        testId="parc"
      />
    </div>
  );
}
