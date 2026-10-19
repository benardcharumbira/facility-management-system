/** Envelope returned by every paginated collection endpoint. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PageParams {
  page?: number;
  pageSize?: number;
}
