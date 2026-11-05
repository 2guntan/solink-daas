# PROGRESS.md — avancement du build SOLINK DaaS

Dernière mise à jour : 05/11/2026.

## Fait
- **J0 — Socle** : monorepo pnpm (`apps/web`, `packages/db|core|adapters|ui`), Prisma (schéma v4 §13 + enums CLAUDE.md §5 + tables StatusTransition, AuditEvent, Notification, Parameter, SimClock, JobRun…), PostgreSQL 16 (docker compose ou local), auth OTP + session iron-session, sélecteur de compte démo, 5 portails, Boîte de démo, horloge simulée, audit chaîné vérifiable.
- **J1 — Catalogue & prix** : 36 références, configurateur avec mensualité serveur temps réel (`/api/pricing`), moteur coefficient × base financée (12 tests unitaires), packs, panier multi-sites, devis PDF versionné (`DV-AAAA-NNNNN-vN`), validité 15 j, réactualisation, approbation interne (seuil 2 M).
- **J2 — Dossier** : demande de financement (consentements horodatés IP/UA/version), dossier 5 blocs, checklist dynamique par segment (+ liste blanche), upload fichier ou pièce de démo, OCR simulé, contrôle de validité (RCCM > 3 mois), statuts de pièces, réutilisation des pièces valides, pré-contrôle SOLINK (B02), DFS scellé (zip, manifest SHA-256, SFTP simulé).
- **J3 — Financeur** : scoring 100 pts paramétré, knock-outs, voies AUTO / ANALYSTE / REFUS_PROPOSE, enveloppe (réservation / consommation / libération, alertes 20 %/10 %), accord auto (règle versionnée + échantillonnage 10 %), Portail Financeur F01–F05, F09, demande de pièces, DFS v2 + différentiel, import décisions SFTP, API Financeur `/api/partner/v1` (clé démo, Idempotency-Key, webhooks HMAC vers `/api/demo/webhook-sink`).
- **J4 — Contrat & signature** : pack contractuel (CGL, conditions particulières, annexes 1–6, mandats), cérémonie e-sign simulée (ordre, pouvoirs validés, signature conjointe, contre-signature banque après la dernière signature client, webhooks e-sign, PDF signés + dossier de preuve), mandat, dépôt vers le compte banque, conditions suspensives ; achat refusé avant levée (`CONDITIONS_SUSPENSIVES_NON_LEVEES`).
- **J5 — Livraison** : BC distributeur PDF, réception simulée (séries + hash Autopilot, propriétaire = banque, enrôlement MDM), créneaux, expédition, PV numérique par site (OTP, réserves, ticket si bloquante), demande de décaissement automatique (facture SOLINK, PV, séries, photos, annexe 1 mise à jour), validation / paiement banque → contrat ACTIF.
- **J6 — Vie du contrat** : échéancier (départ au 1er du mois suivant le dernier PV), factures Orange 2 lignes (PDF) + export CSV, encaissements et ventilation déterministe (Banque / Orange / SOLINK, écart = 0), relances J+1/7/15/30/60, proposition de verrouillage J+15 → ordre banque → exécution MDM → régularisation et déverrouillage.
- **J7 — Portails** : parc client, tickets, fin de contrat + restitution A–E + pénalités, Portail Orange (leads + invitation pré-remplie, apports sans pièces, commissions, export), Portail Refinanceur (portefeuille éligible, CSV), tableaux de bord F01/F10/B01 (Recharts), pg-boss (`scheduler-tick`).
- **J8 — Durcissement** : 4 scénarios E2E Playwright, listes avec recherche / filtres / tri / pagination / états vides, pages d'erreur, responsive mobile, README, DECISIONS.

## Vérifications (définition de « terminé »)
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (35 tests unitaires) : verts.
- `pnpm test:e2e` : **4/4 verts** — impayé → relances → verrouillage J+15 → régularisation ; accord automatique ; pièce à reprendre + pièces complémentaires (DFS v2 + différentiel) ; parcours complet (connexion → … → facture Orange 2 lignes → encaissement ventilé, écart 0).
- Les 5 portails sont peuplés par le seed ; README complet (installation Docker / Postgres local, comptes, scénarios pas à pas, simulations).

## Reste
- Rien dans le périmètre §8. Pistes P2 : RLS PostgreSQL, pagination SQL, décaissement partiel, adaptateurs réels.

## Bugs connus / limites
- Filtrage des listes en mémoire (volumes de démo) ; RLS PostgreSQL en P2 (cloisonnement appliqué dans chaque requête).
- Décaissement partiel par site non géré (décaissement au dernier PV).
- `prisma migrate reset` étant bloqué pour les agents, `pnpm db:reset` utilise un script dédié limité aux bases locales.
