import { expect, test } from '@playwright/test';
import { act, login, switchTo } from './helpers';

/** Scénario 4 (CLAUDE.md §1) : impayé → relances → verrouillage J+15 → régularisation, via l'horloge simulée. */
test('impayé Teranga : relances, proposition J+15, ordre banque, exécution MDM, régularisation', async ({ page }) => {
  await login(page, 'daf@teranga-demo.sn');
  await page.goto('/client/factures');
  const unpaidRow = page.locator('tr', { has: page.locator('[data-invoice-status=IMPAYEE]') }).first();
  await expect(unpaidRow).toBeVisible();
  const invoiceRef = (await unpaidRow.locator('td').first().innerText()).trim();
  expect(invoiceRef).toMatch(/^FO-\d{4}-\d{5}$/);

  // Relances J+1 et J+7 déjà envoyées (facture échue depuis 10 jours)
  await page.goto('/demo/boite?a=daf%40teranga-demo.sn');
  await expect(page.getByTestId('inbox')).toContainText('Rappel de paiement');
  await expect(page.getByTestId('inbox')).toContainText('Relance de paiement');

  // Saut d'horloge de 5 jours → J+15 : proposition de verrouillage à la banque
  await page.goto('/demo/horloge');
  await page.getByLabel('Nombre de jours').fill('5');
  await page.getByTestId('clock-jump').click();
  await expect(page.getByRole('status').filter({ hasText: 'Horloge avancée de 5 j' })).toBeVisible();
  await expect(page.getByTestId('clock-offset')).toContainText('5 jour');
  await page.goto('/demo/boite?a=valideur%40banque-demo.sn');
  await expect(page.getByTestId('inbox')).toContainText('Proposition de verrouillage');

  // La banque ordonne le verrouillage (écran de confirmation + motif)
  await switchTo(page, 'valideur@banque-demo.sn');
  await page.goto('/banque/verrouillages');
  await expect(page.getByTestId('propositions-verrouillage')).toContainText('PROPOSE');
  await act(page, 'ordonner-verrouillage', { reason: 'Impayé J+15 non régularisé' });
  await expect(page.getByTestId('propositions-verrouillage')).toContainText('ORDONNE');

  // SOLINK exécute le verrouillage MDM (uniquement après ordre banque)
  await switchTo(page, 'ops@solink.sn');
  await page.goto('/solink/parc');
  await act(page, 'executer-verrouillage', { reason: 'Ordre banque reçu' });
  await expect(page.getByTestId('ordres-verrouillage')).toContainText('exécuté');

  // Le client voit ses équipements verrouillés
  await switchTo(page, 'admin@teranga-demo.sn');
  await page.goto('/client/parc');
  await expect(page.locator('[data-device-status=VERROUILLE]').first()).toBeVisible();
  await page.goto('/client/factures');
  await expect(page.getByText('Équipements verrouillés')).toBeVisible();

  // Régularisation : la banque confirme l'encaissement → ventilation → déverrouillage
  await page.goto('/demo/banque-virements');
  await page.getByTestId(`encaisser-${invoiceRef}`).click();
  await expect(page.getByTestId(`encaisser-${invoiceRef}`)).toHaveCount(0); // facture soldée : retirée de la liste
  await page.goto('/client/parc');
  await expect(page.locator('[data-device-status=VERROUILLE]')).toHaveCount(0);
  await expect(page.locator('[data-device-status=ACTIF]').first()).toBeVisible();
  await page.goto('/client/factures');
  await expect(page.locator('[data-invoice-status=IMPAYEE]')).toHaveCount(0);
  await page.goto('/demo/boite?a=admin%40teranga-demo.sn');
  await expect(page.getByTestId('inbox')).toContainText('Équipements déverrouillés');

  // Écart encaissé / ventilé = 0
  await switchTo(page, 'admin@solink.sn');
  await page.goto('/solink/facturation');
  await expect(page.getByTestId('ecart')).toHaveText('0 FCFA');
});
