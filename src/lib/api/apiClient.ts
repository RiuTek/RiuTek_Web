import { ApiError } from './apiError'
import type { ProblemDetails, RequestOptions } from './apiTypes'

/**
 * Phân giải và kiểm tra tính hợp lệ của API Base URL.
 * Chỉ chấp nhận đường dẫn tương đối (ví dụ: /api/v1).
 * Từ chối URL tuyệt đối (http://, https://, //) để đảm bảo request qua Vercel rewrite.
 */
export function resolveApiBaseUrl(rawEnvUrl?: string): string {
  const candidate = rawEnvUrl ?? import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const trimmed = candidate.trim()

  if (!trimmed) {
    return '/api/v1'
  }

  if (trimmed.startsWith('//') || /^https?:\/\//i.test(trimmed)) {
    throw new Error(
      `[apiClient] Base URL không được là URL tuyệt đối ("${trimmed}"). Chỉ chấp nhận đường dẫn tương đối bắt đầu bằng "/".`
    )
  }

  if (!trimmed.startsWith('/')) {
    throw new Error(
      `[apiClient] Base URL phải bắt đầu bằng "/": "${trimmed}".`
    )
  }

  return trimmed.length > 1 && trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

/**
 * Ghép base path, endpoint và query parameters thành URL tương đối an toàn
 */
function buildRequestUrl(base: string, path: string, params?: RequestOptions['params']): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const fullPath = cleanPath.startsWith(base) ? cleanPath : `${base}${cleanPath}`

  if (!params) {
    return fullPath
  }

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  }

  const queryString = searchParams.toString()
  return queryString ? `${fullPath}?${queryString}` : fullPath
}

function isJsonPayload(body: unknown): boolean {
  if (body === null || body === undefined) {
    return false
  }

  if (
    typeof FormData !== 'undefined' && body instanceof FormData ||
    typeof Blob !== 'undefined' && body instanceof Blob ||
    typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer ||
    typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams
  ) {
    return false
  }

  return typeof body === 'object' || typeof body === 'boolean' || typeof body === 'number'
}

/**
 * Gửi HTTP request nền tảng tới RiuTek API thông qua Vercel rewrite.
 */
export async function apiRequest<TResponse = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<TResponse> {
  const baseUrl = resolveApiBaseUrl()
  const url = buildRequestUrl(baseUrl, path, options.params)

  const headers = new Headers(options.headers)

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  let requestBody: BodyInit | null | undefined

  if (isJsonPayload(options.body)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    requestBody = JSON.stringify(options.body)
  } else {
    requestBody = options.body as BodyInit | null | undefined
  }

  const fetchInit: RequestInit = {
    ...options,
    method: options.method ?? 'GET',
    headers,
    body: requestBody,
    credentials: 'include',
    signal: options.signal,
  }

  let response: Response
  try {
    response = await fetch(url, fetchInit)
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw ApiError.fromAbortError(error)
    }
    throw ApiError.fromNetworkError(error)
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as TResponse
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength === '0') {
    return undefined as TResponse
  }

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json') || contentType.includes('+json')

  if (!response.ok) {
    if (isJson) {
      try {
        const errorData = await response.json()
        if (errorData && typeof errorData === 'object') {
          const { code, description, title, detail, errors } = errorData as Record<string, unknown>
          if (typeof code === 'string' || typeof description === 'string') {
            throw ApiError.fromBusinessError(response.status, {
              code: typeof code === 'string' ? code : undefined,
              description: typeof description === 'string' ? description : undefined,
            })
          }
          if (title || detail || errors) {
            throw ApiError.fromProblemDetails(response.status, errorData as ProblemDetails)
          }
        }
      } catch (parseError) {
        if (parseError instanceof ApiError) {
          throw parseError
        }
      }
    }
    throw ApiError.fromHttpFallback(response.status, response.statusText)
  }

  if (isJson) {
    return (await response.json()) as TResponse
  }

  return (await response.text()) as unknown as TResponse
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
}
