# CLAUDE.md — SOLINK DaaS : build autonome de bout en bout (addendum v4.1)

> Ce fichier complète `Specs_Plateforme_DaaS_SOLINK_v4.md` (spécification produit). Il fixe **tout ce qui était ouvert** pour qu'un agent de code puisse construire l'application **sans s'arrêter pour poser des questions**.
> Règle de priorité : en cas de conflit, **ce fichier l'emporte** sur la v4 pour les choix techniques et les valeurs de démonstration ; la v4 l'emporte pour le comportement métier.

---

## 1. Mission

Construire une application **web fonctionnelle de bout en bout** couvrant le parcours v4 §4 (étapes 1 à 9), utilisable en démo avec des **données fictives**, avec PostgreSQL. Toutes les intégrations externes sont **simulées** derrière des adaptateurs remplaçables.

**Définition de « terminé »** (toutes les cases doivent être vraies) :
1. `docker compose up -d && pnpm install && pnpm db:reset && pnpm dev` démarre l'application sur `http://localhost:3000` sans erreur.
2. Le test E2E `pnpm test:e2e` joue **le parcours complet** : connexion client → configuration → panier → devis → demande de financement → dossier complet → pré-contrôle SOLINK → décision banque (analyste) → signature client + contre-signature banque → conditions suspensives → achat → livraison → PV → demande de décaissement → paiement → contrat actif → facture Orange 2 lignes → encaissement ventilé. Il passe au vert.
3. Un second scénario E2E joue l'**accord automatique** dans l'enveloppe ; un troisième joue **pièce à reprendre** puis **pièces complémentaires** ; un quatrième joue **impayé → relances → verrouillage J+15 → régularisation** via l'horloge simulée.
4. `pnpm lint && pnpm typecheck && pnpm test` passent.
5. Chaque portail (Client, Back-office SOLINK, Financeur, Orange, Refinanceur lecture) est accessible via les comptes de démo §6 et montre des données cohérentes du seed.
6. `README.md` explique installation, comptes de démo, scénarios de démo pas à pas, et la liste des simulations.

---

## 2. Règles de conduite de l'agent (non négociables)

- **Ne jamais s'arrêter pour demander.** Si une information manque : choisir l'option la plus simple compatible avec la v4, l'écrire dans `DECISIONS.md` (date, question, choix, raison), continuer.
- Travailler **par jalons** (§9). À la fin de chaque jalon : lint, typecheck, tests, commit git (`feat(Jx): …`), mise à jour de `PROGRESS.md` (fait / reste / bugs connus).
- **Boucle de correction** : si un test échoue, corriger avant de passer au jalon suivant. Ne jamais désactiver un test pour le faire passer.
- Pas de dépendance à un service payant ou à une clé API. Aucune requête réseau externe à l'exécution.
- Aucun secret dans le code front ; variables dans `.env` (fournir `.env.example`).
- Tous les textes d'interface en **français**. Montants en **XOF entiers** (pas de décimales affichées), format `1 234 567 FCFA`. Dates `JJ/MM/AAAA`, fuseau `Africa/Dakar`.
- Données personnelles et entreprises du seed : **100 % fictives** (noms, NINEA, RCCM inventés et marqués « DÉMO »). Ne pas utiliser les vrais noms de banques : utiliser **« Banque Pilote (démo) »**. Orange Business et SOLINK peuvent être nommés.
- Garde-fous v4 §15 appliqués dans le code : aucun module ne crée d'ordre de paiement ; la décision de crédit n'est jamais prise par l'IA ; l'accord automatique n'exécute qu'une règle paramétrée par le financeur.

---

## 3. Stack imposée (plus aucune alternative)

| Couche | Choix | Pourquoi |
|---|---|---|
| Monorepo | **pnpm workspaces** : `apps/web`, `packages/db`, `packages/core`, `packages/adapters`, `packages/ui` | Un seul langage, un seul dépôt |
| Application | **Next.js 15 (App Router) + TypeScript strict**, Server Actions + Route Handlers pour l'API | Un seul déploiement pour les 5 portails |
| UI | **Tailwind CSS + shadcn/ui**, icônes lucide, graphiques Recharts | Rapide, cohérent |
| Base | **PostgreSQL 16** (docker compose) | Demandé |
| ORM | **Prisma** (schéma §5, migrations versionnées) | Typage bout en bout |
| Validation | **Zod** (schémas partagés front/back) | — |
| Jobs & minuteries | **pg-boss** (file de tâches dans Postgres) | Remplace Temporal/Redis pour le build : zéro infra en plus |
| Auth | Maison : OTP 6 chiffres + session cookie signée (iron-session) ; OTP visible dans la **Boîte de démo** (§7) | Remplace Keycloak au build |
| Autorisation | RBAC dans `packages/core/authz.ts` + filtrage systématique par `organisationId` / `financeurId` / `apporteurId` dans chaque requête | RLS Postgres en P2 |
| Fichiers | Stockage disque local `./storage` derrière l'interface `FileStore` (S3 en P2) | — |
| PDF | **@react-pdf/renderer** pour devis, contrat, annexes, PV, fiche synthèse, facture | Pas de Gotenberg au build |
| Zip DFS | `archiver` + SHA-256 (`node:crypto`) | — |
| Tests | **Vitest** (unitaires, règles métier) + **Playwright** (E2E) | — |
| Qualité | ESLint + Prettier + `tsc --noEmit` | — |
| Conteneurs | `docker-compose.yml` : `postgres`, `mailpit` (optionnel) | — |

Arborescence cible :
```
apps/web/app/
  (public)/            accueil, configurateur sans compte
  (auth)/connexion
  client/              Espace Client (E01–E24)
  solink/              Back-office (B01–B12)
  banque/              Portail Financeur (F01–F10)
  orange/              Portail Orange (O01–O05)
  refinanceur/         Lecture portefeuille
  demo/                Boîte de démo, horloge simulée, changement de compte
  api/partner/v1/...   API Financeur (§14.2 v4)
  api/webhooks/...     Webhooks simulés (e-sign, paiement)
packages/core/         machine à états, pricing, scoring, enveloppe, DFS, échéancier, ventilation, relances
packages/adapters/     interfaces + implémentations simulées
packages/db/           schema.prisma, seed.ts
```

---

## 4. Valeurs fixées pour la démo (remplacent les [À définir])

Toutes ces valeurs sont **fictives**, stockées en base (tables de paramètres versionnées), modifiables dans les portails, et affichées avec un badge « Valeur de démo ».

| Paramètre | Valeur démo |
|---|---|
| TVA | 18 % sur toutes les lignes (traitement fiscal réel : avis fiscaliste) |
| Durées autorisées | 24, 36 mois |
| Coefficients Banque Pilote (% mensuel de la base financée) | 24 mois : 4,95 · 36 mois : 3,55 (Essential/Pro/Premium identiques ; VR 0 %) |
| Marge SOLINK matériel | Essential 12 % · Pro 14 % · Premium 15 % |
| Frais logistique + douane | 4 % du prix d'achat |
| Setup SOLINK (Autopilot, étiquetage) | 15 000 FCFA HT / poste |
| Services SOLINK (support + MDM) | 6 500 FCFA HT / poste / mois |
| VDI Orange (Bureau cloud / Hybride) | Standard 12 000 · Performance 19 000 FCFA HT / poste / mois |
| Assurance | 1,2 % du prix d'achat / an, mensualisée |
| Dépôt de garantie | 1 mensualité TTC totale |
| Commission apporteur Orange | 3 % du montant financé (affichée uniquement côté Orange/SOLINK) |
| Validité devis | 15 jours |
| Validité accord | 60 jours |
| Seuil approbation interne client | 2 000 000 FCFA / mois (modifiable par l'admin client) |
| Enveloppe Banque Pilote | Total 500 000 000 FCFA · plafond/client 150 000 000 · fin dans 9 mois · alertes à 20 % et 10 % restants |
| Accord auto | Client en liste blanche **et** score ≥ 70 **et** montant ≤ plafond/client **et** aucun knock-out |
| Instruction analyste | Score 50–69, ou hors liste blanche |
| Knock-outs | Entreprise < 24 mois · incident BIC « grave » · secteur exclu (`JEUX_PARIS`) · BE non déclaré |
| Grille de score (100 pts) | Ancienneté 15 · Taille CA 15 · Rentabilité 20 · Endettement 15 · Couverture loyer 20 · BIC 10 · Historique Orange 5 |
| Échantillonnage accords auto | 10 % |
| Relances impayé | J+1 rappel · J+7 relance · J+15 proposition de verrouillage à la banque · J+30 mise en demeure · J+60 proposition de résiliation |
| Départ du loyer | 1er jour du mois suivant le dernier PV |
| Facture Orange | Émise le 1er du mois, échéance le 15 ; ligne 1 = loyer (pour compte banque), ligne 2 = services (SOLINK + Orange + assurance) |
| Ventilation cantonnement | Loyer → Banque ; VDI + commission → Orange ; services + assurance → SOLINK (l'assurance est reversée à l'assureur hors plateforme) |
| SLA démo | Ceux de la v4 §10.1 ; dossier analyste : 2 jours ouvrés |
| Grille de restitution A–E | A 0 % · B 5 % · C 15 % · D 40 % · E 100 % du prix d'achat résiduel (pénalité) |

Arrondis : calcul en `Decimal` (Prisma Decimal / decimal.js), arrondi à l'unité FCFA par ligne et par poste ; écart d'arrondi sur la dernière ligne.

---

## 5. Modèle de données (Prisma) — à implémenter tel quel puis compléter

Entités de la v4 §13.2, avec ces **enums obligatoires** :

```prisma
enum OrderStatus { PANIER DEVIS_EMIS APPROBATION_INTERNE DEVIS_ACCEPTE DOSSIER_EN_COURS PRE_CONTROLE
  DOSSIER_A_REPRENDRE TRANSMIS_FINANCEUR EN_ANALYSE PIECES_COMPLEMENTAIRES ACCORDE ACCORDE_SOUS_CONDITIONS
  REFUSE OFFRE_EMISE SIGNATURE_CLIENT CONTRESIGNATURE CONDITIONS_SUSPENSIVES PRET_POUR_ACHAT ACHETE
  EN_PREPARATION EXPEDIE PV_A_SIGNER DECAISSEMENT_DEMANDE ACTIF FIN_DE_CONTRAT CLOS ANNULE EXPIRE ECHEC }
enum DocStatus { A_FOURNIR EN_VERIFICATION VALIDEE A_REPRENDRE EXPIREE NON_APPLICABLE }
enum Segment { GRANDE_ENTREPRISE PME INSTITUTION_FINANCIERE PUBLIC ONG }
enum Offer { BUREAU_CLOUD POSTE_MOBILE HYBRIDE }
enum Range { ESSENTIAL PRO PREMIUM }
enum DecisionResult { ACCORDE ACCORDE_SOUS_CONDITIONS REFUSE PIECES_COMPLEMENTAIRES SANS_SUITE }
enum ConditionType { DEPOT_MAJORE CAUTION_DIRIGEANT DUREE_MAX MONTANT_MAX PIECE_A_FOURNIR_AVANT_SIGNATURE GARANTIE_TIERS AUTRE }
enum ConditionNature { PREALABLE SUSPENSIVE }
enum DeviceStatus { COMMANDE EN_TRANSIT EN_STOCK ENROLE LIVRE ACTIF VERROUILLE EN_SAV RETOURNE GRADE RECONDITIONNE REVENDU REDEPLOYE RECYCLE }
enum Grade { A B C D E }
enum DisbursementStatus { DEMANDEE VALIDEE PAYEE REJETEE }
enum InvoiceStatus { EMISE PAYEE PARTIELLE IMPAYEE AVOIR }
enum Role { CLIENT_ADMIN CLIENT_SIGNATAIRE CLIENT_FINANCE CLIENT_APPROBATEUR CLIENT_RECEPTION CLIENT_EMPLOYE
  SOLINK_COMMERCIAL SOLINK_CHARGE_DOSSIER SOLINK_ACHATS SOLINK_LOGISTIQUE SOLINK_MDM SOLINK_SUPPORT SOLINK_FINANCE SOLINK_ADMIN
  BANQUE_ANALYSTE BANQUE_VALIDEUR BANQUE_TRESORERIE BANQUE_RISK ORANGE_COMMERCIAL ORANGE_FACTURATION REFINANCEUR_LECTURE AUDITEUR }
```

Tables supplémentaires nécessaires au build et absentes de la v4 :
- `StatusTransition` (orderId, from, to, actorId, reason, at, prevHash, hash) — journal chaîné.
- `AuditEvent` (entity, entityId, action, actorId, payloadHash, prevHash, hash, at).
- `Notification` (destinataire, canal SMS/WHATSAPP/EMAIL, modèle, corps, lu, at) — alimente la Boîte de démo.
- `Parameter` (clé, valeur JSON, version, effectiveFrom, ownerType BANQUE/SOLINK) — valeurs §4.
- `SimClock` (offsetDays) — horloge simulée §7.
- `Job` géré par pg-boss.

La **machine à états** vit dans `packages/core/order-machine.ts` : table des transitions autorisées (from, to, rôle(s) autorisé(s), garde), une fonction unique `transition(orderId, to, actor, reason)` ; aucun `UPDATE status` ailleurs (règle lint ou test qui le vérifie).

---

## 6. Données de démonstration (seed)

`pnpm db:reset` = drop + migrate + seed déterministe (graine fixe).

**Organisations partenaires** : SOLINK (opérateur) · Orange Business Sénégal (apporteur) · **Banque Pilote (démo)** (financeur) · **Fonds Refi Démo** (refinanceur, ligne 300 000 000 FCFA, éligibilité : grandes entreprises et institutions financières).

**Clients fictifs (5)** :
| Nom | Segment | Liste blanche | Situation dans le seed |
|---|---|---|---|
| Assurances Teranga Démo SA | Grande entreprise | Oui | Contrat **actif** 30 postes PM Pro, 3 sites, 4 factures dont 1 impayée J+10 |
| Microfinance Baobab Démo | Institution financière | Oui | Dossier **en cours** (bloc Finances incomplet) |
| ONG Sahel Santé Démo | ONG | Non | Dossier **en analyse** chez la banque, 1 demande de pièces |
| PME Logistique Ndar Démo | PME | Non | **Devis émis**, non accepté |
| Call Center Atlantique Démo | Grande entreprise | Oui | **Signature en cours** : 40 Bureau cloud t640 + VDI |

**Catalogue (≥ 36 références)** : thin clients (t430, t540, t640, t740, mt32, mt45), laptops Essential/Pro/Premium (3 marques génériques par gamme : « Lenovo ThinkPad E14 », « Dell Pro 14 », « HP EliteBook 640 »…), MacBook Air/Pro, écrans 24/27, docks, casques, sacoches. Prix d'achat fictifs plausibles en FCFA ; images = illustrations SVG génériques générées (pas de photos de marques).

**Comptes de démo** (OTP toujours accepté : `000000` en mode démo, en plus de l'OTP réel affiché dans la Boîte de démo) :
| Identifiant | Rôle |
|---|---|
| admin@teranga-demo.sn | Client admin + signataire (Teranga) |
| daf@teranga-demo.sn | Client finance |
| dg@callcenter-demo.sn / dga@callcenter-demo.sn | Signataires conjoints (Call Center) |
| reception@teranga-demo.sn | Réceptionnaire site |
| dossier@solink.sn | Chargé de dossier SOLINK |
| ops@solink.sn | Achats + logistique + MDM |
| admin@solink.sn | Admin SOLINK |
| analyste@banque-demo.sn / valideur@banque-demo.sn / tresorerie@banque-demo.sn | Banque |
| commercial@orange-demo.sn / facturation@orange-demo.sn | Orange |
| refi@fonds-demo.org | Refinanceur |

Plus : un **sélecteur de compte** en barre supérieure en mode démo (`DEMO_MODE=true`) pour basculer d'un rôle à l'autre sans se reconnecter.

Pièces justificatives de démo : PDF générés (« DOCUMENT FICTIF — DÉMO ») pour chaque type de la checklist.

---

## 7. Simulations (adaptateurs) — interface réelle + implémentation simulée

Chaque adaptateur a une interface dans `packages/adapters/<nom>/index.ts`, une implémentation `sim` utilisée par défaut, et un emplacement `real` vide (P2).

| Adaptateur | Simulation |
|---|---|
| `Messaging` (SMS, WhatsApp, email) | Écrit dans `Notification` ; page **/demo/boite** affiche les messages par destinataire, liens cliquables |
| `ESign` | Page de signature interne `/signer/[token]` : affichage des PDF, OTP, bouton « Signer » ; génère un PDF signé (tampon + horodatage + hash) et un **dossier de preuve** JSON ; émet les webhooks `signer_done` / `signature_request_done` sur `/api/webhooks/esign` |
| `Ocr` | Renvoie des champs extraits plausibles selon le type de pièce + score de confiance ; le client confirme |
| `CreditBureau` (BIC) | Réponse déterministe par NINEA (table de seed) : `AUCUN_INCIDENT`, `INCIDENT_MINEUR`, `INCIDENT_GRAVE` |
| `OrangeHistory` | Score de paiement 0–100 par NINEA (seed) |
| `FinancerTransport` | Portail (natif) + **SFTP simulé** : écrit le zip DFS dans `./storage/sftp/out/` et lit les décisions CSV dans `./storage/sftp/in/` |
| `Payments` | Page `/demo/banque-virements` : la « banque » confirme le dépôt reçu, le paiement de SOLINK, et les encaissements clients ; génère un relevé CSV de cantonnement |
| `OrangeBilling` | Job mensuel qui génère les factures 2 lignes (PDF) + **export CSV** au format défini dans `docs/format_orange.md` |
| `Distributor` | Génération du BC PDF ; bouton « Simuler la réception » qui crée les numéros de série et les hash Autopilot fictifs |
| `Mdm` | Statuts d'enrôlement simulés ; actions verrouiller/déverrouiller/effacer journalisées, exécutées seulement après ordre banque |
| `Llm` | Implémentation **déterministe** (modèles de texte) pour la synthèse analyste et les messages ; interface prête pour un vrai LLM en P2 |

**Horloge simulée** : page `/demo/horloge` pour avancer de N jours ; tous les calculs de dates (échéances, SLA, relances, validité) passent par `core/clock.ts`. Les jobs pg-boss dus sont exécutés immédiatement après un saut d'horloge.

---

## 8. Ce que le build doit couvrir (périmètre fermé)

**Inclus** : tout le MVP v4 §19.1 + Portail Refinanceur en lecture (portefeuille éligible, export CSV) + API Financeur `/api/partner/v1` (§14.2 v4, auth par clé de démo `Bearer partner_demo_key`, Idempotency-Key, webhooks signés HMAC vers une URL de test interne `/api/demo/webhook-sink` visible dans /demo) + cycle impayé/verrouillage + restitution A–E en fin de contrat (simulable via horloge).

**Exclu du build** (ne pas implémenter, mentionner dans README) : SSO, Wave/OM réels, HRIS, marketplace recond, ESG, multi-financeurs actif (le modèle de données le supporte, une seule banque seedée), anglais, Wolof, vraie IA générative.

---

## 9. Jalons (ordre imposé)

| # | Jalon | Critère de sortie |
|---|---|---|
| J0 | Socle : monorepo, docker compose, Prisma, auth OTP, sélecteur démo, layout des 5 portails, Boîte de démo, horloge, audit chaîné | Connexion de chaque compte démo → bon portail |
| J1 | Catalogue, configurateur, moteur de prix (tests unitaires exhaustifs), packs, panier multi-sites, devis PDF versionné, approbation interne | Mensualité recalculée correctement (tests sur 10 cas) |
| J2 | Commande + consentements + dossier 5 blocs + checklist dynamique + upload + OCR sim + statuts pièces + pré-contrôle SOLINK | Dossier soumis scellé (DFS v1 avec manifest SHA-256) |
| J3 | Scoring, enveloppe (réservation/consommation/libération), accord auto, Portail Financeur F01–F05, F09, demande de pièces, DFS v2 + diff, SFTP sim, API Financeur | Scénarios E2E « accord auto » et « pièces complémentaires » verts |
| J4 | Génération du pack contractuel, cérémonie e-sign sim (ordre, signature conjointe, contre-signature), mandat, dépôt, conditions suspensives | Impossible d'acheter avant levée (test) |
| J5 | Achats, réception et séries, préparation, livraison multi-sites, PV numérique, demande de décaissement, paiement | Contrat ACTIF après paiement ; annexe 1 mise à jour |
| J6 | Échéancier, factures Orange 2 lignes, export CSV, encaissements, ventilation, relances, ordre de verrouillage banque → exécution MDM, régularisation | Scénario E2E impayé vert ; écart facturé/encaissé/ventilé = 0 |
| J7 | Espace parc client, tickets, fin de contrat + restitution A–E + pénalités, Portail Orange (leads, apports, commissions), Portail Refinanceur, tableaux de bord F10 / B01 | Tous les portails peuplés et cohérents |
| J8 | Durcissement : E2E parcours complet, accessibilité de base, responsive mobile (360 px), états vides, erreurs, README, DECISIONS, PROGRESS | Définition de « terminé » §1 entièrement vraie |

---

## 10. Exigences UX à respecter pendant le build

- Espace Client : en-tête avec **« Prochaine action »** unique (v4 §4.3) ; frise de statut de la commande ; mensualité toujours visible dans le configurateur et le panier.
- Mobile d'abord pour les écrans client (E02–E23) ; portails banque/SOLINK optimisés desktop (tableaux filtrables).
- Chaque liste a : recherche, filtres, tri, état vide, pagination.
- Chaque action irréversible (décision, signature, ordre de verrouillage) : écran de confirmation + motif.
- Identité visuelle neutre et professionnelle (pas de logos officiels Orange/banque) ; couleur principale SOLINK paramétrable dans `packages/ui/theme.ts`.

---

## 11. Prompt de lancement (à coller dans Claude Code)

```
Lis CLAUDE.md puis Specs_Plateforme_DaaS_SOLINK_v4.md en entier.
Construis l'application de bout en bout en suivant les jalons J0 à J8 de CLAUDE.md, sans t'arrêter pour poser de questions :
consigne tes choix dans DECISIONS.md, ta progression dans PROGRESS.md, commite à chaque jalon.
Ne considère le travail terminé que lorsque la "Définition de terminé" (§1) est entièrement vraie, tests E2E verts.
```
