import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, Input, Select, Button } from '@solink/ui';

/** Liste standard : recherche, filtres, tri, état vide, pagination (CLAUDE.md §10). Filtrage en mémoire (volumes de démo). */
export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  className?: string;
}

export interface Filter<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  match: (row: T, value: string) => boolean;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function ListView<T>({
  rows,
  columns,
  searchParams,
  search,
  filters = [],
  basePath,
  pageSize = 10,
  empty,
  rowKey,
  testId,
}: {
  rows: T[];
  columns: Column<T>[];
  searchParams: SP;
  search?: (row: T) => string;
  filters?: Filter<T>[];
  basePath: string;
  pageSize?: number;
  empty?: { title: string; description?: string };
  rowKey: (row: T) => string;
  testId?: string;
}) {
  const q = one(searchParams.q).toLowerCase();
  const sort = one(searchParams.tri);
  const dir = one(searchParams.ordre) === 'desc' ? -1 : 1;
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  let data = rows;
  if (q && search) data = data.filter((r) => search(r).toLowerCase().includes(q));
  for (const f of filters) {
    const v = one(searchParams[f.key]);
    if (v) data = data.filter((r) => f.match(r, v));
  }
  const col = columns.find((c) => c.key === sort && c.sort);
  if (col?.sort) data = [...data].sort((a, b) => (col.sort!(a) > col.sort!(b) ? dir : col.sort!(a) < col.sort!(b) ? -dir : 0));
  const total = data.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const slice = data.slice((page - 1) * pageSize, page * pageSize);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (one(v)) p.set(k, one(v));
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `${basePath}${s ? `?${s}` : ''}`;
  };
  const hasFilters = !!search || filters.length > 0;
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      {hasFilters ? (
        <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end" action={basePath}>
          {search ? <Input name="q" defaultValue={one(searchParams.q)} placeholder="Rechercher…" aria-label="Rechercher" className="sm:max-w-xs" /> : null}
          {filters.map((f) => (
            <Select key={f.key} name={f.key} defaultValue={one(searchParams[f.key])} aria-label={f.label} className="sm:max-w-[220px]">
              <option value="">{f.label} : tous</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ))}
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
          {(q || filters.some((f) => one(searchParams[f.key]))) && (
            <Link href={basePath} className="text-sm">
              Réinitialiser
            </Link>
          )}
        </form>
      ) : null}
      {total === 0 ? (
        <EmptyState title={empty?.title ?? 'Aucun élément'} description={empty?.description ?? (q ? 'Aucun résultat pour cette recherche.' : undefined)} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table>
            <thead className="bg-slate-50">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={`px-3 py-2 ${c.className ?? ''}`} scope="col">
                    {c.sort ? (
                      <Link href={qs({ tri: c.key, ordre: sort === c.key && dir === 1 ? 'desc' : 'asc', page: '' })} className="text-slate-600 hover:text-slate-900">
                        {c.label} {sort === c.key ? (dir === 1 ? '▲' : '▼') : ''}
                      </Link>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slice.map((r) => (
                <tr key={rowKey(r)} className="hover:bg-slate-50">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2 align-top ${c.className ?? ''}`}>
                      {c.render(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-slate-500">
            {total} élément(s) — page {page}/{pages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Précédent</Link> : null}
            {page < pages ? <Link href={qs({ page: String(page + 1) })}>Suivant →</Link> : null}
          </div>
        </nav>
      ) : total ? (
        <p className="text-xs text-slate-400">{total} élément(s)</p>
      ) : null}
    </div>
  );
}
