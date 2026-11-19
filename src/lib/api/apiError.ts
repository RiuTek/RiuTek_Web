import type { ApiBusinessError, ProblemDetails } from './apiTypes'

export interface ApiErrorInit {
  message?: string
  status?: number
  code?: string
  description?: string
  problemDetails?: ProblemDetails
  isNetworkError?: boolean
  isAbortError?: boolean
  retryAfterSeconds?: number
  cause?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly description?: string
  readonly problemDetails?: ProblemDetails
  readonly isNetworkError: boolean
  readonly isAbortError: boolean
  readonly retryAfterSeconds?: number

  constructor(init: ApiErrorInit) {
    const defaultMessage =
      init.description ||
      init.message ||
      (init.status ? `Yêu cầu thất bại với mã trạng thái ${init.status}.` : 'Không thể kết nối đến máy chủ.')

    super(defaultMessage)
    this.name = 'ApiError'
    this.status = init.status ?? 0
    this.code = init.code
    this.description = init.description
    this.problemDetails = init.problemDetails
    this.isNetworkError = Boolean(init.isNetworkError)
    this.isAbortError = Boolean(init.isAbortError)
    this.retryAfterSeconds = init.retryAfterSeconds
    if (init.cause) {
      this.cause = init.cause
    }
  }

  static fromBusinessError(status: number, error: ApiBusinessError, retryAfterSeconds?: number): ApiError {
    return new ApiError({
      status,
      code: error.code,
      description: error.description,
      message: error.description || error.code,
      retryAfterSeconds,
    })
  }

  static fromProblemDetails(status: number, details: ProblemDetails, retryAfterSeconds?: number): ApiError {
    const message = details.detail || details.title || `Lỗi yêu cầu (HTTP ${status}).`
    return new ApiError({
      status,
      message,
      description: details.detail,
      problemDetails: details,
      retryAfterSeconds,
    })
  }

  static fromHttpFallback(status: number, statusText?: string, retryAfterSeconds?: number): ApiError {
    return new ApiError({
      status,
      retryAfterSeconds,
      message: statusText
        ? `Yêu cầu thất bại (${status} ${statusText}).`
        : `Yêu cầu thất bại với mã trạng thái ${status}.`,
    })
  }

  static fromNetworkError(cause?: unknown): ApiError {
    return new ApiError({
      status: 0,
      message: 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng.',
      isNetworkError: true,
      cause,
    })
  }

  static fromAbortError(cause?: unknown): ApiError {
    return new ApiError({
      status: 0,
      message: 'Yêu cầu đã bị hủy.',
      isAbortError: true,
      cause,
    })
  }
}
