import { prisma } from '@solink/db';
import { fileStore } from '@solink/adapters';
import { audit, svc } from '@solink/core';
import { currentActor } from '@/lib/session';
import { fileAccessible } from '@/lib/files';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) return new Response('Non authentifié', { status: 401 });
  if (!(await fileAccessible(actor, id))) return new Response('Accès refusé', { status: 403 });
  const f = await fileStore.get(prisma, id);
  if (!f) return new Response('Introuvable', { status: 404 });
  await svc.run(actor, (ctx) => audit(ctx.db, 'StoredFile', id, 'FICHIER_CONSULTE', actor.userId, { name: f.name }));
  const download = new URL(req.url).searchParams.has('telecharger');
  return new Response(new Uint8Array(f.data), {
    headers: { 'content-type': f.mime, 'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(f.name)}"`, 'x-sha256': f.sha256 },
  });
}
