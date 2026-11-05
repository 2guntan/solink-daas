/** Enveloppe de financement (v4 §7.5) : réservation à l'accord, consommation à la signature, libération à l'annulation. */
export interface EnvelopeState {
  total: number;
  reserved: number;
  consumed: number;
  endDate: Date;
  alertPcts: number[];
  active: boolean;
}

export const available = (e: Pick<EnvelopeState, 'total' | 'reserved' | 'consumed'>) => e.total - e.reserved - e.consumed;

export const remainingPct = (e: Pick<EnvelopeState, 'total' | 'reserved' | 'consumed'>) =>
  e.total > 0 ? (available(e) / e.total) * 100 : 0;

export function isUsable(e: EnvelopeState, today: Date) {
  return e.active && e.endDate.getTime() > today.getTime();
}

/** Seuils d'alerte franchis (ex. [20, 10] % restants). */
export function alertsTriggered(e: EnvelopeState): number[] {
  const r = remainingPct(e);
  return e.alertPcts.filter((p) => r <= p);
}

/** Nouveaux seuils franchis par une opération (pour notifier une seule fois). */
export function newlyCrossed(before: EnvelopeState, after: EnvelopeState): number[] {
  const b = new Set(alertsTriggered(before));
  return alertsTriggered(after).filter((p) => !b.has(p));
}

export function reserve(e: EnvelopeState, amount: number): EnvelopeState {
  return { ...e, reserved: e.reserved + amount };
}
export function consume(e: EnvelopeState, amount: number): EnvelopeState {
  return { ...e, reserved: Math.max(0, e.reserved - amount), consumed: e.consumed + amount };
}
export function release(e: EnvelopeState, amount: number): EnvelopeState {
  return { ...e, reserved: Math.max(0, e.reserved - amount) };
}
