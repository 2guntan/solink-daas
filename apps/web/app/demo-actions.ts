'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@solink/db';
import { advanceClock, portalFor, resetClock, svc } from '@solink/core';
import { getSession, isDemoMode } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function switchAccount(email: string): Promise<string> {
  if (!isDemoMode()) return '/connexion';
  const u = await prisma.user.findUnique({ where: { email }, include: { memberships: { include: { organisation: true } } } });
  if (!u?.memberships[0]) return '/connexion';
  const s = await getSession();
  s.userId = u.id;
  s.orgId = u.memberships[0].organisationId;
  await s.save();
  return `/${portalFor(u.memberships[0].organisation.type)}`;
}

export async function logout() {
  const s = await getSession();
  s.destroy();
  redirect('/connexion');
}

/** Horloge simulée : saut de N jours puis exécution immédiate des tâches dues (relances, factures…). */
export async function jumpClock(_: unknown, f: FormData) {
  if (!isDemoMode()) return { ok: false, error: 'Mode démo désactivé' };
  const days = Number(f.get('days'));
  if (!Number.isInteger(days) || days < 1 || days > 400) return { ok: false, error: 'Nombre de jours invalide (1–400)' };
  await advanceClock(prisma, days);
  const r = await svc.runScheduler();
  revalidatePath('/', 'layout');
  return { ok: true, message: `Horloge avancée de ${days} j. Tâches exécutées : ${r.invoicesCreated} facture(s), ${r.dunningSent} relance(s), ${r.slaAlerts} alerte(s) SLA, ${r.quotesExpired} devis expiré(s), ${r.contractsEnded} fin(s) de contrat.` };
}

export async function resetSimClock() {
  if (!isDemoMode()) return { ok: false, error: 'Mode démo désactivé' };
  await resetClock(prisma);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Horloge remise à l’heure réelle.' };
}

export async function runJobsNow() {
  const r = await svc.runScheduler();
  revalidatePath('/', 'layout');
  return { ok: true, message: `Tâches exécutées : ${JSON.stringify(r)}` };
}
