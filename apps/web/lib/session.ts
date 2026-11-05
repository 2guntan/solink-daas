import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getIronSession, type SessionOptions } from 'iron-session';
import { PORTAL_ORG, svc, type Actor, type Portal } from '@solink/core';

export interface SessionData {
  userId?: string;
  orgId?: string;
}

export const sessionOptions: SessionOptions = {
  cookieName: 'solink_session',
  password: process.env.SESSION_SECRET ?? 'change-me-demo-secret-change-me-demo-secret-0123456789',
  cookieOptions: { secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https'), sameSite: 'lax', httpOnly: true },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function currentActor(): Promise<Actor | null> {
  const s = await getSession();
  if (!s.userId) return null;
  return svc.loadActor(s.userId, s.orgId);
}

/** Exige une session ; si `portal` est donné, l'organisation doit correspondre au portail. */
export async function requireActor(portal?: Portal): Promise<Actor> {
  const a = await currentActor();
  if (!a) redirect('/connexion');
  if (portal && PORTAL_ORG[portal] !== a.orgType) redirect('/acces-refuse');
  return a;
}

export const isDemoMode = () => (process.env.DEMO_MODE ?? 'true') === 'true';
