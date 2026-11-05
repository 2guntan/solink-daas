import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, Input, Select, Button, buttonVariants, cn } from '@solink/ui';

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

function SortIcon({ dir }: { dir: 0 | 1 | -1 }) {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={cn('ml-1 inline-block align-[-1px]', dir === 0 ? 'text-neutral-300' : 'text-neutral-900')}>
      {dir === -1 ? <path d="M3 5l3 3 3-3" /> : dir === 1 ? <path d="M3 7l3-3 3 3" /> : <path d="M3 4.5l3-2.5 3 2.5M3 7.5l3 2.5 3-2.5" />}
    </svg>
  );
}

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
  const filtered = q || filters.some((f) => one(searchParams[f.key]));
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      {hasFilters ? (
        <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" action={basePath}>
          {search ? (
            <div className="relative sm:w-64">
              <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <Input name="q" defaultValue={one(searchParams.q)} placeholder="Rechercher…" aria-label="Rechercher" className="pl-9" />
            </div>
          ) : null}
          {filters.map((f) => (
            <Select key={f.key} name={f.key} defaultValue={one(searchParams[f.key])} aria-label={f.label} className="sm:w-auto sm:min-w-[160px] sm:max-w-[220px]">
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
          {filtered ? (
            <Link href={basePath} className={buttonVariants({ variant: 'ghost' })}>
              Réinitialiser
            </Link>
          ) : null}
        </form>
      ) : null}
      {total === 0 ? (
        <EmptyState title={empty?.title ?? 'Aucun élément'} description={empty?.description ?? (q ? 'Aucun résultat pour cette recherche.' : undefined)} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <table>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cn('border-b border-neutral-200 bg-neutral-50/60 px-4 py-2.5 text-xs font-medium text-neutral-500 first:pl-5 last:pr-5', c.className)} scope="col">
                    {c.sort ? (
                      <Link href={qs({ tri: c.key, ordre: sort === c.key && dir === 1 ? 'desc' : 'asc', page: '' })} className="text-neutral-500 no-underline hover:text-neutral-900 hover:no-underline">
                        {c.label}
                        <SortIcon dir={sort === c.key ? (dir === 1 ? 1 : -1) : 0} />
                      </Link>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={rowKey(r)} className="border-t border-neutral-100 transition-colors first:border-t-0 hover:bg-neutral-50/70">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-4 py-3 align-top first:pl-5 last:pr-5', c.className)}>
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
        <nav className="flex items-center justify-between text-[13px]" aria-label="Pagination">
          <span className="text-neutral-500">
            {total} élément(s) · page {page}/{pages}
          </span>
          <div className="flex gap-1.5">
            {page > 1 ? (
              <Link href={qs({ page: String(page - 1) })} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                ← Précédent
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={qs({ page: String(page + 1) })} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Suivant →
              </Link>
            ) : null}
          </div>
        </nav>
      ) : total ? (
        <p className="px-1 text-xs text-neutral-400">{total} élément(s)</p>
      ) : null}
    </div>
  );
}
