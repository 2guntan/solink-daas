import { prisma } from '@solink/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Field, Input, PageHeader, Textarea } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { importSitesAction, upsertSiteAction } from '../actions';

export const metadata = { title: 'Sites de livraison' };

export default async function Page() {
  const actor = await requireActor('client');
  const sites = await prisma.site.findMany({ where: { organisationId: actor.orgId }, orderBy: { name: 'asc' } });
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sites de livraison" />
      {sites.length === 0 ? <EmptyState title="Aucun site" /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {sites.map((s) => (
          <Card key={s.id} className="p-4 text-sm">
            <p className="font-medium">{s.name}</p>
            <p>{s.address} · {s.landmark}</p>
            <p className="text-slate-500">Réceptionnaire : {s.contactName} · {s.contactPhone} · {s.hours}</p>
            {s.lat ? <p className="text-xs text-slate-400">Géolocalisation : {s.lat}, {s.lng}</p> : null}
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Ajouter un site</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={upsertSiteAction} submit="Ajouter">
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Nom"><Input name="name" required /></Field>
              <Field label="Adresse"><Input name="address" required /></Field>
              <Field label="Repère"><Input name="landmark" /></Field>
              <Field label="Réceptionnaire"><Input name="contactName" /></Field>
              <Field label="Téléphone"><Input name="contactPhone" /></Field>
              <Field label="Email"><Input name="contactEmail" type="email" /></Field>
              <Field label="Horaires"><Input name="hours" /></Field>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Import CSV (plus de 10 sites)</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={importSitesAction} submit="Importer">
            <input type="file" name="file" accept=".csv,text/csv" aria-label="Fichier CSV" />
            <Textarea name="csv" placeholder={'nom;adresse;repère;contact;téléphone;email;horaires\nAgence X;Rue fictive;…'} aria-label="CSV" />
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
