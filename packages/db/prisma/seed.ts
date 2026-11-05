/**
 * Seed déterministe SOLINK DaaS (CLAUDE.md §6). Données 100 % fictives (marquées « DÉMO »).
 * Les situations avancées sont produites en pilotant les VRAIS services métier (cohérence garantie),
 * en voyageant dans le temps avec l'horloge simulée (SimClock).
 */
process.env.WEBHOOKS_DISABLED = 'true';

import { prisma, type Role, type Segment } from '../src/index';
import { svc, DEFAULT_PARAMS, PARAM_LABELS, PARAM_OWNERS, type ParamKey, addDays, recordInitialTransition } from '@solink/core';

const DAY = 86_400_000;
const today = new Date();
today.setUTCHours(9, 0, 0, 0);

async function setSimDate(d: Date) {
  const offset = Math.round((d.getTime() - Date.now()) / DAY);
  await prisma.simClock.upsert({ where: { id: 1 }, update: { offsetDays: offset }, create: { id: 1, offsetDays: offset } });
}

async function actor(email: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  const a = await svc.loadActor(u.id);
  if (!a) throw new Error(`acteur ${email}`);
  return a;
}

async function as<T>(email: string, fn: (ctx: svc.Ctx) => Promise<T>): Promise<T> {
  return svc.run(await actor(email), fn);
}

// ───────────────────────── Catalogue (36 références, prix d'achat fictifs) ─────────────────────────
type P = [sku: string, name: string, brand: string, category: string, range: string, offers: string[], price: number, specs: string[], extra?: { ai?: boolean; stock?: boolean; lead?: number; usage?: string }];
const BC = ['BUREAU_CLOUD', 'HYBRIDE'];
const PM = ['POSTE_MOBILE', 'HYBRIDE'];
const ALL = ['BUREAU_CLOUD', 'POSTE_MOBILE', 'HYBRIDE'];
const CATALOG: P[] = [
  ['TC-T430', 'Thin client t430', 'HP', 'THIN_CLIENT', 'ESSENTIAL', BC, 210000, ['Celeron quadricœur', '4 Go RAM', '16 Go eMMC', 'Double écran'], { usage: 'Guichet, accueil' }],
  ['TC-T540', 'Thin client t540', 'HP', 'THIN_CLIENT', 'ESSENTIAL', BC, 260000, ['Ryzen embarqué', '8 Go RAM', '64 Go SSD', 'Wi-Fi 6'], { usage: 'Bureautique' }],
  ['TC-T640', 'Thin client t640', 'HP', 'THIN_CLIENT', 'PRO', BC, 320000, ['Ryzen R1505G', '8 Go RAM', '128 Go SSD', '3 écrans 4K'], { usage: 'Centre d’appels, back-office' }],
  ['TC-T740', 'Thin client t740', 'HP', 'THIN_CLIENT', 'PREMIUM', BC, 450000, ['Ryzen V1756B', '16 Go RAM', '256 Go SSD', 'GPU dédié'], { usage: 'Multi-écrans intensif', stock: false, lead: 21 }],
  ['TC-MT32', 'Mobile thin client mt32', 'HP', 'THIN_CLIENT', 'PRO', ['HYBRIDE', 'BUREAU_CLOUD'], 380000, ['Écran 14" FHD', '8 Go RAM', '128 Go SSD', '4G en option'], { usage: 'Commerciaux terrain' }],
  ['TC-MT45', 'Mobile thin client mt45', 'HP', 'THIN_CLIENT', 'PREMIUM', ['HYBRIDE', 'BUREAU_CLOUD'], 520000, ['Écran 14" FHD tactile', '16 Go RAM', '256 Go SSD', '4G intégrée'], { stock: false, lead: 21 }],
  ['LP-E14-8', 'Lenovo ThinkPad E14 (i5 · 8 Go · 256 Go)', 'Lenovo', 'LAPTOP', 'ESSENTIAL', PM, 520000, ['Intel Core i5', '8 Go RAM', '256 Go SSD', '14" FHD']],
  ['LP-E14-16', 'Lenovo ThinkPad E14 (i5 · 16 Go · 512 Go)', 'Lenovo', 'LAPTOP', 'ESSENTIAL', PM, 590000, ['Intel Core i5', '16 Go RAM', '512 Go SSD', '14" FHD']],
  ['LP-DP14E-8', 'Dell Pro 14 Essential (i5 · 8 Go · 256 Go)', 'Dell', 'LAPTOP', 'ESSENTIAL', PM, 540000, ['Intel Core i5', '8 Go RAM', '256 Go SSD', '14" FHD']],
  ['LP-DP14E-16', 'Dell Pro 14 Essential (i5 · 16 Go · 512 Go)', 'Dell', 'LAPTOP', 'ESSENTIAL', PM, 610000, ['Intel Core i5', '16 Go RAM', '512 Go SSD', '14" FHD']],
  ['LP-PB440-8', 'HP ProBook 440 (i5 · 8 Go · 256 Go)', 'HP', 'LAPTOP', 'ESSENTIAL', PM, 530000, ['Intel Core i5', '8 Go RAM', '256 Go SSD', '14" FHD']],
  ['LP-PB440-16', 'HP ProBook 440 (i5 · 16 Go · 512 Go)', 'HP', 'LAPTOP', 'ESSENTIAL', PM, 600000, ['Intel Core i5', '16 Go RAM', '512 Go SSD', '14" FHD'], { stock: false, lead: 14 }],
  ['LP-T14-16', 'Lenovo ThinkPad T14 (i7 · 16 Go · 512 Go)', 'Lenovo', 'LAPTOP', 'PRO', PM, 780000, ['Intel Core i7', '16 Go RAM', '512 Go SSD', '14" WUXGA']],
  ['LP-T14-32', 'Lenovo ThinkPad T14 (i7 · 32 Go · 1 To)', 'Lenovo', 'LAPTOP', 'PRO', PM, 920000, ['Intel Core i7', '32 Go RAM', '1 To SSD', '14" WUXGA'], { stock: false, lead: 14 }],
  ['LP-DP14P-16', 'Dell Pro 14 Plus (i7 · 16 Go · 512 Go)', 'Dell', 'LAPTOP', 'PRO', PM, 800000, ['Intel Core i7', '16 Go RAM', '512 Go SSD', '14" FHD+']],
  ['LP-DP14P-32', 'Dell Pro 14 Plus (i7 · 32 Go · 1 To)', 'Dell', 'LAPTOP', 'PRO', PM, 940000, ['Intel Core i7', '32 Go RAM', '1 To SSD', '14" FHD+'], { stock: false, lead: 14 }],
  ['LP-EB640-16', 'HP EliteBook 640 (i7 · 16 Go · 512 Go)', 'HP', 'LAPTOP', 'PRO', PM, 650000, ['Intel Core i7', '16 Go RAM', '512 Go SSD', '14" FHD']],
  ['LP-EB840-32', 'HP EliteBook 840 (i7 · 32 Go · 1 To)', 'HP', 'LAPTOP', 'PRO', PM, 930000, ['Intel Core i7', '32 Go RAM', '1 To SSD', '14" WUXGA']],
  ['LP-X1C', 'Lenovo ThinkPad X1 Carbon (Ultra 7 · 32 Go · 1 To)', 'Lenovo', 'LAPTOP', 'PREMIUM', PM, 1350000, ['Intel Core Ultra 7 (NPU)', '32 Go RAM', '1 To SSD', '14" 2.8K OLED'], { ai: true }],
  ['LP-DP14X', 'Dell Pro 14 Premium (Ultra 7 · 32 Go · 1 To)', 'Dell', 'LAPTOP', 'PREMIUM', PM, 1300000, ['Intel Core Ultra 7 (NPU)', '32 Go RAM', '1 To SSD', '14" QHD+'], { ai: true }],
  ['LP-EB1040', 'HP EliteBook 1040 (Ultra 7 · 32 Go · 1 To)', 'HP', 'LAPTOP', 'PREMIUM', PM, 1320000, ['Intel Core Ultra 7 (NPU)', '32 Go RAM', '1 To SSD', '14" WUXGA'], { ai: true, stock: false, lead: 21 }],
  ['MAC-AIR13', 'MacBook Air 13" (M3 · 16 Go · 512 Go)', 'Apple', 'MAC', 'PRO', PM, 980000, ['Puce M3', '16 Go RAM', '512 Go SSD', 'Écran Liquid Retina'], { ai: true }],
  ['MAC-AIR15', 'MacBook Air 15" (M3 · 16 Go · 512 Go)', 'Apple', 'MAC', 'PRO', PM, 1150000, ['Puce M3', '16 Go RAM', '512 Go SSD', '15,3" Liquid Retina'], { ai: true, stock: false, lead: 14 }],
  ['MAC-PRO14', 'MacBook Pro 14" (M4 Pro · 24 Go · 1 To)', 'Apple', 'MAC', 'PREMIUM', PM, 1750000, ['Puce M4 Pro', '24 Go RAM', '1 To SSD', 'Liquid Retina XDR'], { ai: true, stock: false, lead: 21 }],
  ['MAC-PRO16', 'MacBook Pro 16" (M4 Max · 36 Go · 1 To)', 'Apple', 'MAC', 'PREMIUM', PM, 2400000, ['Puce M4 Max', '36 Go RAM', '1 To SSD', '16,2" XDR'], { ai: true, stock: false, lead: 30 }],
  ['EC-24', 'Écran 24" Full HD', 'Générique', 'ECRAN', 'ESSENTIAL', ALL, 95000, ['24" IPS', '1920×1080', 'HDMI / DP', 'Pied réglable']],
  ['EC-24E', 'Écran 24" ergonomique USB-C', 'Générique', 'ECRAN', 'PRO', ALL, 130000, ['24" IPS', 'USB-C 65 W', 'Pivot', 'Hub USB']],
  ['EC-27', 'Écran 27" QHD', 'Générique', 'ECRAN', 'PRO', ALL, 160000, ['27" IPS', '2560×1440', 'USB-C', 'Haut-parleurs']],
  ['EC-27K', 'Écran 27" 4K', 'Générique', 'ECRAN', 'PREMIUM', ALL, 260000, ['27" IPS', '3840×2160', 'USB-C 90 W', 'Calibré usine'], { stock: false, lead: 14 }],
  ['DK-USBC', 'Station d’accueil USB-C', 'Générique', 'DOCK', 'ESSENTIAL', ALL, 85000, ['USB-C 90 W', '2 écrans', 'Ethernet', '4 USB']],
  ['DK-TB4', 'Station d’accueil Thunderbolt 4', 'Générique', 'DOCK', 'PRO', ALL, 150000, ['Thunderbolt 4', '3 écrans 4K', '2,5 GbE', 'SD']],
  ['CQ-FIL', 'Casque filaire USB', 'Générique', 'CASQUE', 'ESSENTIAL', ALL, 25000, ['Stéréo', 'Micro antibruit', 'USB-A', 'Léger']],
  ['CQ-DUO', 'Casque centre d’appels duo', 'Générique', 'CASQUE', 'PRO', ALL, 40000, ['Binaural', 'Micro perche', 'USB-C', 'Certifié Teams']],
  ['CQ-ANC', 'Casque sans fil réduction de bruit', 'Générique', 'CASQUE', 'PREMIUM', ALL, 65000, ['Bluetooth', 'ANC', '30 h', 'Dongle USB']],
  ['SC-STD', 'Sacoche 14" standard', 'Générique', 'SACOCHE', 'ESSENTIAL', PM, 18000, ['14"', 'Déperlante', 'Poche accessoires', 'Bandoulière']],
  ['SC-PRM', 'Sac à dos 15" premium', 'Générique', 'SACOCHE', 'PREMIUM', PM, 35000, ['15"', 'Antivol', 'Port USB', 'Rembourré']],
];

async function main() {
  console.log('▶ Seed SOLINK DaaS (données fictives — DÉMO)');
  await prisma.simClock.upsert({ where: { id: 1 }, update: { offsetDays: 0 }, create: { id: 1, offsetDays: 0 } });

  // Paramètres §4 (version 1)
  for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
    await prisma.parameter.create({ data: { key, value: value as object, version: 1, effectiveFrom: addDays(today, -365), ownerType: PARAM_OWNERS[key as ParamKey], label: PARAM_LABELS[key as ParamKey], updatedById: 'SEED' } });
  }

  // Organisations partenaires
  const solink = await prisma.organisation.create({ data: { type: 'OPERATEUR', code: 'SOLINK', name: 'SOLINK Professional Services', ninea: 'DEMO-SOLINK-001', address: 'Dakar Plateau (démo)', isDemo: true } });
  const orange = await prisma.organisation.create({ data: { type: 'APPORTEUR', code: 'ORANGE', name: 'Orange Business Sénégal', address: 'Dakar (démo)' } });
  const bank = await prisma.organisation.create({ data: { type: 'FINANCEUR', code: 'BANQUE_PILOTE', name: 'Banque Pilote (démo)', address: 'Dakar (démo)' } });
  const refi = await prisma.organisation.create({ data: { type: 'REFINANCEUR', code: 'FONDS_REFI', name: 'Fonds Refi Démo', address: 'Abidjan (démo)' } });

  // Clients fictifs
  type C = { key: string; name: string; segment: Segment; ninea: string; rccm: string | null; sector: string; createdOn: string; legalForm: string; capital: number; employees: number; apporteur: boolean; joint?: boolean };
  const clientsDef: C[] = [
    { key: 'teranga', name: 'Assurances Teranga Démo SA', segment: 'GRANDE_ENTREPRISE', ninea: 'DEMO-0012345-2A1', rccm: 'SN-DKR-2004-B-DEMO1', sector: 'ASSURANCE', createdOn: '2004-03-01', legalForm: 'SA', capital: 3_000_000_000, employees: 420, apporteur: true },
    { key: 'baobab', name: 'Microfinance Baobab Démo', segment: 'INSTITUTION_FINANCIERE', ninea: 'DEMO-0023456-2B2', rccm: 'SN-DKR-2011-B-DEMO2', sector: 'MICROFINANCE', createdOn: '2011-06-15', legalForm: 'SA', capital: 1_200_000_000, employees: 180, apporteur: false },
    { key: 'sahel', name: 'ONG Sahel Santé Démo', segment: 'ONG', ninea: 'DEMO-0034567-2C3', rccm: null, sector: 'SANTE', createdOn: '2015-01-10', legalForm: 'Association', capital: 0, employees: 65, apporteur: false },
    { key: 'ndar', name: 'PME Logistique Ndar Démo', segment: 'PME', ninea: 'DEMO-0045678-2D4', rccm: 'SN-SLR-2017-B-DEMO4', sector: 'LOGISTIQUE', createdOn: '2017-09-01', legalForm: 'SARL', capital: 50_000_000, employees: 38, apporteur: true },
    { key: 'callcenter', name: 'Call Center Atlantique Démo', segment: 'GRANDE_ENTREPRISE', ninea: 'DEMO-0056789-2E5', rccm: 'SN-DKR-2009-B-DEMO5', sector: 'SERVICES_BPO', createdOn: '2009-02-20', legalForm: 'SA', capital: 800_000_000, employees: 650, apporteur: true, joint: true },
  ];
  const org: Record<string, { id: string }> = {};
  for (const c of clientsDef) {
    org[c.key] = await prisma.organisation.create({
      data: { type: 'CLIENT', name: c.name, segment: c.segment, ninea: c.ninea, rccm: c.rccm, sector: c.sector, createdOn: new Date(c.createdOn), legalForm: c.legalForm, capital: c.capital, employees: c.employees, address: `Adresse fictive — ${c.name}`, currentBanks: 'Banque Pilote (démo)', apporteurId: c.apporteur ? orange.id : null, jointSignature: !!c.joint, approvalThreshold: DEFAULT_PARAMS.seuil_approbation_interne, kybStatus: 'VERIFIE' },
    });
  }

  // Utilisateurs & rôles
  const users: [string, string, string, string, string, Role[], boolean?][] = [
    ['admin@teranga-demo.sn', 'Awa', 'Diop (DÉMO)', 'Directrice des systèmes d’information', 'teranga', ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], true],
    ['daf@teranga-demo.sn', 'Moussa', 'Ndiaye (DÉMO)', 'Directeur administratif et financier', 'teranga', ['CLIENT_FINANCE']],
    ['approbateur@teranga-demo.sn', 'Fatou', 'Sarr (DÉMO)', 'Directrice générale adjointe', 'teranga', ['CLIENT_APPROBATEUR']],
    ['reception@teranga-demo.sn', 'Ibrahima', 'Fall (DÉMO)', 'Services généraux', 'teranga', ['CLIENT_RECEPTION']],
    ['employe@teranga-demo.sn', 'Khady', 'Ba (DÉMO)', 'Chargée de clientèle', 'teranga', ['CLIENT_EMPLOYE']],
    ['admin@baobab-demo.sn', 'Cheikh', 'Gueye (DÉMO)', 'Directeur général', 'baobab', ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], true],
    ['daf@baobab-demo.sn', 'Aminata', 'Faye (DÉMO)', 'DAF', 'baobab', ['CLIENT_FINANCE']],
    ['admin@sahel-demo.sn', 'Mariama', 'Cissé (DÉMO)', 'Coordinatrice', 'sahel', ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'CLIENT_RECEPTION'], true],
    ['admin@ndar-demo.sn', 'Ousmane', 'Sow (DÉMO)', 'Gérant', 'ndar', ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE', 'CLIENT_FINANCE', 'CLIENT_RECEPTION'], true],
    ['dg@callcenter-demo.sn', 'Pape', 'Mbaye (DÉMO)', 'Directeur général', 'callcenter', ['CLIENT_ADMIN', 'CLIENT_SIGNATAIRE'], true],
    ['dga@callcenter-demo.sn', 'Seynabou', 'Diallo (DÉMO)', 'Directrice générale adjointe', 'callcenter', ['CLIENT_SIGNATAIRE', 'CLIENT_FINANCE'], true],
    ['reception@callcenter-demo.sn', 'Lamine', 'Kane (DÉMO)', 'Logistique', 'callcenter', ['CLIENT_RECEPTION']],
    ['dossier@solink.sn', 'Rokhaya', 'Thiam (DÉMO)', 'Chargée de dossier', 'solink', ['SOLINK_CHARGE_DOSSIER', 'SOLINK_COMMERCIAL']],
    ['ops@solink.sn', 'Babacar', 'Seck (DÉMO)', 'Opérations', 'solink', ['SOLINK_ACHATS', 'SOLINK_LOGISTIQUE', 'SOLINK_MDM', 'SOLINK_SUPPORT']],
    ['finance@solink.sn', 'Ndeye', 'Wade (DÉMO)', 'Finance', 'solink', ['SOLINK_FINANCE']],
    ['admin@solink.sn', 'Bou', 'Admin (DÉMO)', 'Administrateur plateforme', 'solink', ['SOLINK_ADMIN']],
    ['analyste@banque-demo.sn', 'Adama', 'Touré (DÉMO)', 'Analyste crédit', 'bank', ['BANQUE_ANALYSTE']],
    ['valideur@banque-demo.sn', 'Sokhna', 'Niang (DÉMO)', 'Valideur N2', 'bank', ['BANQUE_VALIDEUR', 'BANQUE_RISK']],
    ['tresorerie@banque-demo.sn', 'Mamadou', 'Camara (DÉMO)', 'Trésorerie', 'bank', ['BANQUE_TRESORERIE']],
    ['commercial@orange-demo.sn', 'Astou', 'Lo (DÉMO)', 'Commerciale grands comptes', 'orange', ['ORANGE_COMMERCIAL']],
    ['facturation@orange-demo.sn', 'Modou', 'Diagne (DÉMO)', 'Facturation', 'orange', ['ORANGE_FACTURATION']],
    ['refi@fonds-demo.org', 'Claire', 'Kouassi (DÉMO)', 'Chargée d’investissement', 'refi', ['REFINANCEUR_LECTURE']],
  ];
  const orgOf: Record<string, string> = { ...Object.fromEntries(Object.entries(org).map(([k, v]) => [k, v.id])), solink: solink.id, bank: bank.id, orange: orange.id, refi: refi.id };
  for (const [email, firstName, lastName, title, o, roles, sig] of users) {
    const u = await prisma.user.create({ data: { email, firstName, lastName, title, mobile: '+221 77 000 00 00 (démo)', mobileVerified: true } });
    await prisma.membership.create({ data: { userId: u.id, organisationId: orgOf[o], roles, isSignatory: !!sig, signatureMode: o === 'callcenter' && sig ? 'CONJOINT' : 'SEUL' } });
  }

  // Personnes déclarées (dirigeants, signataires, BE)
  const persons: [string, string, string, string, string, number?][] = [
    ['teranga', 'DIRIGEANT', 'Abdoulaye', 'Kâ (DÉMO)', 'Directeur général'],
    ['teranga', 'SIGNATAIRE', 'Awa', 'Diop (DÉMO)', 'DSI — délégation de pouvoirs'],
    ['teranga', 'BENEFICIAIRE_EFFECTIF', 'Groupe Teranga Holding', 'Démo', 'Actionnaire', 62],
    ['baobab', 'DIRIGEANT', 'Cheikh', 'Gueye (DÉMO)', 'Directeur général'],
    ['baobab', 'SIGNATAIRE', 'Cheikh', 'Gueye (DÉMO)', 'Directeur général'],
    ['baobab', 'BENEFICIAIRE_EFFECTIF', 'Coopérative Baobab', 'Démo', 'Actionnaire', 51],
    ['sahel', 'DIRIGEANT', 'Mariama', 'Cissé (DÉMO)', 'Coordinatrice'],
    ['sahel', 'SIGNATAIRE', 'Mariama', 'Cissé (DÉMO)', 'Coordinatrice'],
    ['sahel', 'BENEFICIAIRE_EFFECTIF', 'Conseil d’administration', 'Démo', 'Gouvernance', 0],
    ['ndar', 'DIRIGEANT', 'Ousmane', 'Sow (DÉMO)', 'Gérant'],
    ['ndar', 'SIGNATAIRE', 'Ousmane', 'Sow (DÉMO)', 'Gérant'],
    ['ndar', 'BENEFICIAIRE_EFFECTIF', 'Ousmane', 'Sow (DÉMO)', 'Associé', 70],
    ['callcenter', 'DIRIGEANT', 'Pape', 'Mbaye (DÉMO)', 'Directeur général'],
    ['callcenter', 'SIGNATAIRE', 'Pape', 'Mbaye (DÉMO)', 'DG'],
    ['callcenter', 'SIGNATAIRE', 'Seynabou', 'Diallo (DÉMO)', 'DGA (signature conjointe)'],
    ['callcenter', 'BENEFICIAIRE_EFFECTIF', 'Atlantique Partners', 'Démo', 'Actionnaire', 55],
  ];
  for (const [o, type, firstName, lastName, role, pct] of persons)
    await prisma.person.create({ data: { organisationId: org[o].id, type: type as 'DIRIGEANT', firstName, lastName, role, ownershipPct: pct ?? null, ppe: false } });

  // Sites
  const sites: Record<string, string[]> = {};
  const siteDefs: [string, string, string, string][] = [
    ['teranga', 'Siège — Plateau', 'Avenue fictive 1, Dakar Plateau', 'reception@teranga-demo.sn'],
    ['teranga', 'Agence Almadies', 'Route fictive des Almadies, Dakar', 'reception@teranga-demo.sn'],
    ['teranga', 'Agence Thiès', 'Boulevard fictif, Thiès', 'reception@teranga-demo.sn'],
    ['baobab', 'Siège — Grand Yoff', 'Rue fictive 12, Grand Yoff', 'admin@baobab-demo.sn'],
    ['baobab', 'Agence Pikine', 'Marché fictif, Pikine', 'admin@baobab-demo.sn'],
    ['sahel', 'Bureau Dakar', 'Rue fictive 5, Mermoz', 'admin@sahel-demo.sn'],
    ['ndar', 'Entrepôt Saint-Louis', 'Zone fictive, Saint-Louis', 'admin@ndar-demo.sn'],
    ['ndar', 'Bureau Dakar Port', 'Môle fictif, Port de Dakar', 'admin@ndar-demo.sn'],
    ['callcenter', 'Plateau Diamniadio', 'Pôle fictif, Diamniadio', 'reception@callcenter-demo.sn'],
  ];
  for (const [o, name, address, email] of siteDefs) {
    const s = await prisma.site.create({ data: { organisationId: org[o].id, name, address, landmark: 'Repère fictif', contactName: 'Réceptionnaire (DÉMO)', contactPhone: '+221 77 000 00 00', contactEmail: email, hours: 'Lun–Ven 8h–17h', lat: 14.69, lng: -17.44 } });
    (sites[o] ??= []).push(s.id);
  }

  // Catalogue
  const products: Record<string, string> = {};
  for (const [sku, name, brand, category, range, offers, price, specs, extra] of CATALOG) {
    const p = await prisma.product.create({
      data: { sku, name, brand, category: category as 'LAPTOP', range: range as 'PRO', offers: offers as 'HYBRIDE'[], purchasePrice: price, specs, aiReady: !!extra?.ai, availability: extra?.stock === false ? 'SUR_COMMANDE' : 'EN_STOCK', leadTimeDays: extra?.lead ?? 5, usage: extra?.usage ?? null },
    });
    products[sku] = p.id;
  }

  // Financeur : grille, enveloppe, refinanceur
  for (const [d, c] of [[24, '4.95'], [36, '3.55']] as const)
    await prisma.coefficientGrid.create({ data: { financerId: bank.id, version: 'BANQUE_PILOTE-2026-v1', durationMonths: d, coefficient: c, residualPct: 0, effectiveFrom: addDays(today, -365), validatedBy: 'valideur@banque-demo.sn' } });
  const nineMonths = new Date(today);
  nineMonths.setUTCMonth(nineMonths.getUTCMonth() + 9);
  await prisma.envelope.create({ data: { financerId: bank.id, name: 'Enveloppe pilote 2026 (démo)', total: 500_000_000, perClientCap: 150_000_000, endDate: nineMonths, alertPcts: [20, 10], whitelist: [org.teranga.id, org.baobab.id, org.callcenter.id] } });
  await prisma.refiLine.create({ data: { refinancerId: refi.id, financerId: bank.id, amount: 300_000_000, quotityPct: 80, criteria: { segments: ['GRANDE_ENTREPRISE', 'INSTITUTION_FINANCIERE'], label: 'Grandes entreprises et institutions financières' }, startDate: addDays(today, -200), endDate: addDays(today, 900) } });

  // Packs (E09)
  await prisma.pack.create({ data: { organisationId: org.teranga.id, name: 'Guichetier', description: 'Thin client t640 + écran 24" + VDI Standard', items: [{ productId: products['TC-T640'], quantity: 1 }, { productId: products['EC-24'], quantity: 1 }], vdiTier: 'STANDARD' } });
  await prisma.pack.create({ data: { organisationId: org.teranga.id, name: 'Commercial terrain', description: 'EliteBook 640 + sacoche + casque', items: [{ productId: products['LP-EB640-16'], quantity: 1 }, { productId: products['SC-STD'], quantity: 1 }, { productId: products['CQ-FIL'], quantity: 1 }], vdiTier: 'AUCUN' } });

  const finYears = (ca: number, rex: number, rn: number, cp: number, dettes: number, n = 3) =>
    Array.from({ length: n }, (_, i) => ({ year: today.getUTCFullYear() - 1 - i, ca: Math.round(ca * (1 - i * 0.06)), rex: Math.round(rex * (1 - i * 0.07)), rn: Math.round(rn * (1 - i * 0.08)), cp: Math.round(cp * (1 - i * 0.05)), dettes, tresorerie: Math.round(ca * 0.08) }));

  async function fillDossier(adminEmail: string, orderId: string, finances: ReturnType<typeof finYears>, opts: { skipDocs?: string[]; skipFinances?: boolean } = {}) {
    await as(adminEmail, async (ctx) => {
      const cf = await ctx.db.creditFile.findUniqueOrThrow({ where: { orderId }, include: { documents: true } });
      const b = cf.blocks as { entreprise: Record<string, unknown> };
      await svc.saveBlock(ctx, orderId, 'entreprise', { ...b.entreprise, activity: b.entreprise.activity || 'Activité fictive', address: b.entreprise.address });
      if (!opts.skipFinances) await svc.saveBlock(ctx, orderId, 'finances', { years: finances, commitments: 'Crédit moyen terme fictif — 120 M FCFA' });
      await svc.saveDeclarations(ctx, orderId, { exactitude: true, ppe: true, orange: true }, { ip: '127.0.0.1', userAgent: 'seed' });
      for (const d of cf.documents) if (d.status === 'A_FOURNIR' && !opts.skipDocs?.includes(d.type)) await svc.uploadDocument(ctx, d.id, { demo: true, ageDays: 20 });
    });
  }

  async function newOrder(adminEmail: string, lines: { sku: string; qty: number; site: string; vdi?: 'STANDARD' | 'PERFORMANCE' }[], duration = 36) {
    return as(adminEmail, async (ctx) => {
      let cart = null;
      for (const l of lines) cart = await svc.addToCart(ctx, { productId: products[l.sku], quantity: l.qty, siteId: l.site, vdiTier: l.vdi, duration });
      return cart!;
    });
  }

  // ═════════ 1. Assurances Teranga — contrat ACTIF, 30 postes Poste mobile Pro, 3 sites, 4 factures dont 1 impayée J+10 ═════════
  console.log('  · Teranga : parcours complet jusqu’au contrat actif (voyage dans le temps)…');
  const t0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 4, 8, 9));
  await setSimDate(t0);
  const tOrder = await newOrder('admin@teranga-demo.sn', sites.teranga.map((s) => ({ sku: 'LP-EB640-16', qty: 10, site: s })));
  await as('admin@teranga-demo.sn', (ctx) => svc.issueQuote(ctx, tOrder.id));
  await as('admin@teranga-demo.sn', (ctx) => svc.acceptQuote(ctx, tOrder.id));
  await as('admin@teranga-demo.sn', (ctx) => svc.requestFinancing(ctx, tOrder.id, { cgu: true, donnees: true, bic: true, ip: '127.0.0.1', userAgent: 'seed' }));
  await fillDossier('admin@teranga-demo.sn', tOrder.id, finYears(18_000_000_000, 2_600_000_000, 1_900_000_000, 6_000_000_000, 1_500_000_000));
  await as('admin@teranga-demo.sn', (ctx) => svc.submitDossier(ctx, tOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.validateAllPending(ctx, tOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.completePrecontrol(ctx, tOrder.id)); // → accord auto → offre émise
  const tCer = await as('admin@teranga-demo.sn', (ctx) => svc.startCeremony(ctx, tOrder.id));
  await signAll(tCer.providerRef);
  const tContract = await prisma.contract.findUniqueOrThrow({ where: { orderId: tOrder.id } });
  await as('valideur@banque-demo.sn', (ctx) => svc.confirmDeposit(ctx, tContract.id));
  await as('valideur@banque-demo.sn', (ctx) => svc.activateMandate(ctx, tContract.id));
  await setSimDate(addDays(t0, 2));
  const po = await as('ops@solink.sn', (ctx) => svc.createPurchaseOrder(ctx, tOrder.id));
  await setSimDate(addDays(t0, 6));
  await as('ops@solink.sn', (ctx) => svc.receivePurchaseOrder(ctx, po.id));
  const tDeliveries = await prisma.delivery.findMany({ where: { orderId: tOrder.id } });
  for (const [i, d] of tDeliveries.entries()) await as('admin@teranga-demo.sn', (ctx) => svc.scheduleDelivery(ctx, d.id, addDays(t0, 9 + i)));
  await setSimDate(addDays(t0, 8));
  await as('ops@solink.sn', (ctx) => svc.shipOrder(ctx, tOrder.id));
  await setSimDate(addDays(t0, 11));
  for (const d of tDeliveries) {
    await as('ops@solink.sn', (ctx) => svc.markDelivered(ctx, d.id));
    await as('reception@teranga-demo.sn', (ctx) => svc.signPv(ctx, d.id, '000000'));
  }
  await setSimDate(addDays(t0, 13));
  const dd = await prisma.disbursement.findFirstOrThrow({ where: { contractId: tContract.id } });
  await as('tresorerie@banque-demo.sn', (ctx) => svc.validateDisbursement(ctx, dd.id));
  await as('tresorerie@banque-demo.sn', (ctx) => svc.confirmDisbursementPaid(ctx, dd.id, 'VIR-BP-DEMO-0001'));
  // Facturation mensuelle : 4 factures, 3 payées, la dernière impayée J+10
  const contractActive = await prisma.contract.findUniqueOrThrow({ where: { id: tContract.id } });
  for (let m = 0; m < 4; m++) {
    const issue = new Date(contractActive.startDate!);
    issue.setUTCMonth(issue.getUTCMonth() + m);
    await setSimDate(addDays(issue, 0.1));
    await svc.runScheduler();
    const inv = await prisma.invoice.findFirst({ where: { contractId: tContract.id }, orderBy: { issueDate: 'desc' } });
    if (inv && m < 3) {
      await setSimDate(addDays(inv.dueDate, -2));
      await as('tresorerie@banque-demo.sn', (ctx) => svc.recordPayment(ctx, inv.id, inv.totalTtc, `ENC-${inv.ref}`));
    }
  }
  const lastInv = await prisma.invoice.findFirstOrThrow({ where: { contractId: tContract.id, status: { not: 'PAYEE' } }, orderBy: { issueDate: 'desc' } });
  // Ajustement de démo : la dernière facture est échue depuis exactement 10 jours (cf. DECISIONS.md).
  const due = addDays(today, -10);
  await prisma.invoice.update({ where: { id: lastInv.id }, data: { dueDate: due, issueDate: addDays(due, -14), status: 'IMPAYEE' } });
  await prisma.installment.updateMany({ where: { invoiceId: lastInv.id }, data: { dueDate: due } });
  await setSimDate(today);
  await svc.runScheduler(); // relances J+1 et J+7

  // Tickets
  await as('admin@teranga-demo.sn', async (ctx) => {
    const dev = await ctx.db.device.findFirstOrThrow({ where: { contractId: tContract.id } });
    await svc.createTicket(ctx, { subject: 'Batterie qui se décharge rapidement', description: 'Le poste tient 2 h sur batterie (démo).', deviceId: dev.id });
    await svc.createTicket(ctx, { subject: 'Ajout d’un compte Microsoft 365', description: 'Nouvel arrivant à l’agence de Thiès (démo).' });
  });

  // ═════════ 2. Call Center Atlantique — signature en cours (signature conjointe) ═════════
  console.log('  · Call Center : accord auto puis signature conjointe en cours…');
  await setSimDate(addDays(today, -6));
  const cOrder = await newOrder('dg@callcenter-demo.sn', [
    { sku: 'TC-T640', qty: 40, site: sites.callcenter[0], vdi: 'STANDARD' },
    { sku: 'CQ-DUO', qty: 40, site: sites.callcenter[0] },
  ]);
  await as('dg@callcenter-demo.sn', (ctx) => svc.issueQuote(ctx, cOrder.id));
  await as('dg@callcenter-demo.sn', (ctx) => svc.acceptQuote(ctx, cOrder.id));
  await as('dg@callcenter-demo.sn', (ctx) => svc.requestFinancing(ctx, cOrder.id, { cgu: true, donnees: true, bic: true, ip: '127.0.0.1', userAgent: 'seed' }));
  await fillDossier('dg@callcenter-demo.sn', cOrder.id, finYears(9_500_000_000, 1_400_000_000, 950_000_000, 3_200_000_000, 900_000_000));
  await setSimDate(addDays(today, -4));
  await as('dg@callcenter-demo.sn', (ctx) => svc.submitDossier(ctx, cOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.validateAllPending(ctx, cOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.completePrecontrol(ctx, cOrder.id));
  await setSimDate(addDays(today, -1));
  const cCer = await as('dg@callcenter-demo.sn', (ctx) => svc.startCeremony(ctx, cOrder.id));
  const dgSigner = cCer.signers.find((s) => s.order === 1)!;
  const r = await as('dg@callcenter-demo.sn', (ctx) => svc.signWithToken(ctx, dgSigner.token, '000000', '127.0.0.1'));
  await svc.run(await actor('admin@solink.sn'), (ctx) => svc.handleEsignEvent(ctx, { type: 'signer_done', providerRef: r.providerRef, signerId: r.signerId }));

  // ═════════ 3. ONG Sahel Santé — en analyse chez la banque, 1 demande de pièces (fournie → DFS v2) ═════════
  console.log('  · ONG Sahel : instruction analyste avec demande de pièces…');
  await setSimDate(addDays(today, -5));
  const sOrder = await newOrder('admin@sahel-demo.sn', [
    { sku: 'LP-E14-8', qty: 12, site: sites.sahel[0] },
    { sku: 'SC-STD', qty: 12, site: sites.sahel[0] },
  ]);
  await as('admin@sahel-demo.sn', (ctx) => svc.issueQuote(ctx, sOrder.id));
  await as('admin@sahel-demo.sn', (ctx) => svc.acceptQuote(ctx, sOrder.id));
  await as('admin@sahel-demo.sn', (ctx) => svc.requestFinancing(ctx, sOrder.id, { cgu: true, donnees: true, bic: true, ip: '127.0.0.1', userAgent: 'seed' }));
  await fillDossier('admin@sahel-demo.sn', sOrder.id, finYears(650_000_000, 60_000_000, 25_000_000, 180_000_000, 40_000_000, 2));
  await as('admin@sahel-demo.sn', (ctx) => svc.submitDossier(ctx, sOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.validateAllPending(ctx, sOrder.id));
  await as('dossier@solink.sn', (ctx) => svc.completePrecontrol(ctx, sOrder.id));
  await setSimDate(addDays(today, -3));
  await as('analyste@banque-demo.sn', (ctx) => svc.requestDocuments(ctx, sOrder.id, [{ type: 'RELEVES_BANCAIRES', message: 'Relevés bancaires des 6 derniers mois', dueDays: 5 }]));
  await setSimDate(addDays(today, -2));
  await as('admin@sahel-demo.sn', async (ctx) => {
    const d = await ctx.db.document.findFirstOrThrow({ where: { creditFile: { orderId: sOrder.id }, origin: 'DEMANDE_BANQUE' } });
    await svc.uploadDocument(ctx, d.id, { demo: true, ageDays: 5 });
    await svc.provideComplements(ctx, sOrder.id);
  });

  // ═════════ 4. Microfinance Baobab — dossier en cours (bloc Finances incomplet) ═════════
  console.log('  · Baobab : dossier en cours…');
  await setSimDate(addDays(today, -2));
  const bOrder = await newOrder('admin@baobab-demo.sn', [
    { sku: 'TC-T540', qty: 15, site: sites.baobab[0], vdi: 'STANDARD' },
    { sku: 'LP-DP14E-8', qty: 5, site: sites.baobab[1] },
    { sku: 'EC-24', qty: 15, site: sites.baobab[0] },
  ]);
  await as('admin@baobab-demo.sn', (ctx) => svc.issueQuote(ctx, bOrder.id));
  await as('admin@baobab-demo.sn', (ctx) => svc.acceptQuote(ctx, bOrder.id));
  await as('admin@baobab-demo.sn', (ctx) => svc.requestFinancing(ctx, bOrder.id, { cgu: true, donnees: true, bic: true, ip: '127.0.0.1', userAgent: 'seed' }));
  await as('admin@baobab-demo.sn', async (ctx) => {
    await svc.saveBlock(ctx, bOrder.id, 'finances', { years: finYears(2_400_000_000, 420_000_000, 210_000_000, 1_500_000_000, 600_000_000, 1), commitments: '' });
    const docs = await ctx.db.document.findMany({ where: { creditFile: { orderId: bOrder.id } } });
    for (const d of docs.filter((x) => ['RCCM', 'NINEA', 'STATUTS', 'POUVOIRS', 'CNI_DIRIGEANT'].includes(x.type))) await svc.uploadDocument(ctx, d.id, { demo: true, ageDays: 10 });
  });

  // ═════════ 5. PME Logistique Ndar — devis émis non accepté ═════════
  console.log('  · Ndar : devis émis…');
  await setSimDate(addDays(today, -1));
  const nOrder = await newOrder('admin@ndar-demo.sn', [
    { sku: 'LP-PB440-8', qty: 6, site: sites.ndar[0] },
    { sku: 'TC-MT32', qty: 4, site: sites.ndar[1], vdi: 'STANDARD' },
  ]);
  await as('admin@ndar-demo.sn', (ctx) => svc.issueQuote(ctx, nOrder.id));

  // Leads Orange
  await setSimDate(today);
  await as('commercial@orange-demo.sn', async (ctx) => {
    await svc.createLead(ctx, { companyName: 'Transports Casamance Démo', segment: 'PME', contactName: 'Ali Badji', contactEmail: 'contact@casamance-demo.sn', need: '25 postes mobiles pour les agences' });
    await svc.createLead(ctx, { companyName: 'Clinique Lumière Démo', segment: 'PME', contactName: 'Dr Ndèye Sy', contactEmail: 'direction@lumiere-demo.sn', need: '15 thin clients + VDI pour l’accueil' });
  });

  await prisma.simClock.update({ where: { id: 1 }, data: { offsetDays: 0 } });
  const counts = { orders: await prisma.order.count(), invoices: await prisma.invoice.count(), devices: await prisma.device.count(), notifications: await prisma.notification.count(), audit: await prisma.auditEvent.count() };
  console.log('✔ Seed terminé', counts);
  void recordInitialTransition;
}

async function signAll(providerRef: string) {
  const cer = await prisma.signatureCeremony.findUniqueOrThrow({ where: { providerRef }, include: { signers: { orderBy: { order: 'asc' } } } });
  for (const s of cer.signers) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
    const res = await as(u.email, (ctx) => svc.signWithToken(ctx, s.token, '000000', '127.0.0.1'));
    await svc.run(await actor('admin@solink.sn'), (ctx) => svc.handleEsignEvent(ctx, { type: s.role === 'BANQUE' ? 'signature_request_done' : 'signer_done', providerRef, signerId: res.signerId }));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
