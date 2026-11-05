import { expect, type Page } from '@playwright/test';

/** Connexion OTP par le formulaire (code de démo 000000). */
export async function login(page: Page, email: string) {
  await page.goto('/connexion');
  await page.fill('input[name=email]', email);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.fill('input[name=code]', '000000');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'));
}

/** Bascule de compte via le sélecteur de démo (barre supérieure). */
export async function switchTo(page: Page, email: string) {
  const portal = /@solink\.sn$/.test(email) ? '/solink' : /banque-demo/.test(email) ? '/banque' : /orange-demo/.test(email) ? '/orange' : /fonds-demo/.test(email) ? '/refinanceur' : '/client';
  await page.getByTestId('demo-switch').selectOption(email);
  await page.waitForURL((u) => u.pathname.startsWith(portal));
  await expect(page.getByTestId('whoami')).toBeVisible();
}

/** Clique une action serveur (avec confirmation + motif si demandé) et attend la fin du traitement. */
export async function act(page: Page, testId: string, opts: { reason?: string; confirm?: boolean } = {}) {
  const btn = page.getByTestId(testId).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  if (opts.reason !== undefined || opts.confirm) {
    if (opts.reason !== undefined) await page.getByLabel('Motif').first().fill(opts.reason);
    await page.getByTestId(`${testId}-confirmer`).first().click();
  }
  await page.waitForLoadState('networkidle');
}

export async function expectStatus(page: Page, status: string) {
  await expect(page.locator('[data-status]').first()).toHaveAttribute('data-status', status);
}

export async function orderIdFromUrl(page: Page) {
  const m = /commandes\/([^/?#]+)/.exec(page.url());
  if (!m) throw new Error(`URL sans commande : ${page.url()}`);
  return m[1];
}

/** Ajoute un produit au panier depuis la fiche configurateur. */
export async function addProduct(page: Page, sku: string, qty: number, site?: string) {
  await page.goto(`/client/catalogue/${sku}`);
  await expect(page.getByTestId('mensualite-poste')).toContainText('FCFA');
  await page.getByLabel('Quantité').fill(String(qty));
  if (site) await page.getByLabel('Site de livraison').selectOption({ label: site });
  await page.getByTestId('ajouter-panier').click();
  await page.waitForURL('**/client/panier');
}

/** Panier → devis → acceptation → demande de financement (consentements). Retourne l'id de commande. */
export async function quoteAndRequestFinancing(page: Page) {
  await act(page, 'emettre-devis');
  await page.waitForURL(/\/client\/commandes\/[^/]+$/);
  const id = await orderIdFromUrl(page);
  await expectStatus(page, 'DEVIS_EMIS');
  await act(page, 'accepter-devis');
  await expectStatus(page, 'DEVIS_ACCEPTE');
  const recap = page.getByTestId('recap-commande');
  for (const n of ['cgu', 'donnees', 'bic']) await recap.locator(`input[name=${n}]`).check();
  await page.getByTestId('demander-financement').click();
  await page.waitForURL(`**/client/commandes/${id}/dossier`);
  return id;
}

/** Remplit les agrégats financiers (N exercices) et les déclarations du dossier. */
export async function fillFinancesAndDeclarations(page: Page, years: number) {
  const bloc = page.locator('#bloc-finances');
  for (let i = 0; i < years; i++) {
    const v = (k: string, base: number) => bloc.locator(`input[name=${k}]`).nth(i).fill(String(Math.round(base * (1 - i * 0.05))));
    await v('ca', 900_000_000);
    await v('rex', 110_000_000);
    await v('rn', 60_000_000);
    await v('cp', 250_000_000);
    await v('dettes', 80_000_000);
    await v('tresorerie', 40_000_000);
  }
  await bloc.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(bloc.getByRole('status')).toContainText('Bloc Finances enregistré');
  const decl = page.locator('#bloc-declarations');
  await decl.locator('input[name=exactitude]').check();
  await decl.locator('input[name=ppe]').check();
  await page.getByTestId('declarations').click();
  await expect(decl.getByRole('status')).toContainText('Déclarations enregistrées');
}

/** Signe sur la page /signer/[token] (OTP de démo). */
export async function signOnSignerPage(page: Page) {
  await page.waitForURL('**/signer/**');
  await page.locator('input[name=lu]').check();
  await page.getByLabel('Code OTP').fill('000000');
  await page.getByTestId('signer').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signer'), { timeout: 120_000 });
}
