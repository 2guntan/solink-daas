# PROGRESS.md — avancement du build SOLINK DaaS

## Fait
- **J0** Socle : monorepo pnpm (apps/web, packages/db|core|adapters|ui), Prisma (schéma complet v4 §13 + enums CLAUDE.md §5), PostgreSQL 16, auth OTP + session iron-session, sélecteur de compte démo, layout des 5 portails, Boîte de démo, horloge simulée, audit chaîné (vérifiable sur /demo).
- **J1** Catalogue 36 références, configurateur (mensualité serveur temps réel), moteur de prix (12 tests), packs, panier multi-sites, devis PDF versionné, approbation interne.
- **J2** Commande + consentements horodatés, dossier 5 blocs, checklist dynamique par segment, upload + OCR simulé, contrôles de validité (RCCM > 3 mois), statuts de pièces, pré-contrôle SOLINK (services + seed), DFS scellé (manifest SHA-256, zip, SFTP simulé).
- Services métier J3–J7 implémentés dans `packages/core/src/services` et exercés par le seed (accord auto, signature, PV, décaissement, facturation, relances).

## Reste
- Portails Back-office SOLINK, Financeur, Orange, Refinanceur (UI), API Financeur, pg-boss, E2E.

## Bugs connus
- Aucun à ce stade.
