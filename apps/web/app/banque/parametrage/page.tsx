import { prisma } from '@solink/db';
import { CHECKLIST_VERSION, PARAM_LABELS, PARAM_OWNERS, SCORING_RULESET_VERSION, SEGMENT_LABEL, checklistFor, date, fcfa, getParams, type ParamKey } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, DemoBadge, Field, Input, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { bankParamAction, importSftpAction, publishGridAction, updateEnvelopeAction } from '../actions';
import type { Segment } from '@solink/db';

export const metadata = { title: 'Paramétrage' };

/** F09 — enveloppes, liste blanche, grilles de coefficients versionnées, règles de scoring, checklist. */
export default async function Page() {
  const actor = await requireActor('banque');
  const [env, grids, clients, params] = await Promise.all([
    prisma.envelope.findFirst({ where: { financerId: actor.orgId }, orderBy: { endDate: 'desc' } }),
    prisma.coefficientGrid.findMany({ where: { financerId: actor.orgId }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.organisation.findMany({ where: { type: 'CLIENT' }, orderBy: { name: 'asc' } }),
    getParams(prisma),
  ]);
  const bankKeys = (Object.keys(PARAM_OWNERS) as ParamKey[]).filter((k) => PARAM_OWNERS[k] === 'BANQUE' && k !== 'coefficients');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Paramétrage financeur (F09)" description={<>Toutes les valeurs sont fictives <DemoBadge /></>} />
      {env ? (
        <Card>
          <CardHeader><CardTitle>Enveloppe et liste blanche</CardTitle></CardHeader>
          <CardContent>
            <ActionForm action={updateEnvelopeAction} hidden={{ envelopeId: env.id }} submit="Enregistrer l’enveloppe">
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Montant total (FCFA)"><Input name="total" defaultValue={env.total} inputMode="numeric" /></Field>
                <Field label="Plafond par client"><Input name="perClientCap" defaultValue={env.perClientCap} inputMode="numeric" /></Field>
                <Field label="Date de fin"><Input type="date" name="endDate" defaultValue={env.endDate.toISOString().slice(0, 10)} /></Field>
              </div>
              <p className="text-xs text-slate-500">Alertes à {env.alertPcts.join(' % et ')} % restants · consommé {fcfa(env.consumed)} · réservé {fcfa(env.reserved)}</p>
              <fieldset className="grid gap-1 sm:grid-cols-2"><legend className="text-sm font-medium">Liste blanche (clients pré-agréés)</legend>{clients.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="whitelist" value={c.id} defaultChecked={env.whitelist.includes(c.id)} /> {c.name}</label>)}</fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={env.active} /> Enveloppe active</label>
            </ActionForm>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Grille de coefficients (% mensuel de la base financée)</CardTitle></CardHeader>
        <CardContent>
          <ActionForm action={publishGridAction} submit="Publier une nouvelle version" className="sm:flex-row sm:items-end" confirm="Publier cette grille ? Elle s’appliquera aux nouveaux devis.">
            <Field label="24 mois"><Input name="c24" defaultValue={params.coefficients['24']} /></Field>
            <Field label="36 mois"><Input name="c36" defaultValue={params.coefficients['36']} /></Field>
          </ActionForm>
          <ul className="mt-3 text-xs">{grids.map((g) => <li key={g.id}>{g.version} · {g.durationMonths} mois · {g.coefficient.toString()} % · VR {g.residualPct} % · du {date(g.effectiveFrom)} {g.effectiveTo ? `au ${date(g.effectiveTo)}` : '(en vigueur)'}</li>)}</ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Règles de scoring et d’accord automatique ({SCORING_RULESET_VERSION})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm">Grille 100 pts : ancienneté 15 · taille CA 15 · rentabilité 20 · endettement 15 · couverture du loyer 20 · BIC 10 · historique Orange 5. Accord auto = liste blanche ET score ≥ seuil ET montant ≤ plafond ET aucun knock-out.</p>
          {bankKeys.map((k) => (
            <ActionForm key={k} action={bankParamAction} hidden={{ key: k }} submit="Versionner" size="sm" variant="secondary" className="sm:flex-row sm:items-center">
              <span className="text-sm sm:w-80">{PARAM_LABELS[k]}</span>
              <Input name="value" defaultValue={JSON.stringify(params[k])} className="font-mono text-xs" aria-label={PARAM_LABELS[k]} />
            </ActionForm>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Checklists par segment (versionnées, figées à la soumission)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {(Object.keys(SEGMENT_LABEL) as Segment[]).map((s) => <div key={s} className="text-xs"><p className="font-medium">{SEGMENT_LABEL[s]} <Badge>{CHECKLIST_VERSION(s)}</Badge></p><ul>{checklistFor(s).map((i) => <li key={i.type}>· {i.label}</li>)}</ul></div>)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Canal SFTP (simulé)</CardTitle></CardHeader>
        <CardContent className="text-sm">
          <p>Les DFS scellés sont déposés dans <code>./storage/sftp/out/</code>. Déposez vos décisions dans <code>./storage/sftp/in/*.csv</code> (en-tête : <code>financing_request;result;amount_xof;duration_months;valid_until;internal_reason</code>).</p>
          <ActionForm action={importSftpAction} submit="Importer les décisions SFTP" variant="secondary" size="sm" className="mt-2" />
        </CardContent>
      </Card>
    </div>
  );
}
