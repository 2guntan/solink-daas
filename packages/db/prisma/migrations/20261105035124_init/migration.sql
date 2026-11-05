-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PANIER', 'DEVIS_EMIS', 'APPROBATION_INTERNE', 'DEVIS_ACCEPTE', 'DOSSIER_EN_COURS', 'PRE_CONTROLE', 'DOSSIER_A_REPRENDRE', 'TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'PIECES_COMPLEMENTAIRES', 'ACCORDE', 'ACCORDE_SOUS_CONDITIONS', 'REFUSE', 'OFFRE_EMISE', 'SIGNATURE_CLIENT', 'CONTRESIGNATURE', 'CONDITIONS_SUSPENSIVES', 'PRET_POUR_ACHAT', 'ACHETE', 'EN_PREPARATION', 'EXPEDIE', 'PV_A_SIGNER', 'DECAISSEMENT_DEMANDE', 'ACTIF', 'FIN_DE_CONTRAT', 'CLOS', 'ANNULE', 'EXPIRE', 'ECHEC');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('A_FOURNIR', 'EN_VERIFICATION', 'VALIDEE', 'A_REPRENDRE', 'EXPIREE', 'NON_APPLICABLE');

-- CreateEnum
CREATE TYPE "Segment" AS ENUM ('GRANDE_ENTREPRISE', 'PME', 'INSTITUTION_FINANCIERE', 'PUBLIC', 'ONG');

-- CreateEnum
CREATE TYPE "Offer" AS ENUM ('BUREAU_CLOUD', 'POSTE_MOBILE', 'HYBRIDE');

-- CreateEnum
CREATE TYPE "Range" AS ENUM ('ESSENTIAL', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "DecisionResult" AS ENUM ('ACCORDE', 'ACCORDE_SOUS_CONDITIONS', 'REFUSE', 'PIECES_COMPLEMENTAIRES', 'SANS_SUITE');

-- CreateEnum
CREATE TYPE "ConditionType" AS ENUM ('DEPOT_MAJORE', 'CAUTION_DIRIGEANT', 'DUREE_MAX', 'MONTANT_MAX', 'PIECE_A_FOURNIR_AVANT_SIGNATURE', 'GARANTIE_TIERS', 'AUTRE');

-- CreateEnum
CREATE TYPE "ConditionNature" AS ENUM ('PREALABLE', 'SUSPENSIVE');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('COMMANDE', 'EN_TRANSIT', 'EN_STOCK', 'ENROLE', 'LIVRE', 'ACTIF', 'VERROUILLE', 'EN_SAV', 'RETOURNE', 'GRADE', 'RECONDITIONNE', 'REVENDU', 'REDEPLOYE', 'RECYCLE');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('DEMANDEE', 'VALIDEE', 'PAYEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('EMISE', 'PAYEE', 'PARTIELLE', 'IMPAYEE', 'AVOIR');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'CLIENT_APPROBATEUR', 'CLIENT_RECEPTION', 'CLIENT_EMPLOYE', 'SOLINK_COMMERCIAL', 'SOLINK_CHARGE_DOSSIER', 'SOLINK_ACHATS', 'SOLINK_LOGISTIQUE', 'SOLINK_MDM', 'SOLINK_SUPPORT', 'SOLINK_FINANCE', 'SOLINK_ADMIN', 'BANQUE_ANALYSTE', 'BANQUE_VALIDEUR', 'BANQUE_TRESORERIE', 'BANQUE_RISK', 'ORANGE_COMMERCIAL', 'ORANGE_FACTURATION', 'REFINANCEUR_LECTURE', 'AUDITEUR');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('CLIENT', 'OPERATEUR', 'APPORTEUR', 'FINANCEUR', 'REFINANCEUR');

-- CreateEnum
CREATE TYPE "SignatureMode" AS ENUM ('SEUL', 'CONJOINT');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('DIRIGEANT', 'SIGNATAIRE', 'BENEFICIAIRE_EFFECTIF', 'GARANT');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('THIN_CLIENT', 'LAPTOP', 'MAC', 'ECRAN', 'DOCK', 'CASQUE', 'SACOCHE');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('EN_STOCK', 'SUR_COMMANDE');

-- CreateEnum
CREATE TYPE "VdiTier" AS ENUM ('AUCUN', 'STANDARD', 'PERFORMANCE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('EMIS', 'EN_APPROBATION', 'APPROUVE', 'ACCEPTE', 'REFUSE_INTERNE', 'REMPLACE', 'EXPIRE');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('CGU', 'DONNEES_FINANCEMENT', 'BIC', 'ORANGE_HISTORIQUE', 'EXACTITUDE', 'PPE');

-- CreateEnum
CREATE TYPE "DecisionRoute" AS ENUM ('AUTO', 'ANALYSTE', 'REFUS_PROPOSE');

-- CreateEnum
CREATE TYPE "DocOrigin" AS ENUM ('CHECKLIST', 'DEMANDE_BANQUE');

-- CreateEnum
CREATE TYPE "ConditionStatus" AS ENUM ('A_LEVER', 'LEVEE');

-- CreateEnum
CREATE TYPE "EnvelopeMovementType" AS ENUM ('RESERVATION', 'CONSOMMATION', 'LIBERATION');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('EN_SIGNATURE', 'SIGNE', 'ACTIF', 'FIN_DE_CONTRAT', 'CLOS', 'RESILIE');

-- CreateEnum
CREATE TYPE "CeremonyStatus" AS ENUM ('EN_COURS', 'TERMINEE', 'EXPIREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "SignerRole" AS ENUM ('CLIENT', 'CO_SIGNATAIRE', 'BANQUE');

-- CreateEnum
CREATE TYPE "SignerStatus" AS ENUM ('EN_ATTENTE', 'A_SIGNER', 'SIGNE');

-- CreateEnum
CREATE TYPE "MandateMethod" AS ENUM ('PRELEVEMENT_BANCAIRE', 'WAVE', 'ORANGE_MONEY');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('EN_ATTENTE', 'SIGNE', 'ACTIF');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('EMIS', 'RECU');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('A_PLANIFIER', 'PLANIFIEE', 'PREPAREE', 'EXPEDIEE', 'LIVREE');

-- CreateEnum
CREATE TYPE "PvStatus" AS ENUM ('A_SIGNER', 'SIGNE');

-- CreateEnum
CREATE TYPE "LockOrderStatus" AS ENUM ('PROPOSE', 'ORDONNE', 'EXECUTE', 'LEVE', 'REFUSE');

-- CreateEnum
CREATE TYPE "MdmActionType" AS ENUM ('ENROLER', 'VERROUILLER', 'DEVERROUILLER', 'EFFACER');

-- CreateEnum
CREATE TYPE "Beneficiary" AS ENUM ('BANQUE', 'ORANGE', 'SOLINK');

-- CreateEnum
CREATE TYPE "AllocationComponent" AS ENUM ('LOYER', 'COMMISSION_APPORTEUR', 'VDI', 'SERVICES_SOLINK', 'ASSURANCE');

-- CreateEnum
CREATE TYPE "DunningLevel" AS ENUM ('J1_RAPPEL', 'J7_RELANCE', 'J15_VERROUILLAGE', 'J30_MISE_EN_DEMEURE', 'J60_RESILIATION');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL', 'PORTAIL');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NOUVEAU', 'INVITE', 'CONVERTI', 'PERDU');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('FIN_NORMALE', 'RENOUVELLEMENT', 'ARRET_ANTICIPE', 'RESILIATION', 'SINISTRE');

-- CreateEnum
CREATE TYPE "ParamOwner" AS ENUM ('BANQUE', 'SOLINK');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "type" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "ninea" TEXT,
    "rccm" TEXT,
    "legalForm" TEXT,
    "segment" "Segment",
    "sector" TEXT,
    "naema" TEXT,
    "createdOn" TIMESTAMP(3),
    "capital" DOUBLE PRECISION,
    "address" TEXT,
    "groupName" TEXT,
    "employees" INTEGER,
    "currentBanks" TEXT,
    "kybStatus" TEXT NOT NULL DEFAULT 'A_VERIFIER',
    "apporteurId" TEXT,
    "approvalThreshold" INTEGER,
    "jointSignature" BOOLEAN NOT NULL DEFAULT false,
    "beDeclared" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT,
    "mobileVerified" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "roles" "Role"[],
    "isSignatory" BOOLEAN NOT NULL DEFAULT false,
    "signatureMode" "SignatureMode" NOT NULL DEFAULT 'SEUL',
    "powerDocId" TEXT,
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "landmark" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "hours" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "type" "PersonType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "idNumber" TEXT,
    "idValidUntil" TIMESTAMP(3),
    "ownershipPct" INTEGER,
    "ppe" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "offers" "Offer"[],
    "range" "Range" NOT NULL,
    "specs" JSONB NOT NULL,
    "keyboard" TEXT NOT NULL DEFAULT 'AZERTY',
    "aiReady" BOOLEAN NOT NULL DEFAULT false,
    "availability" "Availability" NOT NULL DEFAULT 'EN_STOCK',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 5,
    "purchasePrice" INTEGER NOT NULL,
    "usage" TEXT,
    "supplier" TEXT NOT NULL DEFAULT 'Distributeur Démo Dakar',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pack" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL,
    "vdiTier" "VdiTier" NOT NULL DEFAULT 'AUCUN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "apporteurId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PANIER',
    "durationMonths" INTEGER NOT NULL DEFAULT 36,
    "monthlyTtc" INTEGER NOT NULL DEFAULT 0,
    "depositTtc" INTEGER NOT NULL DEFAULT 0,
    "financedAmount" INTEGER NOT NULL DEFAULT 0,
    "priceFrozenUntil" TIMESTAMP(3),
    "endReason" "EndReason",
    "sampled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "siteId" TEXT,
    "quantity" INTEGER NOT NULL,
    "vdiTier" "VdiTier" NOT NULL DEFAULT 'AUCUN',
    "insurance" BOOLEAN NOT NULL DEFAULT true,
    "packName" TEXT,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'EMIS',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "monthlyHt" INTEGER NOT NULL,
    "monthlyTva" INTEGER NOT NULL,
    "monthlyTtc" INTEGER NOT NULL,
    "depositTtc" INTEGER NOT NULL,
    "financedAmount" INTEGER NOT NULL,
    "totalContractTtc" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "parameterVersion" TEXT NOT NULL,
    "pdfFileId" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalComment" TEXT,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "siteId" TEXT,
    "siteName" TEXT,
    "vdiTier" "VdiTier" NOT NULL DEFAULT 'AUCUN',
    "insurance" BOOLEAN NOT NULL DEFAULT true,
    "components" JSONB NOT NULL,
    "unitMonthlyHt" INTEGER NOT NULL,
    "unitMonthlyTtc" INTEGER NOT NULL,
    "lineMonthlyTtc" INTEGER NOT NULL,
    "unitBase" INTEGER NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "textVersion" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorOrg" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditFile" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "checklistVersion" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "score" INTEGER,
    "riskClass" TEXT,
    "factors" JSONB,
    "knockouts" JSONB,
    "route" "DecisionRoute",
    "submittedAt" TIMESTAMP(3),
    "analystId" TEXT,

    CONSTRAINT "CreditFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "creditFileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocStatus" NOT NULL DEFAULT 'A_FOURNIR',
    "version" INTEGER NOT NULL DEFAULT 0,
    "fileId" TEXT,
    "sha256" TEXT,
    "extraction" JSONB,
    "docDate" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "rejectReason" TEXT,
    "naJustification" TEXT,
    "verifiedById" TEXT,
    "uploadedById" TEXT,
    "origin" "DocOrigin" NOT NULL DEFAULT 'CHECKLIST',
    "requestMessage" TEXT,
    "dueDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DfsPackage" (
    "id" TEXT NOT NULL,
    "creditFileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "packageId" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifestSha256" TEXT NOT NULL,
    "previousSha256" TEXT,
    "diff" JSONB,
    "channel" TEXT NOT NULL DEFAULT 'PORTAIL',
    "zipFileId" TEXT,
    "transmittedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "DfsPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "creditFileId" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "result" "DecisionResult" NOT NULL,
    "amount" INTEGER,
    "durationMonths" INTEGER,
    "coefficient" TEXT,
    "validUntil" TIMESTAMP(3),
    "deciderId" TEXT,
    "delegationLevel" TEXT,
    "internalReason" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "ruleVersion" TEXT,
    "idempotencyKey" TEXT,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "type" "ConditionType" NOT NULL,
    "nature" "ConditionNature" NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "status" "ConditionStatus" NOT NULL DEFAULT 'A_LEVER',
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envelope" (
    "id" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "perClientCap" INTEGER NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "alertPcts" INTEGER[],
    "whitelist" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Envelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvelopeMovement" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" "EnvelopeMovementType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvelopeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoefficientGrid" (
    "id" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "range" "Range",
    "residualPct" INTEGER NOT NULL DEFAULT 0,
    "coefficient" DECIMAL(8,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "validatedBy" TEXT,

    CONSTRAINT "CoefficientGrid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefiLine" (
    "id" TEXT NOT NULL,
    "refinancerId" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quotityPct" INTEGER NOT NULL DEFAULT 100,
    "criteria" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefiLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "financerId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'EN_SIGNATURE',
    "durationMonths" INTEGER NOT NULL,
    "monthlyTtc" INTEGER NOT NULL,
    "depositTtc" INTEGER NOT NULL,
    "financedAmount" INTEGER NOT NULL,
    "depositReference" TEXT NOT NULL,
    "depositReceivedAt" TIMESTAMP(3),
    "insuranceIssuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "refiEligible" BOOLEAN NOT NULL DEFAULT false,
    "endReason" "EndReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "signedFileId" TEXT,
    "signedSha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureCeremony" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "status" "CeremonyStatus" NOT NULL DEFAULT 'EN_COURS',
    "createdAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "proofFileId" TEXT,

    CONSTRAINT "SignatureCeremony_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signer" (
    "id" TEXT NOT NULL,
    "ceremonyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "SignerRole" NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "SignerStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "token" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "ip" TEXT,

    CONSTRAINT "Signer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "method" "MandateMethod" NOT NULL DEFAULT 'PRELEVEMENT_BANCAIRE',
    "reference" TEXT NOT NULL,
    "iban" TEXT,
    "status" "MandateStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'EMIS',
    "amount" INTEGER NOT NULL,
    "fileId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "slot" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'A_PLANIFIER',
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryReceipt" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" "PvStatus" NOT NULL DEFAULT 'A_SIGNER',
    "serials" JSONB NOT NULL,
    "photos" JSONB NOT NULL,
    "reserves" TEXT,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "signedById" TEXT,
    "signedName" TEXT,
    "signedAt" TIMESTAMP(3),
    "fileId" TEXT,
    "sha256" TEXT,

    CONSTRAINT "DeliveryReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "autopilotHash" TEXT,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "contractId" TEXT,
    "ownerId" TEXT,
    "siteId" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'COMMANDE',
    "grade" "Grade",
    "mdmId" TEXT,
    "assignedTo" TEXT,
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MdmAction" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "action" "MdmActionType" NOT NULL,
    "lockOrderId" TEXT,
    "executedById" TEXT,
    "result" TEXT NOT NULL DEFAULT 'OK',
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MdmAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockOrder" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "status" "LockOrderStatus" NOT NULL DEFAULT 'PROPOSE',
    "reason" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "orderedById" TEXT,
    "orderedAt" TIMESTAMP(3),
    "executedById" TEXT,
    "executedAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "LockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "pieces" JSONB NOT NULL,
    "status" "DisbursementStatus" NOT NULL DEFAULT 'DEMANDEE',
    "invoiceFileId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "rejectReason" TEXT,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "rentHt" INTEGER NOT NULL,
    "rentTva" INTEGER NOT NULL,
    "servicesHt" INTEGER NOT NULL,
    "servicesTva" INTEGER NOT NULL,
    "totalTtc" INTEGER NOT NULL,
    "invoiceId" TEXT,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "line1Ht" INTEGER NOT NULL,
    "line1Tva" INTEGER NOT NULL,
    "line1Ttc" INTEGER NOT NULL,
    "line2Ht" INTEGER NOT NULL,
    "line2Tva" INTEGER NOT NULL,
    "line2Ttc" INTEGER NOT NULL,
    "totalTtc" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'EMISE',
    "fileId" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "reference" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'VIREMENT',

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "beneficiary" "Beneficiary" NOT NULL,
    "component" "AllocationComponent" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dunning" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "level" "DunningLevel" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dunning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "deviceId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OUVERT',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceReturn" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "penaltyPct" INTEGER NOT NULL,
    "penalty" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "apporteurId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "ninea" TEXT,
    "segment" "Segment",
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "need" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NOUVEAU',
    "organisationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusTransition" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "from" "OrderStatus",
    "to" "OrderStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,

    CONSTRAINT "StatusTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "template" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parameter" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "ownerType" "ParamOwner" NOT NULL,
    "label" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimClock" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "offsetDays" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SimClock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sequence" (
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sequence_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "status" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "result" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_code_key" ON "Organisation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_ninea_key" ON "Organisation"("ninea");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organisationId_key" ON "Membership"("userId", "organisationId");

-- CreateIndex
CREATE INDEX "OtpCode_identifier_idx" ON "OtpCode"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_orderId_version_key" ON "Quote"("orderId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CreditFile_orderId_key" ON "CreditFile"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DfsPackage_packageId_key" ON "DfsPackage"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "DfsPackage_creditFileId_version_key" ON "DfsPackage"("creditFileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_idempotencyKey_key" ON "Decision"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_ref_key" ON "Contract"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_orderId_key" ON "Contract"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureCeremony_providerRef_key" ON "SignatureCeremony"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Signer_token_key" ON "Signer"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Mandate_contractId_key" ON "Mandate"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_ref_key" ON "PurchaseOrder"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryReceipt_deliveryId_key" ON "DeliveryReceipt"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serial_key" ON "Device"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Disbursement_ref_key" ON "Disbursement"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_contractId_number_key" ON "Installment"("contractId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ref_key" ON "Invoice"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_contractId_period_key" ON "Invoice"("contractId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Dunning_invoiceId_level_key" ON "Dunning"("invoiceId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ref_key" ON "Ticket"("ref");

-- CreateIndex
CREATE INDEX "StatusTransition_orderId_at_idx" ON "StatusTransition"("orderId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_seq_key" ON "AuditEvent"("seq");

-- CreateIndex
CREATE INDEX "AuditEvent_entity_entityId_idx" ON "AuditEvent"("entity", "entityId");

-- CreateIndex
CREATE INDEX "Notification_recipient_idx" ON "Notification"("recipient");

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_key_version_key" ON "Parameter"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_key_key" ON "JobRun"("key");

-- AddForeignKey
ALTER TABLE "Organisation" ADD CONSTRAINT "Organisation_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pack" ADD CONSTRAINT "Pack_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_financerId_fkey" FOREIGN KEY ("financerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditFile" ADD CONSTRAINT "CreditFile_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_creditFileId_fkey" FOREIGN KEY ("creditFileId") REFERENCES "CreditFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DfsPackage" ADD CONSTRAINT "DfsPackage_creditFileId_fkey" FOREIGN KEY ("creditFileId") REFERENCES "CreditFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_creditFileId_fkey" FOREIGN KEY ("creditFileId") REFERENCES "CreditFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_financerId_fkey" FOREIGN KEY ("financerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeMovement" ADD CONSTRAINT "EnvelopeMovement_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeMovement" ADD CONSTRAINT "EnvelopeMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoefficientGrid" ADD CONSTRAINT "CoefficientGrid_financerId_fkey" FOREIGN KEY ("financerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefiLine" ADD CONSTRAINT "RefiLine_refinancerId_fkey" FOREIGN KEY ("refinancerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefiLine" ADD CONSTRAINT "RefiLine_financerId_fkey" FOREIGN KEY ("financerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_financerId_fkey" FOREIGN KEY ("financerId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureCeremony" ADD CONSTRAINT "SignatureCeremony_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signer" ADD CONSTRAINT "Signer_ceremonyId_fkey" FOREIGN KEY ("ceremonyId") REFERENCES "SignatureCeremony"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryReceipt" ADD CONSTRAINT "DeliveryReceipt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdmAction" ADD CONSTRAINT "MdmAction_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOrder" ADD CONSTRAINT "LockOrder_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allocation" ADD CONSTRAINT "Allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dunning" ADD CONSTRAINT "Dunning_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReturn" ADD CONSTRAINT "DeviceReturn_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_apporteurId_fkey" FOREIGN KEY ("apporteurId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusTransition" ADD CONSTRAINT "StatusTransition_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
