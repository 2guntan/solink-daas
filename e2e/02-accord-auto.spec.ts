import { expect, test } from '@playwright/test';
import { act, addProduct, expectStatus, login, quoteAndRequestFinancing, switchTo } from './helpers';

/** Scénario 2 : grand compte en liste blanche, score ≥ 70, montant sous plafond → accord automatique (règle financeur). */
test('accord automatique dans l’enveloppe (Teranga)', async ({ page }) => {
  await login(page, 'admin@teranga-demo.sn');
  await addProduct(page, 'LP-E14-8', 2, 'Agence Almadies');
  await expect(page.getByTestId('ligne-panier')).toHaveCount(1);
  const id = await quoteAndRequestFinancing(page);

  // Dossier : pièces réutilisées du dossier précédent + pièces de démo ; agrégats repris (saisir une fois)
  await act(page, 'toutes-pieces-demo');
  const decl = page.locator('#bloc-declarations');
  await decl.locator('input[name=exactitude]').check();
  await page.getByTestId('declarations').click();
  await expect(decl.getByRole('status')).toContainText('Déclarations enregistrées');
  await expect(page.getByTestId('soumettre-dossier')).toBeEnabled();
  await act(page, 'soumettre-dossier');
  await page.waitForURL(`**/client/commandes/${id}`);
  await expectStatus(page, 'PRE_CONTROLE');

  // Pré-contrôle SOLINK → transmission → la règle d'accord automatique du financeur est exécutée
  await switchTo(page, 'dossier@solink.sn');
  await page.goto(`/solink/commandes/${id}`);
  await act(page, 'valider-tout');
  await act(page, 'terminer-precontrole');
  await expect(page.getByTestId('score')).toContainText('voie AUTO');
  await expectStatus(page, 'OFFRE_EMISE');
  await expect(page.getByTestId('journal')).toContainText('Accord automatique — règle BANQUE_PILOTE-ACCORD-AUTO-v1');

  // Côté banque : décision automatique tracée, montant réservé sur l'enveloppe
  await switchTo(page, 'valideur@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await expect(page.getByTestId('score')).toContainText('voie AUTO');
  await expect(page.getByText(/accord automatique — règle BANQUE_PILOTE-ACCORD-AUTO-v1/)).toBeVisible();
  await page.goto('/banque');
  await expect(page.getByTestId('enveloppe')).toContainText('réservé');

  // Le client voit son offre prête à signer
  await switchTo(page, 'admin@teranga-demo.sn');
  await page.goto(`/client/commandes/${id}`);
  await expectStatus(page, 'OFFRE_EMISE');
  await expect(page.getByTestId('decision')).toContainText('Accordé');
});
