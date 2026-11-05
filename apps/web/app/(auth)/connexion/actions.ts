'use server';

import { isBusinessError, portalFor, svc } from '@solink/core';
import { prisma } from '@solink/db';
import { getSession } from '@/lib/session';

export async function sendCode(_: unknown, f: FormData) {
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  try {
    await svc.requestOtp(email);
    return { ok: true, message: 'Code envoyé (voir la Boîte de démo).', data: { email } };
  } catch (e) {
    return { ok: false, error: isBusinessError(e) ? e.message : 'Erreur' };
  }
}

export async function verifyCode(_: unknown, f: FormData) {
  const email = String(f.get('email') ?? '').trim().toLowerCase();
  const code = String(f.get('code') ?? '').trim();
  try {
    const r = await svc.verifyOtp(email, code);
    const s = await getSession();
    s.userId = r.userId;
    s.orgId = r.orgId;
    await s.save();
    const o = await prisma.organisation.findUniqueOrThrow({ where: { id: r.orgId } });
    const next = String(f.get('next') ?? '');
    return { ok: true, redirect: next.startsWith('/') ? next : `/${portalFor(o.type)}` };
  } catch (e) {
    return { ok: false, error: isBusinessError(e) ? e.message : 'Erreur' };
  }
}
