import Link from 'next/link';
import { prisma } from '@solink/db';
import { getParams } from '@solink/core';
import { Configurator } from '@/components/live-price';
import { ProductHeader } from '@/components/catalogue';
export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const p = await prisma.product.findUniqueOrThrow({ where: { sku } });
  const pr = await getParams(prisma);
  return <div><Link href="/orange/configurateur" className="text-sm">← Catalogue</Link><ProductHeader sku={sku} /><Configurator sku={sku} isThin={p.category === 'THIN_CLIENT'} durations={pr.durees_autorisees} accessories={[]} financer="Banque Pilote (démo)" /></div>;
}
