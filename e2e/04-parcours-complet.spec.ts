import { expect, test } from '@playwright/test';
import { act, addProduct, expectStatus, fillFinancesAndDeclarations, login, quoteAndRequestFinancing, signOnSignerPage, switchTo } from './helpers';

/**
 * Scénario 1 (CLAUDE.md §1) : parcours complet de bout en bout avec décision analyste.
 * connexion → configuration → panier → devis → financement → dossier → pré-contrôle → décision → signatures →
 * conditions suspensives → achat → livraison → PV → décaissement → paiement → contrat actif → facture 2 lignes → encaissement ventilé.
 */
test('parcours complet (PME Ndar, instruction analyste)', async ({ page }) => {
  // 1. Connexion + configuration multi-sites
  await login(page, 'admin@ndar-demo.sn');
  await addProduct(page, 'LP-T14-16', 3, 'Entrepôt Saint-Louis');
  await addProduct(page, 'TC-T640', 2, 'Bureau Dakar Port');
  await expect(page.getByTestId('ligne-panier')).toHaveCount(2);
  await expect(page.getByTestId('panier-mensualite')).toContainText('FCFA');

  // 2. Devis → acceptation → demande de financement
  const id = await quoteAndRequestFinancing(page);

  // 3. Dossier complet → soumission
  await act(page, 'toutes-pieces-demo');
  await fillFinancesAndDeclarations(page, 3);
  await act(page, 'soumettre-dossier');
  await page.waitForURL(`**/client/commandes/${id}`);
  await expectStatus(page, 'PRE_CONTROLE');

  // 4. Pré-contrôle SOLINK → transmission (hors liste blanche → instruction analyste)
  await switchTo(page, 'dossier@solink.sn');
  await page.goto(`/solink/commandes/${id}`);
  await act(page, 'valider-tout');
  await act(page, 'terminer-precontrole');
  await expect(page.getByTestId('score')).toContainText('voie ANALYSTE');
  await expectStatus(page, 'TRANSMIS_FINANCEUR');

  // 5. Décision banque (analyste) avec confirmation + motif
  await switchTo(page, 'analyste@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await expect(page.getByTestId('synthese')).toContainText('à vérifier');
  await act(page, 'accuser-reception');
  await expectStatus(page, 'EN_ANALYSE');
  await act(page, 'decider', { reason: 'Couverture du loyer satisfaisante' });
  await expectStatus(page, 'OFFRE_EMISE');

  // 6. Signature client
  await switchTo(page, 'admin@ndar-demo.sn');
  await page.goto(`/client/commandes/${id}/signature`);
  await page.getByTestId('commencer-signature').click();
  await signOnSignerPage(page);
  await page.goto(`/client/commandes/${id}`);
  await expectStatus(page, 'CONTRESIGNATURE');

  // 7. Contre-signature banque (sollicitée après la dernière signature client)
  await switchTo(page, 'valideur@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await page.getByTestId('contresigner').click();
  await signOnSignerPage(page);
  await page.goto(`/banque/dossiers/${id}`);
  await expectStatus(page, 'CONDITIONS_SUSPENSIVES');

  // 8. Pas d'achat avant levée des conditions suspensives
  await switchTo(page, 'ops@solink.sn');
  await page.goto('/solink/achats');
  const refText = (await page.locator('[data-testid^=achat-]').filter({ hasText: 'PME Logistique Ndar' }).first().getAttribute('data-testid'))!;
  const ref = refText.replace('achat-', '');
  await page.getByTestId(`bc-${ref}`).click();
  await expect(page.getByRole('alert').filter({ hasText: 'CONDITIONS_SUSPENSIVES_NON_LEVEES' })).toBeVisible();

  // 9. Levée : dépôt reçu (banque) + mandat actif (+ assurance émise à la contre-signature)
  await switchTo(page, 'valideur@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await act(page, 'confirmer-depot', { confirm: true });
  await act(page, 'activer-mandat');
  await expectStatus(page, 'PRET_POUR_ACHAT');

  // 10. Achat, réception (séries + Autopilot), expédition, livraison multi-sites
  await switchTo(page, 'ops@solink.sn');
  await page.goto('/solink/achats');
  await act(page, `bc-${ref}`);
  await expect(page.getByTestId(`reception-${ref}`)).toBeVisible();
  await act(page, `reception-${ref}`);
  await expect(page.getByTestId(`reception-${ref}`)).toHaveCount(0);
  await page.goto('/solink/logistique');
  await act(page, `expedier-${ref}`);
  await act(page, 'livrer-Entrepôt Saint-Louis');
  await act(page, 'livrer-Bureau Dakar Port');

  // 11. PV numériques signés par OTP → demande de décaissement automatique
  await switchTo(page, 'admin@ndar-demo.sn');
  await page.goto('/client/livraisons');
  for (const site of ['Entrepôt Saint-Louis', 'Bureau Dakar Port']) {
    const card = page.getByTestId(`livraison-${site}`).filter({ hasText: ref });
    await card.getByLabel('Code OTP PV').fill('000000');
    await card.getByTestId(`signer-pv-${site}`).click();
    await expect(card.getByText('PV signé')).toBeVisible();
  }
  await page.goto(`/client/commandes/${id}`);
  await expectStatus(page, 'DECAISSEMENT_DEMANDE');

  // 12. Trésorerie banque : validation puis confirmation du paiement → contrat ACTIF
  await switchTo(page, 'tresorerie@banque-demo.sn');
  await page.goto('/banque/decaissements');
  await act(page, 'valider-decaissement');
  await act(page, 'confirmer-paiement', { confirm: true });
  await switchTo(page, 'admin@ndar-demo.sn');
  await page.goto(`/client/commandes/${id}`);
  await expectStatus(page, 'ACTIF');
  await page.goto('/client/parc');
  await expect(page.locator('[data-device-status=ACTIF]')).toHaveCount(5);

  // 13. Facture Orange 2 lignes au 1er du mois suivant (horloge simulée)
  await page.goto('/demo/horloge');
  const [dd, mm, yyyy] = (await page.getByTestId('clock-now').innerText()).slice(0, 10).split('/').map(Number);
  const simNow = Date.UTC(yyyy, mm - 1, dd);
  const days = Math.round((Date.UTC(yyyy, mm, 1) - simNow) / 86400000) + 1;
  await page.getByLabel('Nombre de jours').fill(String(days));
  await page.getByTestId('clock-jump').click();
  await expect(page.getByRole('status').filter({ hasText: 'Horloge avancée' })).toBeVisible();
  await page.goto('/client/factures');
  const row = page.locator('tr', { has: page.locator('[data-invoice-status=EMISE]') }).first();
  await expect(row).toBeVisible();
  const invoiceRef = (await row.locator('td').first().innerText()).trim();
  await expect(row.locator('td').nth(2)).toContainText('FCFA'); // ligne 1 loyer
  await expect(row.locator('td').nth(3)).toContainText('FCFA'); // ligne 2 services

  // 14. Encaissement ventilé (cantonnement) — écart encaissé / ventilé = 0
  await page.goto('/demo/banque-virements');
  await page.getByTestId(`encaisser-${invoiceRef}`).click();
  await expect(page.getByTestId(`encaisser-${invoiceRef}`)).toHaveCount(0); // facture soldée : retirée de la liste
  await switchTo(page, 'admin@solink.sn');
  await page.goto('/solink/facturation');
  await expect(page.getByTestId('ecart')).toHaveText('0 FCFA');
  await page.goto('/demo');
  await expect(page.getByTestId('audit-chain')).toContainText('Chaîne intègre');
});
