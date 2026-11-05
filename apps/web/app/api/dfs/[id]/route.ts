import { prisma } from '@solink/db';
import { fileStore } from '@solink/adapters';
import { currentActor } from '@/lib/session';

/** Téléchargement d'un DFS scellé (zip) — SOLINK et financeur uniquement. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor || !['OPERATEUR', 'FINANCEUR'].includes(actor.orgType)) return new Response('Accès refusé', { status: 403 });
  const pkg = await prisma.dfsPackage.findUnique({ where: { id } });
  if (!pkg?.zipFileId) return new Response('Introuvable', { status: 404 });
  const f = await fileStore.get(prisma, pkg.zipFileId);
  if (!f) return new Response('Introuvable', { status: 404 });
  return new Response(new Uint8Array(f.data), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${pkg.packageId}.zip"`, 'x-manifest-sha256': pkg.manifestSha256 } });
}
