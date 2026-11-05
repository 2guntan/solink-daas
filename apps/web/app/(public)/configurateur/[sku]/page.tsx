import Link from 'next/link';
import { ProductConfig } from '@/components/product-config';
import { PublicHeader } from '@/components/public-header';

export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return (
    <>
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/configurateur" className="text-[13px] font-medium text-neutral-500 no-underline hover:text-neutral-900">
          ← Catalogue
        </Link>
        <div className="mt-4">
          <ProductConfig sku={sku} />
        </div>
      </main>
    </>
  );
}
