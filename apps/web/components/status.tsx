import { Badge } from '@solink/ui';
import { STATUS_INFO, TIMELINE_STEPS, DOC_STATUS_LABEL, dateTime } from '@solink/core';
import type { OrderStatus } from '@solink/db';

const TONE: Partial<Record<OrderStatus, 'success' | 'warning' | 'danger' | 'info' | 'primary'>> = {
  ACTIF: 'success',
  ACCORDE: 'success',
  PRET_POUR_ACHAT: 'success',
  REFUSE: 'danger',
  ANNULE: 'danger',
  EXPIRE: 'danger',
  ECHEC: 'danger',
  DOSSIER_A_REPRENDRE: 'warning',
  PIECES_COMPLEMENTAIRES: 'warning',
  ACCORDE_SOUS_CONDITIONS: 'warning',
  EN_ANALYSE: 'info',
  TRANSMIS_FINANCEUR: 'info',
  SIGNATURE_CLIENT: 'primary',
  CONTRESIGNATURE: 'primary',
};

export function OrderStatusBadge({ status, internal }: { status: OrderStatus; internal?: boolean }) {
  return (
    <Badge tone={TONE[status] ?? 'neutral'} data-status={status}>
      {internal ? status.replace(/_/g, ' ') : STATUS_INFO[status].label}
    </Badge>
  );
}

const DOC_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  A_FOURNIR: 'neutral',
  EN_VERIFICATION: 'info',
  VALIDEE: 'success',
  A_REPRENDRE: 'danger',
  EXPIREE: 'warning',
  NON_APPLICABLE: 'neutral',
};
export function DocStatusBadge({ status }: { status: string }) {
  return <Badge tone={DOC_TONE[status]} data-doc-status={status}>{DOC_STATUS_LABEL[status]}</Badge>;
}

/** Frise de statut de la commande (9 étapes, v4 §4.1). */
export function Timeline({ status, transitions }: { status: OrderStatus; transitions?: { to: string; at: Date }[] }) {
  const step = STATUS_INFO[status].step;
  const terminal = step === 0;
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2 text-xs" aria-label="Frise de statut">
      {TIMELINE_STEPS.map((label, i) => {
        const n = i + 1;
        const done = !terminal && n < step;
        const cur = !terminal && n === step;
        return (
          <li key={label} className={`flex items-center gap-1 rounded-full px-2 py-1 ${done ? 'bg-emerald-50 text-emerald-700' : cur ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`} aria-current={cur ? 'step' : undefined}>
            <span className="font-semibold">{n}</span> {label}
          </li>
        );
      })}
      {terminal ? <li className="rounded-full bg-red-50 px-2 py-1 text-red-700">{STATUS_INFO[status].label}</li> : null}
      {transitions?.length ? <li className="w-full text-slate-400">Dernière mise à jour : {dateTime(transitions[transitions.length - 1].at)}</li> : null}
    </ol>
  );
}
