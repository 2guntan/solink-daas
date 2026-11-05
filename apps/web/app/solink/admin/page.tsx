import { prisma } from '@solink/db';
import { PARAM_LABELS, PARAM_OWNERS, ROLE_LABEL, TEMPLATES_INFO, dateTime, getParams, verifyAuditChain, type ParamKey } from '@/lib/admin-data';
import { Badge, Card, CardContent, CardHeader, CardTitle, DemoBadge, Input, PageHeader } from '@solink/ui';
import { requireActor } from '@/lib/session';
import { ActionForm } from '@/components/action-form';
import { ListView } from '@/components/list-view';
import { updateParamAction } from '../actions';

export const metadata = { title: 'Administration' };

/** B12 — utilisateurs, paramètres versionnés, modèles de notification, journal d'audit. */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const actor = await requireActor('solink');
  const [users, params, events, chain, history] = await Promise.all([
    prisma.user.findMany({ include: { memberships: { include: { organisation: true } } }, orderBy: { email: 'asc' } }),
    getParams(prisma),
    prisma.auditEvent.findMany({ orderBy: { seq: 'desc' }, take: 200 }),
    verifyAuditChain(prisma),
    prisma.parameter.findMany({ where: { version: { gt: 1 } }, orderBy: { effectiveFrom: 'desc' }, take: 10 }),
  ]);
  const isAdmin = actor.roles.includes('SOLINK_ADMIN');
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Administration" />
      <Card>
        <CardHeader><CardTitle>Paramètres (versionnés) <DemoBadge /></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(Object.keys(PARAM_LABELS) as ParamKey[]).map((k) => (
            <div key={k} className="flex flex-col gap-1 border-b pb-2 text-sm md:flex-row md:items-center md:justify-between">
              <span>{PARAM_LABELS[k]} <Badge>{PARAM_OWNERS[k] === 'BANQUE' ? 'propriétaire : banque' : 'propriétaire : SOLINK'}</Badge></span>
              {PARAM_OWNERS[k] === 'SOLINK' && isAdmin ? (
                <ActionForm action={updateParamAction} hidden={{ key: k }} submit="Versionner" size="sm" variant="secondary" inline><Input name="value" defaultValue={JSON.stringify(params[k])} className="h-8 font-mono text-xs md:w-96" aria-label={PARAM_LABELS[k]} /></ActionForm>
              ) : (
                <code className="text-xs">{JSON.stringify(params[k])}</code>
              )}
            </div>
          ))}
          {history.length ? <p className="text-xs text-slate-500">Dernières modifications : {history.map((h) => `${h.key} v${h.version} (${dateTime(h.effectiveFrom)})`).join(' · ')}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Utilisateurs ({users.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table><tbody>{users.map((u) => <tr key={u.id} className="border-t"><td className="p-1 text-xs">{u.email}</td><td className="p-1 text-xs">{u.firstName} {u.lastName}</td><td className="p-1 text-xs">{u.memberships.map((m) => `${m.organisation.name} : ${m.roles.map((r) => ROLE_LABEL[r]).join(', ')}`).join(' | ')}</td></tr>)}</tbody></table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Modèles de notification pré-approuvés ({TEMPLATES_INFO.length})</CardTitle></CardHeader>
        <CardContent><ul className="grid gap-1 text-xs md:grid-cols-2">{TEMPLATES_INFO.map(([k, v]) => <li key={k}><code>{k}</code> — {v}</li>)}</ul></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Journal d’audit chaîné {chain.ok ? <Badge tone="success">intègre ({chain.count})</Badge> : <Badge tone="danger">rompu</Badge>}</CardTitle></CardHeader>
        <CardContent>
          <ListView rows={events} rowKey={(e) => e.id} basePath="/solink/admin" searchParams={sp} search={(e) => `${e.entity} ${e.action} ${e.actorId}`} pageSize={15}
            columns={[
              { key: 'seq', label: '#', render: (e) => e.seq, sort: (e) => e.seq },
              { key: 'at', label: 'Date', render: (e) => dateTime(e.at) },
              { key: 'entity', label: 'Entité', render: (e) => e.entity },
              { key: 'action', label: 'Action', render: (e) => <span className="font-mono text-xs">{e.action}</span> },
              { key: 'acteur', label: 'Acteur', render: (e) => <span className="text-xs">{e.actorId}</span> },
              { key: 'hash', label: 'Hash', render: (e) => <span className="font-mono text-xs">{e.hash.slice(0, 12)}…</span> },
            ]} />
        </CardContent>
      </Card>
    </div>
  );
}
