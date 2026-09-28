import type { CollectionQuery, CollectionFilterValue, CollectionQueryResult } from "../../types/api";

const RESERVED_KEYS = new Set(["search", "sort", "sortOrder", "page", "pageSize", "from", "to"]);

export function buildCollectionQuery(query?: CollectionQuery): string {
  if (!query) return "";

  const params = new URLSearchParams();

  Object.entries(query.filter ?? {}).forEach(([key, value]) => {
    params.set(`filter.${key}`, String(value));
  });

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.sort) params.set("sort", query.sort);
  if (query.sortOrder) params.set("sortOrder", query.sortOrder);
  if (query.page !== undefined) params.set("page", String(query.page));
  if (query.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);

  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function parseCollectionQuery(request: Request): CollectionQuery {
  const url = new URL(request.url);
  const filter: Record<string, CollectionFilterValue> = {};

  url.searchParams.forEach((value, key) => {
    if (key.startsWith("filter.")) {
      const field = key.slice("filter.".length);
      if (field && !RESERVED_KEYS.has(field)) filter[field] = value;
    }
  });

  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");

  return {
    filter: Object.keys(filter).length ? filter : undefined,
    search: url.searchParams.get("search") || undefined,
    sort: url.searchParams.get("sort") || undefined,
    sortOrder: url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 50,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
  };
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase();
}

function resolveCollectionRecords<T extends object>(
  records: T[],
  query: CollectionQuery,
): T[] {
  let result = [...records];

  Object.entries(query.filter ?? {}).forEach(([field, expected]) => {
    result = result.filter((record) => normalize((record as Record<string, unknown>)[field]) === normalize(expected));
  });

  if (query.search) {
    const needle = query.search.toLowerCase();
    result = result.filter((record) =>
      Object.values(record as Record<string, unknown>).some((value) => normalize(value).includes(needle)),
    );
  }

  if (query.from || query.to) {
    const from = query.from
      ? new Date(`${query.from}T00:00:00.000Z`).getTime()
      : Number.NEGATIVE_INFINITY;
    const to = query.to
      ? new Date(`${query.to}T23:59:59.999Z`).getTime()
      : Number.POSITIVE_INFINITY;
    result = result.filter((record) => {
      const typedRecord = record as Record<string, unknown>;
      const candidate =
        typedRecord.date ?? typedRecord.expenseDate ?? typedRecord.createdAt ?? typedRecord.updatedAt;
      const timestamp = new Date(String(candidate ?? "")).getTime();
      return Number.isFinite(timestamp) && timestamp >= from && timestamp <= to;
    });
  }

  if (query.sort) {
    const direction = query.sortOrder === "desc" ? -1 : 1;
    const field = query.sort;
    result.sort((a, b) => {
      const left = (a as Record<string, unknown>)[field];
      const right = (b as Record<string, unknown>)[field];
      if (left === right) return 0;
      return normalize(left).localeCompare(normalize(right), undefined, {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }

  return result;
}

export function applyCollectionQuery<T extends object>(
  records: T[],
  query: CollectionQuery,
): T[] {
  const result = resolveCollectionRecords(records, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const start = (page - 1) * pageSize;
  return result.slice(start, start + pageSize);
}

export function applyCollectionQueryResult<T extends object>(
  records: T[],
  query: CollectionQuery,
): CollectionQueryResult<T> {
  const result = resolveCollectionRecords(records, query);
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const start = (page - 1) * pageSize;

  return {
    data: result.slice(start, start + pageSize),
    page,
    pageSize,
    total: result.length,
  };
}
