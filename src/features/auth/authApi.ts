import { apiClient } from '../../lib/api'
import type { AuthResponse, LoginRequest } from './authTypes'

let activeRefreshPromise: Promise<AuthResponse> | null = null

/**
 * Đăng nhập bằng email và password
 */
export function login(
  request: LoginRequest,
  signal?: AbortSignal
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/login', request, { signal })
}

/**
 * Làm mới phiên và lấy access token mới qua HttpOnly refresh cookie.
 * Áp dụng cơ chế single-flight để tránh các request refresh trùng lặp đồng thời.
 */
export function refreshSession(): Promise<AuthResponse> {
  if (activeRefreshPromise) {
    return activeRefreshPromise
  }

  activeRefreshPromise = apiClient
    .post<AuthResponse>('/auth/refresh')
    .finally(() => {
      activeRefreshPromise = null
    })

  return activeRefreshPromise
}

/**
 * Đăng xuất khỏi hệ thống và xóa refresh cookie trên máy chủ
 */
export function logout(signal?: AbortSignal): Promise<void> {
  return apiClient.post<void>('/auth/logout', undefined, { signal })
}
