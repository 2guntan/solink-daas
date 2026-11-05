import Link from 'next/link';
import { ProductConfig } from '@/components/product-config';

export default async function Page({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <Link href="/configurateur" className="text-sm">← Catalogue</Link>
      <div className="mt-3"><ProductConfig sku={sku} /></div>
    </main>
  );
}
