# DECISIONS.md — choix faits pendant le build (sans interruption)

Format : date · question · choix · raison. Toutes les valeurs chiffrées sont **fictives (démo)**.

| Date | Question | Choix | Raison |
|---|---|---|---|
| 05/11/2026 | Docker indisponible dans l'environnement cloud | PostgreSQL 16 local (service apt déjà présent) ; `docker-compose.yml` fourni pour l'usage local | Les deux modes sont documentés dans le README |
| 05/11/2026 | `prisma migrate reset` est bloqué lorsqu'il est lancé par un agent | `pnpm db:reset` = script `packages/db/scripts/reset.ts` : `DROP SCHEMA public` + `prisma migrate deploy` + seed ; **refuse toute base non locale** (sauf `ALLOW_REMOTE_DB_RESET=true`) | Même sémantique (drop + migrate + seed), garde-fou explicite contre les bases distantes |
| 05/11/2026 | Montants en base | Entiers XOF (`Int`), calcul en `decimal.js`, arrondi HALF_UP à l'unité par composante et par poste ; capital social en `Float` (informatif, > INT4) | Somme des postes = total affiché, pas d'écart d'arrondi |
| 05/11/2026 | TVA par composante ou par ligne de facture ? | TVA calculée et arrondie **par composante et par poste**, sommée ensuite | Facture 2 lignes, ventilation et devis strictement cohérents |
| 05/11/2026 | Setup SOLINK et services SOLINK sur les accessoires ? | Uniquement sur les équipements (thin client, laptop, Mac) | Un écran ou un casque n'est ni enrôlé ni supporté comme poste |
| 05/11/2026 | VDI Orange | Uniquement sur les thin clients (Bureau cloud / Hybride) ; VDI Standard par défaut | v4 E06 : Bureau cloud = thin client + VDI |
| 05/11/2026 | Assurance sur les accessoires | Non par défaut (option) ; incluse par défaut sur les équipements | Simplicité |
| 05/11/2026 | Commission apporteur 3 % : quand et sur quoi ? | 3 % du montant financé, **mensualisée** sur la durée, prélevée sur la part loyer lors de la ventilation (Banque = loyer TTC − commission ; Orange = VDI + commission) ; reliquat d'arrondi sur la dernière échéance | Ventilation déterministe, somme ventilée = encaissé |
| 05/11/2026 | Ventilation d'un encaissement partiel | Au prorata du reste à ventiler de chaque composante, reliquat sur la première composante non soldée | Déterministe, écart encaissé/ventilé = 0 |
| 05/11/2026 | Référence commande | `CMD-AAAA-NNNNN` attribuée dès la création du panier (statut `PANIER`) | Une seule entité Commande porte tout le parcours (machine à états unifiée) |
| 05/11/2026 | Expiration de devis | Le devis passe `EXPIRE` à la date de validité ; la commande reste `DEVIS_EMIS` (réactualisation possible) et passe `EXPIRE` 30 j plus tard | v4 E12 : un devis expiré peut être réactualisé |
| 05/11/2026 | Gel du prix pendant l'instruction | `priceFrozenUntil` prolongé de 60 j à la soumission si le devis était valide | v4 §6.2 |
| 05/11/2026 | Liste blanche et checklist | Pour un client en liste blanche, l'exercice N-2 (et N-3) n'est pas demandé | v4 §7.3 « remplace une partie des pièces financières » |
| 05/11/2026 | Réutilisation de pièces (E18) | Une pièce `VALIDEE` encore valide d'un dossier précédent de la même organisation est reprise en `EN_VERIFICATION` | Renouvellement / extension de parc |
| 05/11/2026 | Grille de score : barèmes internes | Ancienneté ≥10 ans 15 / ≥5 10 / ≥2 5 ; CA ≥10 Md 15 / ≥2 Md 10 / ≥500 M 6 ; RN/CA ≥10 % 20 / ≥5 % 14 / ≥0 7 ; dettes/CP ≤0,5 15 / ≤1 10 / ≤2 5 ; loyers annuels/REX ≤10 % 20 / ≤20 % 14 / ≤35 % 7 ; BIC aucun 10 / mineur 4 ; Orange = score/20 | Grille 100 pts de CLAUDE.md §4, paliers fictifs |
| 05/11/2026 | Refus sur knock-out | Voie `REFUS_PROPOSE` : le dossier va à l'analyste qui confirme (pas de refus automatique) | v4 §7.6 |
| 05/11/2026 | Réservation d'enveloppe | Toute décision d'accord (auto ou analyste) réserve le montant ; consommation à la contre-signature ; libération à l'annulation / refus / expiration | v4 §7.5 |
| 05/11/2026 | Délégation (F04) | Analyste N1 ≤ 100 000 000 FCFA ; valideur N2 illimité | Valeur de démo |
| 05/11/2026 | Échantillonnage a posteriori | Déterministe : hash de la référence commande modulo 100 < 10 | Reproductible en démo |
| 05/11/2026 | Assurance émise (condition suspensive) | Émise automatiquement par l'assureur simulé à la contre-signature | Pas d'assureur réel au build |
| 05/11/2026 | Mandat de prélèvement actif | Signé dans la cérémonie ; **activé par la banque** (F07) | v4 §9.4 : propriétaire banque |
| 05/11/2026 | Webhooks e-sign | Le service de signature poste `signer_done` / `signature_request_done` (HMAC) sur `/api/webhooks/esign` ; si le serveur est injoignable (seed), traitement en ligne équivalent | Robustesse ; traitement idempotent |
| 05/11/2026 | Webhooks financeur | Tracés en base (`WebhookDelivery`) puis postés après commit sur `/api/demo/webhook-sink`, qui vérifie la signature HMAC + horodatage (anti-rejeu 5 min) | v4 §14.1 |
| 05/11/2026 | PV partiel / réserve bloquante | Réserve bloquante → ticket automatique ; le PV reste signé ; décaissement demandé quand tous les sites sont signés | v4 E23 (décaissement partiel : P2) |
| 05/11/2026 | Montant de la demande de décaissement | Somme des bases financées (matériel + logistique + setup + marge) | v4 §11.2 « matériel + setup » |
| 05/11/2026 | Données de démo Teranga « 1 facture impayée J+10 » | Les échéances tombent le 15 ; le seed décale la dernière facture pour qu'elle soit échue depuis exactement 10 jours à la date du seed | Rendre le scénario impayé reproductible quel que soit le jour du seed |
| 05/11/2026 | Levée du verrouillage | À la régularisation (plus aucune facture échue impayée), le déverrouillage MDM est exécuté et tracé automatiquement ; l'ordre passe `LEVE` | Annexe 4 : « levé dès régularisation » |
| 05/11/2026 | Pénalité de restitution | % de la grille A–E × prix d'achat résiduel = prix × mois restants / durée, plancher 20 % du prix d'achat | « prix d'achat résiduel » non défini dans la v4 |
| 05/11/2026 | pg-boss | File `scheduler-tick` (toutes les 5 min) lancée par `instrumentation.ts` ; le saut d'horloge exécute immédiatement `runScheduler()` ; tâches idempotentes (table `JobRun`) | Zéro infra en plus |
| 05/11/2026 | Listes « recherche, filtres, tri, pagination » | Filtrage en mémoire côté serveur (volumes de démo) via `components/list-view.tsx` | Simplicité ; pagination SQL en P2 |
| 05/11/2026 | API Financeur : identité de l'appelant | La clé `Bearer partner_demo_key` agit au nom du compte technique `api@banque-demo.sn` (rôles analyste + valideur + trésorerie) | Les décisions restent attribuées à la banque |
| 05/11/2026 | Cache du calcul de mensualité | Calcul serveur `/api/pricing` + cache mémoire côté client par combinaison d'options | v4 E08 (< 300 ms) |
