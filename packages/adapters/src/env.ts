import { existsSync } from 'node:fs';
import path from 'node:path';

/** Racine du monorepo (repère : pnpm-workspace.yaml). */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

export function storageDir(): string {
  const s = process.env.STORAGE_DIR ?? './storage';
  return path.isAbsolute(s) ? s : path.join(repoRoot(), s);
}

export const isDemo = () => (process.env.DEMO_MODE ?? 'true') === 'true';
export const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000';
