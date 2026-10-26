/**
 * Chuẩn thông báo lỗi nghiệp vụ từ ApiControllerBase Backend:
 * { code?: string, description?: string }
 */
export interface ApiBusinessError {
  code?: string
  description?: string
}

/**
 * Chuẩn ProblemDetails theo RFC 7807 / RFC 9457 cho lỗi validation, model-binding hoặc exception
 */
export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  traceId?: string
  errors?: Record<string, string[]>
  [key: string]: unknown
}

/**
 * Chuẩn phân trang PagedResult từ Backend RiuTek
 */
export interface PagedResult<T> {
  items: T[]
  pageIndex: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'

export interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: HttpMethod
  headers?: HeadersInit
  params?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  token?: string
  signal?: AbortSignal
}
