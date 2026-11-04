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
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            searchParams.append(key, String(item))
          }
        }
      } else {
        searchParams.append(key, String(value))
      }
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

export interface ApiBlobResponse {
  blob: Blob
  contentType: string
  contentDisposition: string | null
  fileName: string
}

/**
 * Trích xuất tên file an toàn từ header Content-Disposition (hỗ trợ cả filename*=UTF-8''... và filename="...").
 */
export function parseContentDispositionFileName(
  contentDisposition: string | null | undefined,
  fallbackFileName = 'riutek-product-import-v1.0.xlsx'
): string {
  const safeFallback = fallbackFileName.trim() || 'riutek-product-import-v1.0.xlsx'
  if (!contentDisposition || typeof contentDisposition !== 'string') {
    return safeFallback
  }

  let extracted = ''

  // 1. Ưu tiên chuẩn RFC 5987: filename*=UTF-8''...
  const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;\r\n]+)/i)
  if (utf8Match?.[1]) {
    try {
      extracted = decodeURIComponent(utf8Match[1].trim().replace(/^["']|["']$/g, ''))
    } catch {
      extracted = utf8Match[1].trim().replace(/^["']|["']$/g, '')
    }
  }

  // 2. Fallback sang filename="..." hoặc filename=...
  if (!extracted) {
    const quotedMatch = contentDisposition.match(/filename\s*=\s*"([^"\r\n]+)"/i)
    if (quotedMatch?.[1]) {
      extracted = quotedMatch[1].trim()
    } else {
      const plainMatch = contentDisposition.match(/filename\s*=\s*([^;\r\n]+)/i)
      if (plainMatch?.[1]) {
        extracted = plainMatch[1].trim().replace(/^["']|["']$/g, '')
      }
    }
  }

  // Làm sạch ký tự đường dẫn nguy hiểm (/, \, .., ký tự điều khiển)
  const sanitized = Array.from(extracted)
    .filter((ch) => ch.charCodeAt(0) >= 32)
    .join('')
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim()

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return safeFallback
  }

  return sanitized
}

/**
 * Tải file nhị phân (Blob) có xác thực qua API proxy, giữ nguyên quy ước xử lý lỗi JSON/ProblemDetails
 * và tuyệt đối không tải nhầm phản hồi lỗi JSON thành file .xlsx.
 */
export async function apiFetchBlob(
  path: string,
  options: RequestOptions & { fallbackFileName?: string } = {}
): Promise<ApiBlobResponse> {
  const baseUrl = resolveApiBaseUrl()
  const url = buildRequestUrl(baseUrl, path, options.params)

  const headers = new Headers(options.headers)
  if (!headers.has('Accept')) {
    headers.set(
      'Accept',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, application/json'
    )
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  const fetchInit: RequestInit = {
    ...options,
    method: options.method ?? 'GET',
    headers,
    body: options.body as BodyInit | null | undefined,
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

  const contentType = response.headers.get('content-type') ?? ''
  const isJson =
    contentType.includes('application/json') || contentType.includes('+json')

  if (!response.ok || isJson) {
    if (isJson) {
      try {
        const errorData = await response.json()
        if (errorData && typeof errorData === 'object') {
          const { code, description, title, detail, errors } = errorData as Record<
            string,
            unknown
          >
          if (typeof code === 'string' || typeof description === 'string') {
            throw ApiError.fromBusinessError(response.status || 400, {
              code: typeof code === 'string' ? code : undefined,
              description: typeof description === 'string' ? description : undefined,
            })
          }
          if (title || detail || errors) {
            throw ApiError.fromProblemDetails(
              response.status || 400,
              errorData as ProblemDetails
            )
          }
        }
      } catch (parseError) {
        if (parseError instanceof ApiError) {
          throw parseError
        }
      }
    }

    if (!response.ok) {
      throw ApiError.fromHttpFallback(response.status, response.statusText)
    }

    throw new ApiError({
      status: response.status,
      message: 'Phản hồi từ máy chủ không phải là tệp nhị phân hợp lệ.',
    })
  }

  if (contentType.includes('text/html')) {
    throw new ApiError({
      status: response.status,
      message: 'Máy chủ trả về trang HTML thay vì tệp mẫu Excel.',
    })
  }

  const blob = await response.blob()
  if (blob.size === 0) {
    throw new ApiError({
      status: response.status,
      message: 'Tệp tải về trống (0 bytes).',
    })
  }

  const contentDisposition = response.headers.get('content-disposition')
  const fileName = parseContentDispositionFileName(
    contentDisposition,
    options.fallbackFileName ?? 'riutek-product-import-v1.0.xlsx'
  )

  return {
    blob,
    contentType:
      contentType ||
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    contentDisposition,
    fileName,
  }
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
