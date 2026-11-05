'use server';

import type { Segment } from '@solink/db';
import { svc } from '@solink/core';
import { act, str, type ActionResult } from '@/lib/action';

export async function createLeadAction(_: ActionResult | null, f: FormData) {
  return act('orange', async (ctx) => {
    const lead = await svc.createLead(ctx, { companyName: str(f, 'companyName'), ninea: str(f, 'ninea') || undefined, segment: (str(f, 'segment') || undefined) as Segment | undefined, contactName: str(f, 'contactName'), contactEmail: str(f, 'contactEmail'), contactPhone: str(f, 'contactPhone'), need: str(f, 'need') });
    if (f.get('invite') === 'on') await svc.inviteLead(ctx, lead.id);
    return { ok: true, message: f.get('invite') === 'on' ? 'Lead créé et invitation pré-remplie envoyée.' : 'Lead créé.' };
  });
}
export async function inviteLeadAction(_: ActionResult | null, f: FormData) {
  return act('orange', async (ctx) => {
    await svc.inviteLead(ctx, str(f, 'leadId'));
    return { ok: true, message: 'Invitation envoyée au client.' };
  });
}
