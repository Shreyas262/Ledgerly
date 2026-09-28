export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
}

export type CollectionFilterValue = string | number | boolean;

export interface CollectionQuery {
  filter?: Record<string, CollectionFilterValue>;
  search?: string;
  sort?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}

export interface CollectionQueryResult<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}
