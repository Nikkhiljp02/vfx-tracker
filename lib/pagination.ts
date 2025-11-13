// Pagination utilities for VFX Tracker

export interface PaginationParams {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const orderBy = searchParams.get('orderBy') || 'createdDate';
  const orderDirection = (searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc';

  return {
    page: Math.max(1, page),
    limit: Math.min(Math.max(1, limit), 200), // Cap at 200
    orderBy,
    orderDirection,
  };
}

export function calculatePagination(totalItems: number, page: number, limit: number) {
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    currentPage: page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

// Cursor-based pagination for infinite scroll
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function getCursorPaginationParams(searchParams: URLSearchParams): CursorPaginationParams {
  return {
    cursor: searchParams.get('cursor') || undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '50'), 200),
  };
}
