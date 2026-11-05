import Link from 'next/link';
import { prisma } from '@solink/db';
import { llm } from '@solink/adapters';
import { fcfa, getParams, svc, OFFER_LABEL, RANGE_LABEL } from '@solink/core';
import { Badge, Button, Card, Select, buttonVariants } from '@solink/ui';

const OFFERS = [
  { code: 'BUREAU_CLOUD', who: 'Guichets, centres d’appels, back-offices', inc: ['Thin client managé', 'Bureau virtuel Orange (VDI)', 'Support & MDM SOLINK', 'Assurance'] },
  { code: 'POSTE_MOBILE', who: 'Cadres, commerciaux, équipes mobiles', inc: ['Ordinateur portable managé', 'Microsoft 365 / Intune', 'Support & remplacement', 'Assurance'] },
  { code: 'HYBRIDE', who: 'Organisations mixtes sièges + terrain', inc: ['Mix thin clients et portables', 'VDI pour les postes fixes', 'Un seul contrat, une seule facture', 'Assurance'] },
];

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = await getParams(prisma);
  const from = await svc.fromPrices(prisma, params);
  const reco = sp.metier && sp.mobilite && sp.applications ? await llm.recommendOffer({ metier: sp.metier, mobilite: sp.mobilite, applications: sp.applications }) : null;
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold text-primary">SOLINK DaaS</span>
        <Link href="/connexion" className={buttonVariants({ variant: 'outline' })}>Me connecter</Link>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl">Équipez vos collaborateurs en postes managés, financés par une banque, en ligne et sans papier.</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Choisissez, commandez, montez votre dossier de financement, signez et recevez vos équipements configurés. Une mensualité tout compris, une seule facture Orange Business.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/configurateur" className={buttonVariants({ size: 'lg' })}>Configurer mon équipement</Link>
          <Link href="/connexion" className={buttonVariants({ size: 'lg', variant: 'outline' })}>Me connecter</Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">Partenaires : Orange Business (facturation pour compte) · Banque Pilote (démo), bailleur et propriétaire · SOLINK, fournisseur-opérateur.</p>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 md:grid-cols-3">
        {OFFERS.map((o) => (
          <Card key={o.code} className="flex flex-col p-5">
            <h2 className="text-lg font-semibold">{OFFER_LABEL[o.code]}</h2>
            <p className="text-sm text-slate-500">{o.who}</p>
            <ul className="mt-3 flex-1 space-y-1 text-sm">{o.inc.map((i) => <li key={i}>✓ {i}</li>)}</ul>
            <p className="mt-4 text-sm">à partir de <strong className="text-xl text-primary" data-testid={`apartir-${o.code}`}>{fcfa(from[o.code] ?? 0)}</strong> TTC/mois/poste</p>
            <Link href={`/configurateur?offre=${o.code}`} className="mt-3 text-sm font-medium">Voir les équipements →</Link>
          </Card>
        ))}
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <Card className="p-5">
          <h2 className="text-lg font-semibold">Aidez-moi à choisir</h2>
          <form className="mt-3 grid gap-2 sm:grid-cols-4" action="/">
            <Select name="metier" defaultValue={sp.metier} aria-label="Métier" required><option value="">Métier…</option><option value="guichet">Guichet / accueil</option><option value="centre_appels">Centre d’appels</option><option value="bureau">Bureau / administratif</option><option value="commercial">Commercial terrain</option><option value="direction">Direction</option></Select>
            <Select name="mobilite" defaultValue={sp.mobilite} aria-label="Mobilité" required><option value="">Mobilité…</option><option value="non">Poste fixe</option><option value="parfois">Parfois</option><option value="souvent">Souvent en déplacement</option></Select>
            <Select name="applications" defaultValue={sp.applications} aria-label="Applications" required><option value="">Applications…</option><option value="bureautique">Bureautique / métier web</option><option value="lourdes">Lourdes (data, design)</option></Select>
            <Button type="submit">Recommander</Button>
          </form>
          {reco ? (
            <div className="mt-3 rounded bg-primary/5 p-3 text-sm" data-testid="recommandation">
              <p><Badge tone="info">Assistant</Badge> {reco.explanation}</p>
              <Link href={`/configurateur?offre=${reco.offer}&gamme=${reco.range}`}>Voir les équipements {OFFER_LABEL[reco.offer]} {RANGE_LABEL[reco.range]} →</Link>
            </div>
          ) : null}
        </Card>
      </section>
      <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">SOLINK DaaS — plateforme de démonstration. Données fictives. SOLINK n’est ni établissement de crédit ni établissement de paiement.</footer>
    </main>
  );
}
