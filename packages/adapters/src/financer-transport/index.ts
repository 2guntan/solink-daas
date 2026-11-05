import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { storageDir } from '../env';

/** Interface FinancerTransport — Portail (natif) + SFTP simulé (./storage/sftp/out et ./storage/sftp/in). */
export interface DecisionRow {
  financingRequest: string;
  result: string;
  amount: number | null;
  duration: number | null;
  validUntil: string | null;
  reason: string;
  line: number;
  file: string;
}

export interface FinancerTransport {
  pushDfs(fileName: string, zip: Buffer, ack: Record<string, unknown>): Promise<{ path: string }>;
  pullDecisions(): Promise<DecisionRow[]>;
  archiveDecisionFile(file: string): Promise<void>;
}

const outDir = () => path.join(storageDir(), 'sftp', 'out');
const inDir = () => path.join(storageDir(), 'sftp', 'in');

export const DECISION_CSV_HEADER = 'financing_request;result;amount_xof;duration_months;valid_until;internal_reason';

export const simFinancerTransport: FinancerTransport = {
  async pushDfs(fileName, zip, ack) {
    await mkdir(outDir(), { recursive: true });
    const p = path.join(outDir(), fileName);
    await writeFile(p, zip);
    await writeFile(p.replace(/\.zip$/, '.ack.json'), JSON.stringify(ack, null, 2));
    return { path: path.relative(storageDir(), p) };
  },
  async pullDecisions() {
    await mkdir(inDir(), { recursive: true });
    const files = (await readdir(inDir())).filter((f) => f.endsWith('.csv'));
    const rows: DecisionRow[] = [];
    for (const file of files) {
      const lines = (await readFile(path.join(inDir(), file), 'utf8')).split(/\r?\n/).filter(Boolean);
      lines.slice(1).forEach((l, i) => {
        const [fr, result, amount, duration, validUntil, reason] = l.split(';');
        rows.push({
          financingRequest: fr,
          result,
          amount: amount ? Number(amount) : null,
          duration: duration ? Number(duration) : null,
          validUntil: validUntil || null,
          reason: reason ?? '',
          line: i + 2,
          file,
        });
      });
    }
    return rows;
  },
  async archiveDecisionFile(file) {
    await mkdir(path.join(inDir(), 'traites'), { recursive: true });
    await rename(path.join(inDir(), file), path.join(inDir(), 'traites', file));
  },
};

export const financerTransport: FinancerTransport = simFinancerTransport;
