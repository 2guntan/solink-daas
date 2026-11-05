# Format d'export facturation Orange (démo)

Fichier CSV, séparateur `;`, encodage UTF-8 avec BOM, une ligne par facture. Montants en XOF entiers.

| Colonne | Description |
|---|---|
| `num_facture` | Référence `FO-AAAA-NNNNN` |
| `periode` | `AAAA-MM` |
| `date_emission` | `AAAA-MM-JJ` (le 1er du mois) |
| `date_echeance` | `AAAA-MM-JJ` (le 15 du mois) |
| `client_raison_sociale` | Raison sociale du client |
| `client_ninea` | NINEA du client |
| `ref_contrat` | `CTR-AAAA-NNNNN` |
| `bailleur` | Banque bailleur (pour compte de laquelle la ligne 1 est facturée) |
| `l1_libelle` | « Loyer location financière — pour compte de … » |
| `l1_ht`, `l1_tva`, `l1_ttc` | Ligne 1 : loyer |
| `l2_libelle` | « Services (SOLINK support & MDM, Orange VDI, assurance) » |
| `l2_ht`, `l2_tva`, `l2_ttc` | Ligne 2 : services |
| `total_ttc` | Total à payer |
| `statut` | `EMISE`, `PAYEE`, `PARTIELLE`, `IMPAYEE`, `AVOIR` |

Contrôle : `l1_ttc + l2_ttc = total_ttc`. TVA 18 % (valeur de démo, à valider par un fiscaliste).
Export : Portail Orange → Facturation (O04), Back-office SOLINK → Facturation (B11), ou `GET /api/export/orange?periode=AAAA-MM`.
