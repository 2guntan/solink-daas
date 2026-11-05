import { expect, test } from '@playwright/test';
import { act, addProduct, expectStatus, fillFinancesAndDeclarations, login, quoteAndRequestFinancing, switchTo } from './helpers';

/** Scénario 3 : pièce à reprendre (RCCM > 3 mois puis reprise SOLINK) puis pièces complémentaires (DFS v2 + différentiel). */
test('pièce à reprendre puis pièces complémentaires (PME Ndar)', async ({ page }) => {
  await login(page, 'admin@ndar-demo.sn');
  await addProduct(page, 'LP-PB440-8', 2, 'Entrepôt Saint-Louis');
  const id = await quoteAndRequestFinancing(page);

  // Extrait RCCM de plus de 3 mois → À reprendre (motif) + WhatsApp + soumission inactive
  await act(page, 'demo-perime-RCCM');
  const rccm = page.getByTestId('piece-RCCM');
  await expect(rccm.locator('[data-doc-status]')).toHaveAttribute('data-doc-status', 'A_REPRENDRE');
  await expect(rccm.getByTestId('motif')).toContainText('Extrait de plus de 3 mois');
  await act(page, 'toutes-pieces-demo'); // les autres pièces (et le RCCM repris, daté du jour)
  await expect(rccm.locator('[data-doc-status]')).toHaveAttribute('data-doc-status', 'EN_VERIFICATION');
  await page.goto('/demo/boite?a=admin%40ndar-demo.sn&canal=WHATSAPP');
  await expect(page.getByTestId('inbox')).toContainText('Extrait de plus de 3 mois');
  await page.goto(`/client/commandes/${id}/dossier`);
  await fillFinancesAndDeclarations(page, 3);
  await act(page, 'soumettre-dossier');
  await page.waitForURL(`**/client/commandes/${id}`);

  // SOLINK demande la reprise des statuts
  await switchTo(page, 'dossier@solink.sn');
  await page.goto(`/solink/commandes/${id}`);
  await page.getByTestId('piece-STATUTS').getByTestId('a-reprendre').click();
  await page.getByLabel('Motif').fill('Statuts non signés — fournir la version à jour');
  await page.getByTestId('a-reprendre-confirmer').click();
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('piece-STATUTS').locator('[data-doc-status]')).toHaveAttribute('data-doc-status', 'A_REPRENDRE');
  await act(page, 'terminer-precontrole');
  await expectStatus(page, 'DOSSIER_A_REPRENDRE');

  // Le client reprend la pièce et re-soumet
  await switchTo(page, 'admin@ndar-demo.sn');
  await page.goto(`/client/commandes/${id}/dossier`);
  await expect(page.getByTestId('piece-STATUTS').getByTestId('motif')).toContainText('Statuts non signés');
  await act(page, 'demo-STATUTS');
  await act(page, 'soumettre-dossier');
  await page.waitForURL(`**/client/commandes/${id}`);
  await expectStatus(page, 'PRE_CONTROLE');

  await switchTo(page, 'dossier@solink.sn');
  await page.goto(`/solink/commandes/${id}`);
  await act(page, 'valider-tout');
  await act(page, 'terminer-precontrole');
  await expectStatus(page, 'TRANSMIS_FINANCEUR');

  // La banque demande une pièce complémentaire
  await switchTo(page, 'analyste@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await act(page, 'accuser-reception');
  await page.getByTestId('demande-pieces').locator('input[value=CAUTION]').check();
  await act(page, 'demander-pieces');
  await expectStatus(page, 'PIECES_COMPLEMENTAIRES');

  // Le client fournit la pièce → DFS v2 avec manifest référençant v1
  await switchTo(page, 'admin@ndar-demo.sn');
  await page.goto(`/client/commandes/${id}`);
  await expect(page.getByTestId('prochaine-action-label')).toContainText('La banque demande');
  await page.goto(`/client/commandes/${id}/dossier`);
  await act(page, 'demo-CAUTION');
  await act(page, 'transmettre-complements');
  await page.waitForURL(`**/client/commandes/${id}`);
  await expectStatus(page, 'EN_ANALYSE');

  // Le financeur voit la liste des différences entre v1 et v2
  await switchTo(page, 'analyste@banque-demo.sn');
  await page.goto(`/banque/dossiers/${id}`);
  await expect(page.getByTestId('dfs')).toContainText('-v2');
  await expect(page.getByTestId('dfs-diff').first()).toContainText('ajouté : pieces/CAUTION_');
  await expect(page.getByTestId('dfs')).toContainText('précédent');
});
