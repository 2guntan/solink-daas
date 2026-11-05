import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Tx } from '@solink/db';
import { storageDir } from '../env';

/** Interface FileStore (S3 en P2) — implémentation disque local ./storage. */
export interface FileStore {
  put(db: Tx, name: string, mime: string, data: Buffer, folder?: string): Promise<{ id: string; sha256: string }>;
  get(db: Tx, id: string): Promise<{ name: string; mime: string; data: Buffer; sha256: string } | null>;
}

export const localFileStore: FileStore = {
  async put(db, name, mime, data, folder = 'files') {
    const sha256 = createHash('sha256').update(data).digest('hex');
    const rel = path.join(folder, `${randomUUID()}-${name.replace(/[^\w.-]+/g, '_')}`);
    const abs = path.join(storageDir(), rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
    const f = await db.storedFile.create({ data: { path: rel, name, mime, size: data.length, sha256 } });
    return { id: f.id, sha256 };
  },
  async get(db, id) {
    const f = await db.storedFile.findUnique({ where: { id } });
    if (!f) return null;
    const data = await readFile(path.join(storageDir(), f.path));
    return { name: f.name, mime: f.mime, data, sha256: f.sha256 };
  },
};

export const fileStore: FileStore = localFileStore;
