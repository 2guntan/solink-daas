import Link from 'next/link';
import { prisma } from '@solink/db';
import { llm } from '@solink/adapters';
import { fcfa, getParams, svc, OFFER_LABEL, RANGE_LABEL, TIMELINE_STEPS } from '@solink/core';
import { Button, Select, buttonVariants } from '@solink/ui';
import { Wordmark } from '@/components/wordmark';

const OFFERS = [
  { code: 'BUREAU_CLOUD', who: 'Guichets, centres d’appels, back-offices', inc: ['Thin client managé', 'Bureau virtuel Orange (VDI)', 'Support & MDM SOLINK', 'Assurance'] },
  { code: 'POSTE_MOBILE', who: 'Cadres, commerciaux, équipes mobiles', inc: ['Ordinateur portable managé', 'Microsoft 365 / Intune', 'Support & remplacement', 'Assurance'] },
  { code: 'HYBRIDE', who: 'Organisations mixtes sièges + terrain', inc: ['Mix thin clients et portables', 'VDI pour les postes fixes', 'Un seul contrat, une seule facture', 'Assurance'] },
];

const STEPS = [
  { t: 'Configurez', d: 'Choisissez vos postes, la durée et les services. La mensualité s’affiche en direct.' },
  { t: 'Montez le dossier', d: 'Cinq blocs, pièces vérifiées en ligne, pré-contrôle SOLINK avant transmission.' },
  { t: 'Signez', d: 'Décision de la banque, puis signature électronique de tout le pack contractuel.' },
  { t: 'Recevez', d: 'Équipements livrés configurés, PV numérique, une seule facture Orange Business.' },
];

const Check = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0 text-neutral-900">
    <path d="m5 12 5 5L20 7" />
  </svg>
);

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const params = await getParams(prisma);
  const from = await svc.fromPrices(prisma, params);
  const reco = sp.metier && sp.mobilite && sp.applications ? await llm.recommendOffer({ metier: sp.metier, mobilite: sp.mobilite, applications: sp.applications }) : null;
  return (
    <main className="bg-white">
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="no-underline hover:no-underline">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Navigation principale">
            <Link href="/configurateur" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Catalogue
            </Link>
            <Link href="/connexion" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Me connecter
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pb-24 sm:pt-28">
        <p className="animate-fade-up text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-500">Device as a Service · Sénégal</p>
        <h1 className="mt-5 max-w-4xl animate-fade-up text-[40px] font-semibold leading-[1.05] tracking-tightest text-neutral-900 [animation-delay:60ms] sm:text-[64px]">
          Des postes de travail managés, financés par une banque, sans papier.
        </h1>
        <p className="mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-neutral-500 [animation-delay:120ms] sm:text-xl">
          Choisissez, commandez, montez votre dossier de financement, signez et recevez vos équipements configurés. Une mensualité tout compris, une seule facture Orange Business.
        </p>
        <div className="mt-9 flex animate-fade-up flex-wrap gap-3 [animation-delay:180ms]">
          <Link href="/configurateur" className={buttonVariants({ size: 'lg' })}>
            Configurer mon équipement
          </Link>
          <Link href="/connexion" className={buttonVariants({ size: 'lg', variant: 'outline' })}>
            Me connecter
          </Link>
        </div>
        <p className="mt-8 text-xs text-neutral-400">Orange Business, facturation pour compte · Banque Pilote (démo), bailleur et propriétaire · SOLINK, fournisseur-opérateur.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6" aria-labelledby="offres">
        <div className="mb-6 flex items-end justify-between">
          <h2 id="offres" className="text-2xl font-semibold tracking-tight sm:text-3xl">Trois offres, une mensualité.</h2>
          <Link href="/configurateur" className="hidden text-sm font-medium text-neutral-900 no-underline hover:underline sm:inline">
            Tout le catalogue →
          </Link>
        </div>
        <div className="hairline-grid md:grid-cols-3">
          {OFFERS.map((o) => (
            <article key={o.code} className="flex flex-col p-6 sm:p-8">
              <h3 className="text-xl font-semibold tracking-tight">{OFFER_LABEL[o.code]}</h3>
              <p className="mt-1 text-sm text-neutral-500">{o.who}</p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-neutral-700">
                {o.inc.map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check />
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-8 border-t border-neutral-100 pt-5">
                <p className="text-xs text-neutral-500">à partir de</p>
                <p className="mt-1 text-[28px] font-semibold leading-none tabular-nums tracking-tight" data-testid={`apartir-${o.code}`}>
                  {fcfa(from[o.code] ?? 0)}
                </p>
                <p className="mt-1.5 text-xs text-neutral-500">TTC / mois / poste</p>
                <Link href={`/configurateur?offre=${o.code}`} className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 no-underline hover:underline">
                  Voir les équipements <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28" aria-labelledby="parcours">
        <h2 id="parcours" className="text-2xl font-semibold tracking-tight sm:text-3xl">Un parcours en ligne, de bout en bout.</h2>
        <p className="mt-2 max-w-2xl text-neutral-500">
          {TIMELINE_STEPS.length} étapes suivies sur votre espace, avec une seule « prochaine action » à la fois.
        </p>
        <ol className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="border-t border-neutral-900 pt-5">
              <p className="font-mono text-xs text-neutral-400">0{i + 1}</p>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28" aria-labelledby="aide">
        <div className="rounded-3xl bg-neutral-50 p-6 sm:p-10">
          <h2 id="aide" className="text-2xl font-semibold tracking-tight">Aidez-moi à choisir</h2>
          <p className="mt-1 text-sm text-neutral-500">Trois réponses suffisent pour une recommandation.</p>
          <form className="mt-6 grid gap-2 sm:grid-cols-4" action="/">
            <Select name="metier" defaultValue={sp.metier} aria-label="Métier" required><option value="">Métier…</option><option value="guichet">Guichet / accueil</option><option value="centre_appels">Centre d’appels</option><option value="bureau">Bureau / administratif</option><option value="commercial">Commercial terrain</option><option value="direction">Direction</option></Select>
            <Select name="mobilite" defaultValue={sp.mobilite} aria-label="Mobilité" required><option value="">Mobilité…</option><option value="non">Poste fixe</option><option value="parfois">Parfois</option><option value="souvent">Souvent en déplacement</option></Select>
            <Select name="applications" defaultValue={sp.applications} aria-label="Applications" required><option value="">Applications…</option><option value="bureautique">Bureautique / métier web</option><option value="lourdes">Lourdes (data, design)</option></Select>
            <Button type="submit">Recommander</Button>
          </form>
          {reco ? (
            <div className="mt-5 animate-fade-up rounded-2xl border border-neutral-200 bg-white p-5 text-sm" data-testid="recommandation">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">Recommandation</p>
              <p className="mt-2 text-neutral-800">{reco.explanation}</p>
              <Link href={`/configurateur?offre=${reco.offer}&gamme=${reco.range}`} className="mt-3 inline-flex items-center gap-1 font-medium text-neutral-900 no-underline hover:underline">
                Voir les équipements {OFFER_LABEL[reco.offer]} {RANGE_LABEL[reco.range]} <span aria-hidden>→</span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark />
          <p>Plateforme de démonstration, données fictives. SOLINK n’est ni établissement de crédit ni établissement de paiement.</p>
        </div>
      </footer>
    </main>
  );
}
