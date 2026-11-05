import { STATUS_INFO } from '@solink/core';
import { Badge } from '@solink/ui';
import type { OrderStatus } from '@solink/db';

/** Compteur SLA visible de tous (v4 §8.6). */
export function Sla({ status, since, now }: { status: OrderStatus; since: Date; now: Date }) {
  const h = STATUS_INFO[status].slaHours;
  if (!h) return <span className="text-xs text-slate-400">—</span>;
  const left = h - (now.getTime() - since.getTime()) / 3_600_000;
  const label = left >= 0 ? `${left >= 48 ? `${Math.floor(left / 24)} j` : `${Math.max(0, Math.round(left))} h`} restant(es)` : `dépassé de ${-left >= 48 ? `${Math.floor(-left / 24)} j` : `${Math.round(-left)} h`}`;
  return <Badge tone={left < 0 ? 'danger' : left < h * 0.25 ? 'warning' : 'neutral'}>{label}</Badge>;
}
