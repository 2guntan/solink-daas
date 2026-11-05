import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TRANSITIONS, allowedNext, findRule } from '../src/order-machine';
import { STATUS_INFO } from '../src/status';
import { canonical, sha256 } from '../src/hash';
import { signPayload, verifySignature } from '../src/services/webhooks';

describe('machine à états de la commande', () => {
  it('le parcours nominal est entièrement couvert par la table', () => {
    const path_ = ['PANIER', 'DEVIS_EMIS', 'DEVIS_ACCEPTE', 'DOSSIER_EN_COURS', 'PRE_CONTROLE', 'TRANSMIS_FINANCEUR', 'EN_ANALYSE', 'ACCORDE', 'OFFRE_EMISE', 'SIGNATURE_CLIENT', 'CONTRESIGNATURE', 'CONDITIONS_SUSPENSIVES', 'PRET_POUR_ACHAT', 'ACHETE', 'EN_PREPARATION', 'EXPEDIE', 'PV_A_SIGNER', 'DECAISSEMENT_DEMANDE', 'ACTIF', 'FIN_DE_CONTRAT', 'CLOS'] as const;
    for (let i = 0; i < path_.length - 1; i++) expect(findRule(path_[i], path_[i + 1]), `${path_[i]}→${path_[i + 1]}`).toBeDefined();
  });
  it('on ne peut pas acheter directement depuis les conditions suspensives', () => {
    expect(findRule('CONDITIONS_SUSPENSIVES', 'ACHETE')).toBeUndefined();
    expect(findRule('CONDITIONS_SUSPENSIVES', 'PRET_POUR_ACHAT')?.guard).toBeDefined();
  });
  it('accord auto = SYSTEME uniquement ; décision analyste = banque uniquement', () => {
    expect(findRule('TRANSMIS_FINANCEUR', 'ACCORDE')!.roles).toEqual(['SYSTEME']);
    expect(findRule('EN_ANALYSE', 'ACCORDE')!.roles.every((r) => r.startsWith('BANQUE_'))).toBe(true);
    expect(findRule('EN_ANALYSE', 'REFUSE')!.roles).not.toContain('SYSTEME');
  });
  it('les états terminaux n’ont aucune sortie', () => {
    for (const s of ['REFUSE', 'CLOS', 'ANNULE', 'EXPIRE', 'ECHEC'] as const) expect(allowedNext(s)).toEqual([]);
  });
  it('chaque état a un libellé client', () => {
    for (const t of TRANSITIONS) expect(STATUS_INFO[t.to].label).toBeTruthy();
  });
});

function walk(dir: string, out: string[] = []) {
  for (const f of readdirSync(dir)) {
    if (['node_modules', '.next', 'tests', 'storage'].includes(f)) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

describe('règle : aucun UPDATE du statut de commande hors order-machine.ts', () => {
  it('aucun order.update / updateMany ne modifie status ailleurs', () => {
    const root = path.resolve(__dirname, '../../..');
    const files = [...walk(path.join(root, 'packages')), ...walk(path.join(root, 'apps'))].filter((f) => !f.endsWith('order-machine.ts'));
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const re = /\.order\.(update|updateMany|upsert)\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const chunk = src.slice(m.index, m.index + 600);
        let depth = 0;
        let end = 0;
        for (let i = chunk.indexOf('('); i < chunk.length; i++) {
          if (chunk[i] === '(') depth++;
          if (chunk[i] === ')') depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
        if (/\bstatus\s*:/.test(chunk.slice(0, end || 600))) offenders.push(`${path.relative(root, f)}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('preuve : hash canonique et webhooks HMAC', () => {
  it('hash canonique indépendant de l’ordre des clés', () => {
    expect(sha256(canonical({ b: 1, a: [1, { d: 2, c: 3 }] }))).toBe(sha256(canonical({ a: [1, { c: 3, d: 2 }], b: 1 })));
  });
  it('signature HMAC vérifiable, rejet si altérée ou rejouée', () => {
    const body = JSON.stringify({ event: 'x' });
    const ts = 1_800_000_000;
    const sig = signPayload(body, ts, 's3cret');
    expect(verifySignature(sig, body, 's3cret', 300, ts + 10)).toBe(true);
    expect(verifySignature(sig, body + ' ', 's3cret', 300, ts + 10)).toBe(false);
    expect(verifySignature(sig, body, 's3cret', 300, ts + 1000)).toBe(false);
  });
});
