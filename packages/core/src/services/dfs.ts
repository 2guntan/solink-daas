import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { fileStore, financerTransport, llm } from '@solink/adapters';
import { audit } from '../audit';
import { canonical, sha256 } from '../hash';
import { fcfa, date } from '../format';
import { renderPdf } from '../pdf/render';
import { consentsSpec, synthesisSpec } from '../pdf/documents';
import { DOC_STATUS_LABEL, SEGMENT_LABEL } from '../status';
import { SCORING_RULESET_VERSION } from '../scoring';
import type { Ctx } from './context';

/**
 * Dossier de Financement Standardisé (v4 §8.2) : paquet scellé, versionné, hashé.
 * manifest.json · dossier.json · fiche_synthese.pdf · devis.pdf · pieces/ · consentements.pdf · audit.json
 */
export interface ManifestFile {
  path: string;
  sha256: string;
}

export interface DfsDiff {
  added: string[];
  removed: string[];
  modified: string[];
}

export function diffManifests(prev: ManifestFile[] | null, next: ManifestFile[]): DfsDiff {
  const p = new Map((prev ?? []).map((f) => [f.path, f.sha256]));
  const n = new Map(next.map((f) => [f.path, f.sha256]));
  return {
    added: [...n.keys()].filter((k) => !p.has(k)),
    removed: [...p.keys()].filter((k) => !n.has(k)),
    modified: [...n.keys()].filter((k) => p.has(k) && p.get(k) !== n.get(k)),
  };
}

async function zip(files: { path: string; data: Buffer }[]): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 6 } });
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    out.on('end', () => resolve());
    archive.on('error', reject);
  });
  archive.pipe(out);
  const fixed = new Date('2026-01-01T00:00:00Z');
  for (const f of files) archive.append(f.data, { name: f.path, date: fixed });
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}

export async function synthesisData(ctx: Ctx, orderId: string) {
  const order = await ctx.db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { organisation: true, financer: true, creditFile: { include: { documents: true } }, lines: { include: { product: true } } },
  });
  const cf = order.creditFile!;
  const factors = (cf.factors ?? []) as { label: string; points: number; max: number; detail: string }[];
  const ageYears = order.organisation.createdOn ? Math.floor((ctx.at.getTime() - order.organisation.createdOn.getTime()) / (365.25 * 86400000)) : 0;
  const seats = order.lines.reduce((a, l) => a + l.quantity, 0);
  const s = await llm.analystSynthesis({
    orgName: order.organisation.name,
    segment: SEGMENT_LABEL[order.organisation.segment ?? ''] ?? '',
    sector: order.organisation.sector,
    ageYears,
    need: `${seats} équipements (${[...new Set(order.lines.map((l) => l.product.name))].slice(0, 3).join(', ')})`,
    amount: fcfa(order.financedAmount),
    monthly: fcfa(order.monthlyTtc),
    duration: order.durationMonths,
    score: cf.score ?? 0,
    riskClass: cf.riskClass ?? '—',
    factors,
    knockouts: (cf.knockouts ?? []) as string[],
    documents: cf.documents.map((d) => ({ label: d.label, status: d.status })),
  });
  return { order, cf, factors, synthesis: s };
}

export async function buildAndTransmitDfs(ctx: Ctx, orderId: string, channel = 'PORTAIL+SFTP') {
  const { order, cf, factors, synthesis } = await synthesisData(ctx, orderId);
  const prev = await ctx.db.dfsPackage.findFirst({ where: { creditFileId: cf.id }, orderBy: { version: 'desc' } });
  const version = (prev?.version ?? 0) + 1;
  const frRef = order.ref.replace('CMD', 'FR');
  const packageId = `DFS-${frRef}-v${version}`;
  const files: { path: string; data: Buffer }[] = [];
  const ninea = (order.organisation.ninea ?? 'NA').replace(/[^\w]/g, '');

  // Pièces validées (nomenclature TYPE_NINEA_DATE_vN)
  for (const d of cf.documents) {
    if (!d.fileId || !['VALIDEE', 'EN_VERIFICATION'].includes(d.status)) continue;
    const f = await fileStore.get(ctx.db, d.fileId);
    if (!f) continue;
    const ext = f.mime === 'application/pdf' ? 'pdf' : f.mime === 'image/png' ? 'png' : 'jpg';
    const stamp = (d.docDate ?? ctx.at).toISOString().slice(0, 10).replace(/-/g, '');
    files.push({ path: `pieces/${d.type}_${ninea}_${stamp}_v${d.version}.${ext}`, data: f.data });
  }
  const quote = await ctx.db.quote.findFirst({ where: { orderId, status: 'ACCEPTE' }, orderBy: { version: 'desc' } });
  if (quote?.pdfFileId) {
    const f = await fileStore.get(ctx.db, quote.pdfFileId);
    if (f) files.push({ path: 'devis.pdf', data: f.data });
  }
  const env = await ctx.db.envelope.findFirst({ where: { financerId: order.financerId, active: true } });
  const dossierJson = {
    schema: 'solink.dfs.dossier/1.0',
    financing_request: frRef,
    order_ref: order.ref,
    version,
    organisation: {
      name: order.organisation.name,
      ninea: order.organisation.ninea,
      rccm: order.organisation.rccm,
      segment: order.organisation.segment,
      sector: order.organisation.sector,
      created_on: order.organisation.createdOn,
    },
    blocks: cf.blocks,
    financing: { amount_xof: order.financedAmount, monthly_ttc_xof: order.monthlyTtc, duration_months: order.durationMonths, deposit_xof: order.depositTtc },
    scoring: { score: cf.score, risk_class: cf.riskClass, factors, knockouts: cf.knockouts, route: cf.route, ruleset: SCORING_RULESET_VERSION },
    envelope_simulation: env ? { total: env.total, reserved: env.reserved, consumed: env.consumed, available_after: env.total - env.reserved - env.consumed - order.financedAmount } : null,
    documents: cf.documents.map((d) => ({ type: d.type, label: d.label, status: d.status, version: d.version, sha256: d.sha256, origin: d.origin })),
  };
  files.push({ path: 'dossier.json', data: Buffer.from(JSON.stringify(dossierJson, null, 2)) });
  const fiche = await renderPdf(
    synthesisSpec({
      orderRef: `${order.ref} — ${packageId}`,
      org: order.organisation.name,
      lines: synthesis.text,
      kv: [
        ['Financeur', order.financer.name],
        ['Montant financé', fcfa(order.financedAmount)],
        ['Mensualité TTC', fcfa(order.monthlyTtc)],
        ['Durée', `${order.durationMonths} mois`],
        ['Score / classe', `${cf.score ?? '—'} / ${cf.riskClass ?? '—'}`],
        ['Voie recommandée', cf.route ?? '—'],
        ['Date', date(ctx.at)],
      ],
      factors,
      docs: cf.documents.map((d) => ({ label: d.label, status: DOC_STATUS_LABEL[d.status] })),
      disclaimer: synthesis.disclaimer,
    }),
  );
  files.push({ path: 'fiche_synthese.pdf', data: fiche });
  const consents = await ctx.db.consent.findMany({ where: { orderId }, orderBy: { at: 'asc' } });
  const users = await ctx.db.user.findMany({ where: { id: { in: consents.map((c) => c.userId) } } });
  files.push({
    path: 'consentements.pdf',
    data: await renderPdf(consentsSpec(order.ref, consents.map((c) => ({ type: c.type, text: c.text, version: c.textVersion, at: c.at, ip: c.ip, ua: c.userAgent, user: users.find((u) => u.id === c.userId)?.email ?? c.userId })))),
  });
  const auditEvents = await ctx.db.auditEvent.findMany({ where: { entityId: { in: [orderId, cf.id, ...cf.documents.map((d) => d.id)] } }, orderBy: { seq: 'asc' } });
  files.push({ path: 'audit.json', data: Buffer.from(JSON.stringify(auditEvents.map((e) => ({ seq: e.seq, at: e.at, entity: e.entity, action: e.action, actor: e.actorId, hash: e.hash, prev: e.prevHash })), null, 2)) });

  const manifestFiles: ManifestFile[] = files.map((f) => ({ path: f.path, sha256: sha256(f.data) })).sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    package_id: packageId,
    order_ref: order.ref,
    financing_request: frRef,
    financer: 'BANQUE_PILOTE',
    version,
    created_at: ctx.at.toISOString(),
    checklist_version: cf.checklistVersion,
    scoring_ruleset_version: SCORING_RULESET_VERSION,
    files: manifestFiles,
    previous_package_sha256: prev?.manifestSha256 ?? null,
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
  const manifestSha256 = sha256(canonical(manifest));
  const zipBuf = await zip([{ path: 'manifest.json', data: manifestBuf }, ...files]);
  const stored = await fileStore.put(ctx.db, `${packageId}.zip`, 'application/zip', zipBuf, 'dfs');
  const diff = diffManifests(prev ? ((prev.manifest as unknown as { files: ManifestFile[] }).files ?? []) : null, manifestFiles);
  const pkg = await ctx.db.dfsPackage.create({
    data: { creditFileId: cf.id, version, packageId, manifest: manifest as unknown as object, manifestSha256, previousSha256: prev?.manifestSha256 ?? null, diff: prev ? (diff as object) : undefined, channel, zipFileId: stored.id, transmittedAt: ctx.at },
  });
  await financerTransport.pushDfs(`${packageId}.zip`, zipBuf, { package_id: packageId, manifest_sha256: manifestSha256, deposited_at: ctx.at.toISOString() });
  await audit(ctx.db, 'DfsPackage', pkg.id, 'DFS_SCELLE_TRANSMIS', ctx.actor.userId, { packageId, manifestSha256, previous: prev?.manifestSha256 ?? null });
  return { pkg, diff, manifest };
}
