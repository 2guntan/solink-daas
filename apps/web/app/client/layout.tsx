import { PortalShell } from '@/components/portal-shell';
import { requireActor } from '@/lib/session';

const NAV = [
  { href: '/client', label: 'Accueil' },
  { href: '/client/catalogue', label: 'Catalogue' },
  { href: '/client/packs', label: 'Packs' },
  { href: '/client/panier', label: 'Panier' },
  { href: '/client/commandes', label: 'Commandes' },
  { href: '/client/livraisons', label: 'Livraisons' },
  { href: '/client/parc', label: 'Parc & contrat' },
  { href: '/client/factures', label: 'Factures' },
  { href: '/client/tickets', label: 'Support' },
  { href: '/client/equipe', label: 'Équipe' },
  { href: '/client/sites', label: 'Sites' },
  { href: '/client/entreprise', label: 'Entreprise' },
];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor('client');
  return (
    <PortalShell portal="client" actor={actor} nav={NAV}>
      {children}
    </PortalShell>
  );
}
