import type { Tx } from '@solink/db';

/**
 * Horloge simulée (CLAUDE.md §7) : tous les calculs de dates passent par ici.
 * now = horloge réelle + offsetDays (table SimClock).
 */
export const DAY_MS = 86_400_000;

export async function getOffsetDays(db: Tx): Promise<number> {
  const c = await db.simClock.findUnique({ where: { id: 1 } });
  return c?.offsetDays ?? 0;
}

export async function now(db: Tx): Promise<Date> {
  const offset = await getOffsetDays(db);
  return new Date(Date.now() + offset * DAY_MS);
}

export async function advanceClock(db: Tx, days: number): Promise<number> {
  const c = await db.simClock.upsert({
    where: { id: 1 },
    update: { offsetDays: { increment: days } },
    create: { id: 1, offsetDays: days },
  });
  return c.offsetDays;
}

export async function resetClock(db: Tx): Promise<void> {
  await db.simClock.upsert({ where: { id: 1 }, update: { offsetDays: 0 }, create: { id: 1, offsetDays: 0 } });
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Dakar = UTC+0 toute l'année : on travaille en UTC. */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function firstOfNextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** Jours ouvrés (lun-ven) ajoutés. */
export function addBusinessDays(d: Date, n: number): Date {
  let r = new Date(d);
  let added = 0;
  while (added < n) {
    r = addDays(r, 1);
    const wd = r.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return r;
}

export function periodOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
