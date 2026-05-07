export interface ApiError {
  error: string;
}

export interface ApiSuccess<T> {
  data: T;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  filter?: string;
}
