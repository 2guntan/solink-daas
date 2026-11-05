import { PortalShell } from '@/components/portal-shell';
import { requireActor } from '@/lib/session';

const NAV = [
  { href: '/banque', label: 'Tableau de bord' },
  { href: '/banque/file', label: 'File d’instruction' },
  { href: '/banque/decaissements', label: 'Décaissements' },
  { href: '/banque/verrouillages', label: 'Impayés & verrouillages' },
  { href: '/banque/portefeuille', label: 'Portefeuille' },
  { href: '/banque/parametrage', label: 'Paramétrage' },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('banque');
  return <PortalShell portal="banque" actor={actor} nav={NAV}>{children}</PortalShell>;
}
