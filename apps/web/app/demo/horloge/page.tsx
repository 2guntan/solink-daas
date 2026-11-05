import { prisma } from '@solink/db';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Input, KV } from '@solink/ui';
import { getOffsetDays, now, dateTime } from '@solink/core';
import { ActionForm } from '@/components/action-form';
import { jumpClock, resetSimClock, runJobsNow } from '@/app/demo-actions';

export const metadata = { title: 'Horloge simulée' };

export default async function Page() {
  const [offset, at, runs] = await Promise.all([getOffsetDays(prisma), now(prisma), prisma.jobRun.findMany({ where: { name: 'scheduler' }, orderBy: { at: 'desc' }, take: 5 })]);
  return (
    <div>
      <PageHeader title="Horloge simulée" description="Tous les calculs de dates passent par core/clock.ts. Après un saut, les tâches dues (factures, relances, SLA, expirations) s’exécutent immédiatement." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Date simulée</CardTitle></CardHeader>
          <CardContent>
            <KV rows={[["Aujourd’hui (simulé)", <span key="d" data-testid="clock-now">{dateTime(at)}</span>], ['Décalage', <span key="o" data-testid="clock-offset">{offset} jour(s)</span>]]} />
            <ActionForm action={jumpClock} submit="Avancer l’horloge" className="mt-4" testId="clock-jump">
              <label className="text-sm">Nombre de jours<Input name="days" type="number" min={1} max={400} defaultValue={5} aria-label="Nombre de jours" /></label>
            </ActionForm>
            <div className="mt-3 flex gap-2">
              <ActionForm action={resetSimClock} submit="Revenir à la date réelle" variant="outline" />
              <ActionForm action={runJobsNow} submit="Exécuter les tâches maintenant" variant="secondary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dernières exécutions du planificateur</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {runs.map((r) => (
                <li key={r.id} className="rounded bg-slate-50 p-2 font-mono">{dateTime(r.at)} — {JSON.stringify(r.result)}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
