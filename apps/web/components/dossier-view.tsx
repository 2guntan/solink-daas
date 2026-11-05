import { prisma } from '@solink/db';
import { CONDITION_LABEL, DOC_STATUS_LABEL, date, dateTime, fcfa, type DossierBlocks } from '@solink/core';
import { Badge, Card, CardContent, CardHeader, CardTitle, KV } from '@solink/ui';
import { DocStatusBadge } from './status';

/** Vue partagée SOLINK / Financeur : blocs, score, DFS (versions + différentiel), décisions, journal. */
export async function DossierView({ orderId, renderDocActions }: { orderId: string; renderDocActions?: (doc: { id: string; status: string; fileId: string | null }) => React.ReactNode }) {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      organisation: true,
      transitions: { orderBy: { at: 'asc' } },
      creditFile: { include: { documents: { orderBy: [{ origin: 'asc' }, { label: 'asc' }] }, packages: { orderBy: { version: 'desc' } }, decisions: { orderBy: { at: 'desc' }, include: { conditions: true } } } },
    },
  });
  const cf = o.creditFile;
  if (!cf) return null;
  const b = (cf.blocks ?? {}) as DossierBlocks;
  const factors = (cf.factors ?? []) as { label: string; points: number; max: number; detail: string }[];
  const knockouts = (cf.knockouts ?? []) as string[];
  const years = b.finances?.years ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bloc 1 — Entreprise</CardTitle></CardHeader>
          <CardContent><KV rows={[['Raison sociale', b.entreprise?.name ?? o.organisation.name], ['NINEA / RCCM', `${b.entreprise?.ninea ?? '—'} / ${b.entreprise?.rccm || '—'}`], ['Segment / secteur', `${o.organisation.segment ?? '—'} / ${o.organisation.sector ?? '—'}`], ['Création', b.entreprise?.createdOn ?? '—'], ['Effectif', String(b.entreprise?.employees ?? '—')], ['Activité', b.entreprise?.activity ?? '—']]} /></CardContent>
        </Card>
        <Card data-testid="score">
          <CardHeader><CardTitle>Score (grille du financeur) : {cf.score ?? '—'}/100 · classe {cf.riskClass ?? '—'} · voie {cf.route ?? '—'}</CardTitle></CardHeader>
          <CardContent>
            {knockouts.length ? <p className="mb-2 text-sm text-red-700">Knock-outs : {knockouts.join(' ; ')}</p> : null}
            <ul className="text-sm">{factors.map((f) => <li key={f.label} className="flex justify-between border-b py-1"><span>{f.label} <span className="text-xs text-slate-400">({f.detail})</span></span><strong>{f.points}/{f.max}</strong></li>)}</ul>
            {!factors.length ? <p className="text-sm text-slate-500">Calculé à la transmission.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bloc 2 — Dirigeants & bénéficiaires effectifs</CardTitle></CardHeader>
          <CardContent><ul className="text-sm">{(b.dirigeants?.persons ?? []).map((p, i) => <li key={i}>· {p.type.replace(/_/g, ' ').toLowerCase()} : {p.firstName} {p.lastName} {p.role ? `(${p.role})` : ''} {p.ownershipPct ? `— ${p.ownershipPct} %` : ''} {p.ppe ? <Badge tone="warning">PPE</Badge> : null}</li>)}</ul></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Bloc 3 — Finances</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table><thead><tr><th className="p-1">Ex.</th><th className="p-1">CA</th><th className="p-1">REX</th><th className="p-1">RN</th><th className="p-1">CP</th><th className="p-1">Dettes</th></tr></thead>
              <tbody>{years.map((y) => <tr key={y.year} className="border-t text-xs"><td className="p-1">{y.year}</td><td className="p-1">{fcfa(y.ca)}</td><td className="p-1">{fcfa(y.rex)}</td><td className="p-1">{fcfa(y.rn)}</td><td className="p-1">{fcfa(y.cp)}</td><td className="p-1">{fcfa(y.dettes)}</td></tr>)}</tbody>
            </table>
            {b.finances?.commitments ? <p className="mt-2 text-xs">Engagements : {b.finances.commitments}</p> : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Bloc 4 — Pièces justificatives (checklist {cf.checklistVersion})</CardTitle></CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y" data-testid="pieces">
            {cf.documents.map((d) => {
              const ex = (d.extraction ?? null) as { fields?: { label: string; value: string }[] } | null;
              return (
                <li key={d.id} className="flex flex-col gap-2 py-2 md:flex-row md:items-start md:justify-between" data-testid={`piece-${d.type}`}>
                  <div className="text-sm">
                    <p className="font-medium">{d.label} {d.origin === 'DEMANDE_BANQUE' ? <Badge tone="warning">demande banque</Badge> : null}</p>
                    <p className="text-xs text-slate-500"><DocStatusBadge status={d.status} /> v{d.version} {d.docDate ? `· daté du ${date(d.docDate)}` : ''} {d.rejectReason ? `· motif : ${d.rejectReason}` : ''}</p>
                    {d.fileId ? <a href={`/api/files/${d.fileId}`} target="_blank" className="text-xs">Ouvrir la pièce</a> : null}
                    {ex?.fields?.length ? <p className="text-xs text-slate-500">Extrait : {ex.fields.map((f) => `${f.label} = ${f.value}`).join(' · ')}</p> : null}
                  </div>
                  {renderDocActions ? <div>{renderDocActions(d)}</div> : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <Card data-testid="dfs">
        <CardHeader><CardTitle>Dossier de Financement Standardisé — versions</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {cf.packages.length === 0 ? <p className="text-slate-500">Aucun DFS transmis.</p> : null}
          {cf.packages.map((p) => {
            const diff = p.diff as { added: string[]; removed: string[]; modified: string[] } | null;
            return (
              <div key={p.id} className="rounded border p-2">
                <p><strong>{p.packageId}</strong> · transmis {dateTime(p.transmittedAt)} · {p.channel} {p.acknowledgedAt ? <Badge tone="success">accusé {dateTime(p.acknowledgedAt)}</Badge> : null} · <a href={`/api/dfs/${p.id}`}>télécharger le zip</a></p>
                <p className="break-all font-mono text-xs text-slate-500">manifest sha256 {p.manifestSha256}{p.previousSha256 ? ` · précédent ${p.previousSha256.slice(0, 16)}…` : ''}</p>
                {diff ? (
                  <div className="mt-1 text-xs" data-testid="dfs-diff">
                    <p className="font-medium">Différences avec la version précédente :</p>
                    {diff.added.map((x) => <p key={x} className="text-emerald-700">+ ajouté : {x}</p>)}
                    {diff.removed.map((x) => <p key={x} className="text-red-700">− retiré : {x}</p>)}
                    {diff.modified.map((x) => <p key={x} className="text-amber-700">~ modifié : {x}</p>)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
      {cf.decisions.length ? (
        <Card>
          <CardHeader><CardTitle>Décisions</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {cf.decisions.map((d) => (
              <div key={d.id} className="border-b py-2">
                <p><Badge tone={d.result === 'REFUSE' ? 'danger' : 'success'}>{d.result}</Badge> {dateTime(d.at)} · {d.automatic ? `accord automatique — règle ${d.ruleVersion}` : `délégation ${d.delegationLevel}`} · montant {fcfa(d.amount)} · coef {d.coefficient} · valable jusqu’au {date(d.validUntil)}</p>
                {d.conditions.map((c) => <p key={c.id} className="text-xs">· {CONDITION_LABEL[c.type]} ({c.nature === 'PREALABLE' ? 'préalable' : 'suspensive'}) : {c.label} — {c.status === 'LEVEE' ? 'levée' : 'à lever'}</p>)}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Journal des transitions (chaîné)</CardTitle></CardHeader>
        <CardContent>
          <ol className="text-xs" data-testid="journal">{o.transitions.map((t) => <li key={t.id} className="border-b py-1">{dateTime(t.at)} · {t.from ?? '∅'} → <strong>{t.to}</strong> · {t.reason} · <span className="font-mono text-slate-400">{t.hash.slice(0, 12)}</span></li>)}</ol>
          <p className="mt-1 text-xs text-slate-400">Statuts pièces : {Object.values(DOC_STATUS_LABEL).join(' · ')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
