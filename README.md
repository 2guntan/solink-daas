# SOLINK DaaS — plateforme de démonstration (MVP v4)

Postes de travail managés, **financés par une banque**, commandés **en ligne et sans papier** : catalogue → devis → demande de financement → dossier de crédit → décision banque → e-signature → achat → livraison/PV → décaissement → facture Orange 2 lignes → cantonnement → relances / verrouillage → restitution A–E.

> **Démonstration uniquement.** Toutes les organisations, personnes, NINEA/RCCM, prix et paramètres sont **fictifs** (marqués « DÉMO »). « Banque Pilote (démo) » n'est pas une vraie banque. Toutes les intégrations externes sont **simulées**. Aucune requête réseau externe à l'exécution.

Spécification produit : [`Specs_Plateforme_DaaS_SOLINK_v4.md`](Specs_Plateforme_DaaS_SOLINK_v4.md) · addendum de build : [`CLAUDE.md`](CLAUDE.md) · choix : [`DECISIONS.md`](DECISIONS.md) · avancement : [`PROGRESS.md`](PROGRESS.md).

---

## 1. Installation

Prérequis : **Node.js 20+** (testé en 22), **pnpm 10**, **PostgreSQL 16** (Docker ou local).

### Mode A — Docker Compose (recommandé en local)

```bash
cp .env.example .env
```

```bash
docker compose up -d
```

```bash
pnpm install && pnpm db:reset && pnpm dev
```

L'application est servie sur **http://localhost:3000**. `docker-compose.yml` lance `postgres:16` (et `mailpit`, optionnel : `docker compose --profile mail up -d`).

### Mode B — PostgreSQL local (sans Docker, ex. environnement cloud)

```bash
sudo apt-get install -y postgresql-16
```

```bash
sudo service postgresql start
```

```bash
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" -c "CREATE DATABASE solink_daas;"
```

```bash
cp .env.example .env && pnpm install && pnpm db:reset && pnpm dev
```

`DATABASE_URL` par défaut : `postgresql://postgres:postgres@localhost:5432/solink_daas?schema=public`.

### Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur Next.js (port 3000) + file de tâches pg-boss |
| `pnpm db:reset` | Drop du schéma + migrations Prisma + seed déterministe. **Refuse toute base non locale** (garde-fou, cf. DECISIONS.md) |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | ESLint · `tsc --noEmit` (tous les paquets) · Vitest (règles métier) |
| `pnpm test:e2e` | `db:reset` puis Playwright (build de production sur le port 3100, 4 scénarios) |

Playwright utilise le Chromium installé (`PLAYWRIGHT_BROWSERS_PATH`) ; sinon : `pnpm exec playwright install chromium`.

### Variables (`.env.example`)

`DATABASE_URL`, `SESSION_SECRET`, `DEMO_MODE` (sélecteur de compte, OTP `000000`, pages `/demo`), `STORAGE_DIR` (fichiers, `./storage`), `PARTNER_API_KEY` (`partner_demo_key`), `WEBHOOK_SECRET`, `APP_URL`. Optionnel : `PGBOSS_DISABLED=true`.

---

## 2. Architecture

```
apps/web/              Next.js 15 (App Router) — 5 portails + API
  app/(public)         accueil E01, configurateur sans compte E06–E08
  app/(auth)/connexion OTP sans mot de passe E02
  app/client           Espace Client E03–E24
  app/solink           Back-office B01–B12
  app/banque           Portail Financeur F01–F10
  app/orange           Portail Orange O01–O05
  app/refinanceur      Portefeuille refinancé (lecture + export CSV)
  app/signer/[token]   Page de signature du prestataire e-sign simulé
  app/demo             Boîte de démo, horloge simulée, virements banque, webhooks
  app/api/partner/v1   API Financeur (v4 §14.2)
  app/api/webhooks     Webhooks e-sign simulés
packages/core          machine à états, prix, scoring, enveloppe, DFS, échéancier, ventilation, relances, PDF, services
packages/adapters      interfaces + implémentations simulées (Messaging, ESign, Ocr, BIC, OrangeHistory, SFTP, Payments, OrangeBilling, Distributor, Mdm, Llm, FileStore)
packages/db            schema.prisma, migrations, seed.ts, script de reset
packages/ui            composants Tailwind façon shadcn/ui, thème (couleur SOLINK dans packages/ui/theme.ts)
e2e/                   scénarios Playwright
```

Garde-fous v4 §15 appliqués dans le code :
- **aucun ordre de paiement** n'est créé : la plateforme reçoit des *confirmations* de la banque (`/demo/banque-virements`, Portail Financeur, API) ;
- la **décision de crédit** est prise par la banque (portail/API/SFTP) ; l'IA (déterministe) ne fait que synthétiser ;
- l'**accord automatique** exécute une règle paramétrée par le financeur (liste blanche, score, plafond, knock-outs) et référence sa version dans l'audit ;
- `Order.status` n'est modifié **que** par `packages/core/src/order-machine.ts` (un test le vérifie) ;
- journal d'**audit chaîné** (SHA-256) vérifiable sur `/demo` et `/solink/admin` ; transitions de commande chaînées.

---

## 3. Comptes de démo

Connexion sur `/connexion` : saisir l'email, **code `000000`** (toujours accepté en mode démo ; le vrai code est aussi visible dans la **Boîte de démo**). En mode démo, le **sélecteur de compte** de la barre jaune permet de basculer sans se reconnecter.

| Identifiant | Rôle | Portail |
|---|---|---|
| `admin@teranga-demo.sn` | Client admin + signataire (Assurances Teranga) | Client |
| `daf@teranga-demo.sn` | Responsable financier (Teranga) | Client |
| `approbateur@teranga-demo.sn` | Approbateur interne (Teranga) | Client |
| `reception@teranga-demo.sn` | Réceptionnaire site (Teranga) | Client |
| `employe@teranga-demo.sn` | Employé (Teranga) | Client |
| `dg@callcenter-demo.sn` / `dga@callcenter-demo.sn` | Signataires conjoints (Call Center) | Client |
| `admin@baobab-demo.sn`, `daf@baobab-demo.sn` | Microfinance Baobab | Client |
| `admin@sahel-demo.sn` | ONG Sahel Santé | Client |
| `admin@ndar-demo.sn` | PME Logistique Ndar (admin, signataire, finance, réception) | Client |
| `dossier@solink.sn` | Chargé de dossier SOLINK | Back-office |
| `ops@solink.sn` | Achats + logistique + MDM + support | Back-office |
| `finance@solink.sn` | Finance SOLINK | Back-office |
| `admin@solink.sn` | Admin SOLINK | Back-office |
| `analyste@banque-demo.sn` | Analyste crédit (délégation N1 ≤ 100 M) | Financeur |
| `valideur@banque-demo.sn` | Valideur N2 + risk (contre-signature) | Financeur |
| `tresorerie@banque-demo.sn` | Trésorerie (décaissements) | Financeur |
| `commercial@orange-demo.sn` / `facturation@orange-demo.sn` | Orange Business | Orange |
| `refi@fonds-demo.org` | Fonds Refi Démo | Refinanceur |

API Financeur : `Authorization: Bearer partner_demo_key` (compte technique `api@banque-demo.sn`).

### Situation du seed (`pnpm db:reset`)

| Client | Segment | Liste blanche | Situation |
|---|---|---|---|
| Assurances Teranga Démo SA | Grande entreprise | Oui | Contrat **actif** 30 postes Poste mobile Pro sur 3 sites, 4 factures dont **1 impayée J+10** (relances J+1/J+7 envoyées), 2 tickets |
| Microfinance Baobab Démo | Institution financière | Oui | Dossier **en cours** (bloc Finances incomplet, 5 pièces fournies) |
| ONG Sahel Santé Démo | ONG | Non | **En analyse** chez la banque après **1 demande de pièces** (relevés fournis → DFS v2 avec différentiel) |
| PME Logistique Ndar Démo | PME | Non | **Devis émis**, non accepté |
| Call Center Atlantique Démo | Grande entreprise | Oui | **Signature en cours** : 40 Bureau cloud t640 + VDI, le DG a signé, la DGA doit signer (signature conjointe) |

Plus : catalogue de 36 références, enveloppe Banque Pilote 500 M FCFA (plafond 150 M/client, échéance à 9 mois, alertes 20 %/10 %), ligne Fonds Refi Démo 300 M (GE + institutions financières), 2 packs, 2 leads Orange.

---

## 4. Scénarios de démo pas à pas

### A. Parcours complet avec décision analyste (≈ 10 min)
1. **Client** — se connecter en `admin@ndar-demo.sn` → *Catalogue* → « Lenovo ThinkPad T14 » → choisir quantité et site → *Ajouter au panier* (la mensualité se recalcule à chaque option). Ajouter un thin client t640 sur l'autre site.
2. *Panier* → **Émettre le devis** (PDF `DV-AAAA-NNNNN-v1`) → **Accepter le devis** → cocher les 3 consentements → **Demander le financement**.
3. *Dossier* : **Joindre toutes les pièces de démo** (ou téléverser un PDF/une photo), compléter le bloc Finances (3 exercices pour une PME), certifier l'exactitude → **Soumettre le dossier**.
4. **SOLINK** (`dossier@solink.sn`) → *Pipeline* → la commande → **Valider toutes les pièces** → **Terminer le pré-contrôle** : scoring, DFS v1 scellé (zip + manifest SHA-256, copie dans `./storage/sftp/out/`), voie *analyste*.
5. **Banque** (`analyste@banque-demo.sn`) → *File d'instruction* → dossier : fiche de synthèse, score et facteurs, pièces, DFS → **Accuser réception** → **Enregistrer la décision** (écran de confirmation + motif interne).
6. **Client** → *Contrat et signature* → **Commencer la signature** → page du prestataire simulé : cocher, OTP `000000`, **Signer**.
7. **Banque** (`valideur@banque-demo.sn`) → dossier → **Contre-signer** → signer. PDF signés + dossier de preuve générés.
8. **SOLINK** (`ops@solink.sn`) → *Achats* → tenter d'émettre le BC : refusé (`CONDITIONS_SUSPENSIVES_NON_LEVEES`).
9. **Banque** (valideur) → **Confirmer le dépôt reçu** + **Activer le mandat** → *Prêt pour achat* (ou `/demo/banque-virements`).
10. **SOLINK** (ops) → **Émettre le BC** → **Simuler la réception** (séries + hash Autopilot, enrôlement MDM) → *Livraisons* → **Expédier** → **Marquer livré** pour chaque site.
11. **Client** → *Livraisons* → signer chaque PV (OTP `000000`). Au dernier PV : demande de décaissement automatique (facture SOLINK, PV, séries, photos, annexe 1 mise à jour).
12. **Banque** (`tresorerie@banque-demo.sn`) → *Décaissements* → **Valider** → **Confirmer le paiement** → contrat **ACTIF**, échéancier créé (départ au 1er du mois suivant le dernier PV).
13. *Horloge simulée* → avancer jusqu'au 1er du mois suivant → facture Orange **2 lignes** (loyer pour compte de la banque / services) dans *Factures*.
14. `/demo/banque-virements` → **Encaisser** → ventilation Banque / Orange / SOLINK ; *SOLINK → Facturation* : écart encaissé/ventilé = **0 FCFA**.

### B. Accord automatique (≈ 3 min)
`admin@teranga-demo.sn` → commander 2 « Lenovo ThinkPad E14 » → devis → accepter → financement → *Joindre toutes les pièces de démo* (les pièces encore valides du dossier précédent et les agrégats financiers sont **réutilisés**) → certifier → soumettre. `dossier@solink.sn` → valider → terminer le pré-contrôle : **accord automatique** (liste blanche + score ≥ 70 + plafond + aucun knock-out), règle `BANQUE_PILOTE-ACCORD-AUTO-v1` tracée, enveloppe réservée, offre émise. 10 % des accords auto sont échantillonnés pour contrôle a posteriori.

### C. Pièce à reprendre puis pièces complémentaires (≈ 5 min)
`admin@ndar-demo.sn` → nouvelle commande → dossier → sur l'extrait RCCM, **Pièce de démo périmée** : statut *À reprendre*, motif « Extrait de plus de 3 mois », WhatsApp dans la Boîte de démo, bouton *Soumettre* inactif. Joindre les pièces, soumettre. `dossier@solink.sn` → *À reprendre* sur les statuts (motif) → terminer → le client reprend la pièce et re-soumet → SOLINK valide → transmis. `analyste@banque-demo.sn` → **Demande de pièces** (ex. caution) → le client la fournit → **DFS v2** dont le manifest référence le hash du v1 ; la banque voit le différentiel.

### D. Impayé → relances → verrouillage J+15 → régularisation (≈ 3 min)
`daf@teranga-demo.sn` → *Factures* : une facture impayée (J+10), relances J+1/J+7 dans la Boîte de démo. `/demo/horloge` → **+5 jours** : relance J+15 = **proposition de verrouillage** à la banque. `valideur@banque-demo.sn` → *Impayés & verrouillages* → **Ordonner le verrouillage** (motif). `ops@solink.sn` → *Parc & MDM* → **Exécuter le verrouillage MDM** (impossible sans ordre banque). Le client voit ses postes *Verrouillés*. `/demo/banque-virements` → **Encaisser** : régularisation, déverrouillage tracé, écart = 0.

Autres démonstrations : approbation interne (seuil 2 M FCFA/mois, `approbateur@teranga-demo.sn`), signature conjointe Call Center (`dga@callcenter-demo.sn` signe → la banque est notifiée), portail Orange (lead + invitation pré-remplie, apports sans pièces, commissions, export CSV), refinanceur (portefeuille éligible + CSV), fin de contrat et restitution A–E (avancer l'horloge au-delà de la date de fin, puis *Parc & MDM → Restitution*), API Financeur :

```bash
curl -H "Authorization: Bearer partner_demo_key" http://localhost:3000/api/partner/v1/financing-requests?status=TRANSMITTED
```

```bash
curl -X POST -H "Authorization: Bearer partner_demo_key" -H "Idempotency-Key: demo-1" -H "Content-Type: application/json" -d '{"result":"APPROVED","amount_approved_xof":7668960,"duration_months":36,"internal_reason_code":"OK"}' http://localhost:3000/api/partner/v1/financing-requests/FR-2026-00003/decision
```

Décisions par fichier (SFTP simulé) : déposer un CSV `financing_request;result;amount_xof;duration_months;valid_until;internal_reason` dans `./storage/sftp/in/`, puis *Portail Financeur → Paramétrage → Importer les décisions SFTP*.

---

## 5. Simulations (adaptateurs)

Chaque adaptateur a une interface dans `packages/adapters/src/<nom>/index.ts`, une implémentation simulée utilisée par défaut et un emplacement `real.ts` vide (P2).

| Adaptateur | Simulation |
|---|---|
| `Messaging` (SMS, WhatsApp, email) | Écrit dans `Notification` ; **/demo/boite** affiche les messages par destinataire et canal, liens cliquables ; modèles pré-approuvés uniquement |
| `ESign` | Page interne `/signer/[token]` (documents, ordre des signataires, OTP) ; PDF signés (tampons + horodatage + hash) ; dossier de preuve JSON ; webhooks `signer_done` / `signature_request_done` signés HMAC sur `/api/webhooks/esign` |
| `Ocr` | Champs extraits plausibles par type de pièce + score de confiance ; le client confirme |
| `CreditBureau` (BIC) | Réponse déterministe par NINEA (`AUCUN_INCIDENT`, `INCIDENT_MINEUR`, `INCIDENT_GRAVE`) |
| `OrangeHistory` | Score de paiement 0–100 par NINEA |
| `FinancerTransport` | Portail natif + SFTP simulé : zip DFS + accusé dans `./storage/sftp/out/`, décisions CSV lues dans `./storage/sftp/in/` |
| `Payments` | `/demo/banque-virements` : la « banque » confirme dépôt, paiement de SOLINK et encaissements ; relevé CSV de cantonnement |
| `OrangeBilling` | Job mensuel : factures 2 lignes (PDF) + export CSV ([`docs/format_orange.md`](docs/format_orange.md)) |
| `Distributor` | BC PDF ; « Simuler la réception » crée les séries et hash Autopilot fictifs |
| `Mdm` | Enrôlement simulé ; verrouiller / déverrouiller / effacer journalisés, verrouillage seulement après ordre banque |
| `Llm` | Modèles de texte déterministes (fiche de synthèse analyste, assistant « Aidez-moi à choisir ») |
| `FileStore` | Disque local `./storage` (S3 en P2) |

**Horloge simulée** : `/demo/horloge` avance de N jours ; tous les calculs de dates passent par `packages/core/src/clock.ts` ; les tâches dues (factures, relances, SLA, expirations, fins de contrat) s'exécutent immédiatement après le saut. En fonctionnement normal, pg-boss lance `scheduler-tick` toutes les 5 minutes.

**Webhooks financeur** : `financing_request.submitted|updated`, `contract.client_signed|fully_signed`, `conditions.all_lifted`, `delivery.pv_signed`, `disbursement.requested`, `invoice.unpaid`, `device.locked|returned` — signés `X-Solink-Signature: t=…,sha256=…`, reçus et vérifiés par `/api/demo/webhook-sink`, visibles sur `/demo`.

---

## 6. Hors périmètre du build

SSO (Entra ID / Google), Wave / Orange Money réels, HRIS, marketplace de reconditionné, ESG, multi-financeurs actif (le modèle de données le supporte, une seule banque est seedée), anglais, wolof, vraie IA générative, RLS PostgreSQL (le cloisonnement est appliqué dans chaque requête — P2), stockage S3, décaissement partiel par site.
