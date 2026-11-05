import { prisma, type ConditionNature, type ConditionType, type DecisionResult, type OrderStatus } from '@solink/db';
import { fileStore } from '@solink/adapters';
import { daysBetween, isBusinessError, now, svc, type Actor } from '@solink/core';

/**
 * API Financeur (v4 §14.2). Auth démo : `Authorization: Bearer partner_demo_key` (compte technique api@banque-demo.sn).
 * Idempotency-Key obligatoire sur tout POST/PUT ; erreurs { error: { code, message } }.
 */
const err = (code: string, message: string, status = 400) => Response.json({ error: { code, message } }, { status });

const STATUS_MAP: Record<string, OrderStatus> = { TRANSMITTED: 'TRANSMIS_FINANCEUR', IN_REVIEW: 'EN_ANALYSE', MORE_DOCUMENTS: 'PIECES_COMPLEMENTAIRES', APPROVED: 'ACCORDE', APPROVED_WITH_CONDITIONS: 'ACCORDE_SOUS_CONDITIONS', REJECTED: 'REFUSE' };
const RESULT_MAP: Record<string, DecisionResult> = { APPROVED: 'ACCORDE', APPROVED_WITH_CONDITIONS: 'ACCORDE_SOUS_CONDITIONS', REJECTED: 'REFUSE', NO_FOLLOW_UP: 'SANS_SUITE' };
const DISB_MAP: Record<string, string> = { REQUESTED: 'DEMANDEE', VALIDATED: 'VALIDEE', PAID: 'PAYEE', REJECTED: 'REJETEE' };

async function auth(req: Request): Promise<Actor | null> {
  const h = req.headers.get('authorization') ?? '';
  if (h !== `Bearer ${process.env.PARTNER_API_KEY ?? 'partner_demo_key'}`) return null;
  const u = await prisma.user.findUnique({ where: { email: 'api@banque-demo.sn' } });
  return u ? svc.loadActor(u.id) : null;
}

const frToOrder = (fr: string) => prisma.order.findFirst({ where: { ref: fr.replace(/^FR-/, 'CMD-') }, include: { creditFile: { include: { packages: { orderBy: { version: 'desc' } } } }, organisation: true, contract: true } });

async function handle(req: Request, path: string[], actor: Actor): Promise<Response> {
  const method = req.method;
  const url = new URL(req.url);
  const [res, id, sub, subId] = path;
  const body = method === 'POST' || method === 'PUT' ? await req.json().catch(() => ({})) : {};
  const run = <T,>(fn: (ctx: svc.Ctx) => Promise<T>) => svc.run(actor, fn);

  if (res === 'financing-requests') {
    if (!id && method === 'GET') {
      const st = url.searchParams.get('status');
      const since = url.searchParams.get('since');
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 50));
      const cursor = url.searchParams.get('cursor');
      const orders = await prisma.order.findMany({
        where: { financerId: actor.orgId, creditFile: { packages: { some: {} } }, ...(st ? { status: STATUS_MAP[st] ?? (st as OrderStatus) } : {}), ...(since ? { statusChangedAt: { gte: new Date(since) } } : {}), ...(cursor ? { ref: { gt: cursor.replace('FR', 'CMD') } } : {}) },
        include: { organisation: true, creditFile: { include: { packages: { orderBy: { version: 'desc' }, take: 1 } } } },
        orderBy: { ref: 'asc' },
        take: limit,
      });
      const data = orders.map((o) => ({ id: o.ref.replace('CMD', 'FR'), status: o.status, organisation: o.organisation.name, amount_xof: o.financedAmount, duration_months: o.durationMonths, current_package: o.creditFile?.packages[0]?.packageId, route: o.creditFile?.route, score: o.creditFile?.score }));
      return Response.json({ data, next_cursor: orders.length === limit ? data[data.length - 1].id : null });
    }
    const o = await frToOrder(id);
    if (!o || o.financerId !== actor.orgId || !o.creditFile) return err('DOSSIER_INTROUVABLE', 'Dossier introuvable', 404);
    if (!sub && method === 'GET') {
      const pkg = o.creditFile.packages[0];
      return Response.json({ id, status: o.status, current_version: pkg?.version, package_id: pkg?.packageId, manifest_sha256: pkg?.manifestSha256, dossier: { blocks: o.creditFile.blocks, score: o.creditFile.score, risk_class: o.creditFile.riskClass, factors: o.creditFile.factors, knockouts: o.creditFile.knockouts, route: o.creditFile.route }, versions: o.creditFile.packages.map((p) => ({ version: p.version, package_id: p.packageId, diff: p.diff })) });
    }
    if (sub === 'packages' && method === 'GET') {
      const pkg = o.creditFile.packages.find((p) => String(p.version) === subId);
      if (!pkg?.zipFileId) return err('VERSION_INTROUVABLE', 'Version introuvable', 404);
      const f = await fileStore.get(prisma, pkg.zipFileId);
      return new Response(new Uint8Array(f!.data), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${pkg.packageId}.zip"`, 'x-manifest-sha256': pkg.manifestSha256 } });
    }
    if (sub === 'acknowledge' && method === 'POST') {
      await run((ctx) => svc.acknowledge(ctx, o.id));
      return Response.json({ id, status: 'EN_ANALYSE' });
    }
    if (sub === 'document-requests' && method === 'POST') {
      const docs = (body.documents ?? []) as { type: string; message?: string; due_days?: number }[];
      const created = await run((ctx) => svc.requestDocuments(ctx, o.id, docs.map((d) => ({ type: d.type, message: d.message ?? '', dueDays: d.due_days ?? 3 }))));
      return Response.json({ id, status: 'PIECES_COMPLEMENTAIRES', requested: created.map((d) => ({ type: d.type, due_date: d.dueDate })) }, { status: 201 });
    }
    if (sub === 'decision' && method === 'POST') {
      const result = RESULT_MAP[body.result];
      if (!result) return err('RESULTAT_INVALIDE', 'result ∈ APPROVED | APPROVED_WITH_CONDITIONS | REJECTED | NO_FOLLOW_UP', 422);
      const at = await now(prisma);
      const validityDays = body.valid_until ? Math.max(1, daysBetween(at, new Date(body.valid_until))) : undefined;
      const conditions = ((body.conditions ?? []) as { type: ConditionType; nature: ConditionNature; label?: string; value_pct?: string; document_type?: string }[]).map((c) => ({ type: c.type, nature: c.nature, label: c.label ?? c.document_type ?? c.type, value: c.value_pct ?? c.document_type }));
      const d = await run((ctx) => svc.decide(ctx, o.id, { result, amount: body.amount_approved_xof, durationMonths: body.duration_months, validityDays, internalReason: body.internal_reason_code, conditions, idempotencyKey: req.headers.get('idempotency-key') ?? undefined }));
      return Response.json({ id, decision_id: d.id, result: body.result }, { status: 201 });
    }
  }
  if (res === 'contracts' && id && method === 'GET') {
    const c = await prisma.contract.findFirst({ where: { ref: id, financerId: actor.orgId }, include: { documents: true, ceremonies: { include: { signers: true } }, mandate: true } });
    if (!c) return err('CONTRAT_INTROUVABLE', 'Contrat introuvable', 404);
    return Response.json({ id: c.ref, status: c.status, signed_at: c.signedAt, deposit_received_at: c.depositReceivedAt, mandate: c.mandate?.status, documents: c.documents.map((d) => ({ kind: d.kind, title: d.title, sha256: d.sha256, signed_sha256: d.signedSha256 })), signatures: c.ceremonies.flatMap((x) => x.signers.map((s) => ({ order: s.order, role: s.role, status: s.status, signed_at: s.signedAt }))) });
  }
  if (res === 'disbursement-requests') {
    if (!id && method === 'GET') {
      const st = url.searchParams.get('status');
      const rows = await prisma.disbursement.findMany({ where: { contract: { financerId: actor.orgId }, ...(st ? { status: (DISB_MAP[st] ?? st) as 'DEMANDEE' } : {}) }, include: { contract: true } });
      return Response.json({ data: rows.map((d) => ({ id: d.ref, contract: d.contract.ref, amount_xof: d.amount, status: d.status, pieces: d.pieces, requested_at: d.requestedAt })) });
    }
    const d = await prisma.disbursement.findFirst({ where: { ref: id, contract: { financerId: actor.orgId } } });
    if (!d) return err('DECAISSEMENT_INTROUVABLE', 'Demande introuvable', 404);
    if (method === 'POST' && sub === 'validate') await run((ctx) => svc.validateDisbursement(ctx, d.id));
    else if (method === 'POST' && sub === 'reject') await run((ctx) => svc.rejectDisbursement(ctx, d.id, body.reason ?? 'Rejet API'));
    else if (method === 'POST' && sub === 'paid') await run((ctx) => svc.confirmDisbursementPaid(ctx, d.id, body.payment_reference ?? `VIR-${d.ref}`));
    else return err('ROUTE_INCONNUE', 'Route inconnue', 404);
    const after = await prisma.disbursement.findUniqueOrThrow({ where: { id: d.id } });
    return Response.json({ id: d.ref, status: after.status });
  }
  if (res === 'envelopes' && id && method === 'PUT') {
    await run((ctx) => svc.updateEnvelope(ctx, id, { total: body.total_xof, perClientCap: body.per_client_cap_xof, endDate: body.end_date ? new Date(body.end_date) : undefined, whitelist: body.whitelist }));
    return Response.json({ id, updated: true });
  }
  if (res === 'coefficient-grids' && method === 'PUT') {
    const v = await run((ctx) => svc.publishGrid(ctx, (body.rows ?? []).map((r: { duration_months: number; coefficient: string }) => ({ durationMonths: r.duration_months, coefficient: String(r.coefficient) }))));
    return Response.json({ version: v });
  }
  if (res === 'portfolio' && method === 'GET') {
    const contracts = await prisma.contract.findMany({ where: { financerId: actor.orgId }, include: { invoices: true, devices: true } });
    const at = await now(prisma);
    if (id === 'positions') return Response.json({ data: contracts.map((c) => ({ contract: c.ref, status: c.status, financed_xof: c.financedAmount, monthly_ttc_xof: c.monthlyTtc, start: c.startDate, end: c.endDate, locked_devices: c.devices.filter((d) => d.status === 'VERROUILLE').length, refi_eligible: c.refiEligible })) });
    if (id === 'aging') {
      const buckets: Record<string, number> = { '0': 0, '1-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };
      for (const c of contracts) for (const i of c.invoices.filter((x) => x.status !== 'PAYEE')) {
        const d = Math.max(0, daysBetween(i.dueDate, at));
        const k = d === 0 ? '0' : d <= 15 ? '1-15' : d <= 30 ? '16-30' : d <= 60 ? '31-60' : '60+';
        buckets[k] += i.totalTtc - i.paidAmount;
      }
      return Response.json({ as_of: at, buckets_xof: buckets });
    }
  }
  if (res === 'devices' && id && sub === 'lock-orders' && method === 'POST') {
    const dev = await prisma.device.findUnique({ where: { serial: id }, include: { contract: true } });
    if (!dev?.contract || dev.contract.financerId !== actor.orgId) return err('EQUIPEMENT_INTROUVABLE', 'Équipement introuvable', 404);
    const lo = await run(async (ctx) => {
      let l = await ctx.db.lockOrder.findFirst({ where: { contractId: dev.contractId!, status: 'PROPOSE' } });
      if (!l) l = await ctx.db.lockOrder.create({ data: { contractId: dev.contractId!, reason: body.reason ?? 'Ordre API financeur', proposedAt: ctx.at } });
      await svc.orderLock(ctx, l.id, body.reason ?? 'Ordre API financeur');
      return l;
    });
    return Response.json({ lock_order: lo.id, status: 'ORDONNE', execution: 'humaine (SOLINK MDM)' }, { status: 201 });
  }
  return err('ROUTE_INCONNUE', `Route inconnue : ${method} /${path.join('/')}`, 404);
}

async function entry(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const actor = await auth(req);
  if (!actor) return err('NON_AUTORISE', 'Clé API invalide (démo : Bearer partner_demo_key)', 401);
  const mutating = req.method === 'POST' || req.method === 'PUT';
  const key = req.headers.get('idempotency-key');
  if (mutating && !key) return err('IDEMPOTENCY_KEY_REQUISE', 'En-tête Idempotency-Key obligatoire sur POST/PUT', 400);
  if (mutating && key) {
    const prev = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (prev) {
      const r = prev.response as { status: number; body: unknown };
      return Response.json(r.body, { status: r.status, headers: { 'idempotent-replay': 'true' } });
    }
  }
  try {
    const res = await handle(req, path, actor);
    if (mutating && key && res.headers.get('content-type')?.includes('json')) {
      const bodyJson = await res.clone().json();
      await prisma.idempotencyKey.create({ data: { key, scope: path.join('/'), response: { status: res.status, body: bodyJson } } }).catch(() => undefined);
    }
    return res;
  } catch (e) {
    if (isBusinessError(e)) return err(e.code, e.message, e.httpStatus === 403 ? 403 : 409);
    console.error(e);
    return err('ERREUR_INTERNE', 'Erreur interne', 500);
  }
}

export { entry as GET, entry as POST, entry as PUT };
