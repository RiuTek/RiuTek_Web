import { apiClient } from '../../lib/api'
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
} from './authTypes'

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
 * Đăng ký tài khoản Customer mới.
 * Không gửi kèm Bearer token. Trả về AuthResponse và Backend đặt HttpOnly refresh cookie.
 */
export function register(
  request: RegisterRequest,
  signal?: AbortSignal
): Promise<AuthResponse> {
  return apiClient.post<AuthResponse>('/auth/register', request, { signal })
}

/**
 * Cập nhật thông tin tài khoản cơ bản (họ tên, số điện thoại).
 * Gửi Bearer token qua header Authorization.
 */
export function updateProfile(
  request: UpdateProfileRequest,
  token: string,
  signal?: AbortSignal
): Promise<AuthUser> {
  return apiClient.put<AuthUser>('/users/me', request, { token, signal })
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
