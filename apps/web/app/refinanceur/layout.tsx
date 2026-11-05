import { PortalShell } from '@/components/portal-shell';
import { requireActor } from '@/lib/session';
export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('refinanceur');
  return <PortalShell portal="refinanceur" actor={actor} nav={[{ href: '/refinanceur', label: 'Portefeuille éligible' }]}>{children}</PortalShell>;
}
