import { PageHeader } from '@solink/ui';
import { Catalogue } from '@/components/catalogue';
export const metadata = { title: 'Configurateur RDV' };
/** O05 — configurateur d'offre pour rendez-vous client (mensualités uniquement). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  return <div><PageHeader title="Configurateur pour rendez-vous client" /><Catalogue basePath="/orange/configurateur" sp={await searchParams} /></div>;
}
