import { Badge, cn } from '@solink/ui';
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
    <Badge tone={TONE[status] ?? 'neutral'} data-status={status} className={internal ? 'font-mono text-[10px] tracking-wide' : undefined}>
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

/** Frise de statut de la commande (9 étapes, v4 §4.1) : points reliés par un filet, étape courante en encre. */
export function Timeline({ status, transitions, compact }: { status: OrderStatus; transitions?: { to: string; at: Date }[]; compact?: boolean }) {
  const step = STATUS_INFO[status].step;
  const terminal = step === 0;
  const last = transitions?.length ? transitions[transitions.length - 1].at : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <ol className={cn('grid min-w-[640px]', compact ? 'gap-0' : 'gap-0')} style={{ gridTemplateColumns: `repeat(${TIMELINE_STEPS.length}, minmax(0, 1fr))` }} aria-label="Frise de statut">
          {TIMELINE_STEPS.map((label, i) => {
            const n = i + 1;
            const done = !terminal && n < step;
            const cur = !terminal && n === step;
            return (
              <li key={label} className="relative flex flex-col items-center gap-2 text-center" aria-current={cur ? 'step' : undefined}>
                {i > 0 ? <span aria-hidden className={cn('absolute left-0 right-1/2 top-[7px] h-px', done || cur ? 'bg-neutral-900' : 'bg-neutral-200')} /> : null}
                {i < TIMELINE_STEPS.length - 1 ? <span aria-hidden className={cn('absolute left-1/2 right-0 top-[7px] h-px', done ? 'bg-neutral-900' : 'bg-neutral-200')} /> : null}
                <span
                  aria-hidden
                  className={cn(
                    'relative z-10 flex h-[15px] w-[15px] items-center justify-center rounded-full border transition-colors',
                    done && 'border-neutral-900 bg-neutral-900 text-white',
                    cur && 'border-neutral-900 bg-white ring-4 ring-neutral-900/10',
                    !done && !cur && 'border-neutral-300 bg-white',
                  )}
                >
                  {done ? (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1.5 5.5 4 8l4.5-6" />
                    </svg>
                  ) : cur ? (
                    <span className="h-[7px] w-[7px] rounded-full bg-neutral-900" />
                  ) : null}
                </span>
                <span className={cn('px-1 text-[11px] leading-tight', cur ? 'font-semibold text-neutral-900' : done ? 'text-neutral-700' : 'text-neutral-400')}>
                  <span className="sr-only">{n}. </span>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {terminal || last ? (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
          {terminal ? <Badge tone="danger">{STATUS_INFO[status].label}</Badge> : null}
          {last ? <span>Dernière mise à jour : {dateTime(last)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
