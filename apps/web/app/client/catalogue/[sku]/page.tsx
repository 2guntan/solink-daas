import Link from 'next/link';
import { ProductConfig } from '@/components/product-config';
import { requireActor } from '@/lib/session';
export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const actor = await requireActor('client');
  return (
    <div>
      <Link href="/client/catalogue" className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-neutral-500 no-underline hover:text-neutral-900 hover:no-underline">← Catalogue</Link>
      <div className="mt-3"><ProductConfig sku={sku} orgId={actor.orgId} /></div>
    </div>
  );
}
