import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../../lib/api'
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  updateProfile as apiUpdateProfile,
  refreshSession,
} from './authApi'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type {
  AuthResponse,
  AuthStatus,
  AuthUser,
  RegisterRequest,
  UpdateProfileRequest,
} from './authTypes'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [bootstrapTrigger, setBootstrapTrigger] = useState(0)

  // Access token và thời điểm hết hạn CHỈ lưu trữ trong bộ nhớ (memory)
  const accessTokenRef = useRef<string | null>(null)
  const expiresAtRef = useRef<number | null>(null)

  // Helper xóa sạch session trong bộ nhớ khi phiên hết hạn hoặc logout
  const clearSession = useCallback(() => {
    accessTokenRef.current = null
    expiresAtRef.current = null
    setUser(null)
    setStatus('anonymous')
  }, [])

  // Helper chuẩn hóa cập nhật phiên làm việc từ AuthResponse
  const applyAuthResponse = useCallback((data: AuthResponse) => {
    accessTokenRef.current = data.accessToken
    expiresAtRef.current = Date.now() + data.expiresInSeconds * 1000
    setUser(data.user)
    setStatus('authenticated')
  }, [])

  // Bootstrap session khi app khởi động bằng refresh cookie HttpOnly
  useEffect(() => {
    let isMounted = true

    refreshSession()
      .then((data) => {
        if (!isMounted) return
        applyAuthResponse(data)
      })
      .catch((err) => {
        if (!isMounted) return
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession()
        } else {
          // Lỗi mạng hoặc 5xx không được coi là đã logout
          setStatus('unavailable')
        }
      })

    return () => {
      isMounted = false
    }
  }, [bootstrapTrigger, applyAuthResponse, clearSession])

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const data = await apiLogin({ email, password })
      applyAuthResponse(data)
    },
    [applyAuthResponse]
  )

  const register = useCallback(
    async (request: RegisterRequest): Promise<void> => {
      const data = await apiRegister(request)
      applyAuthResponse(data)
    },
    [applyAuthResponse]
  )

  const logout = useCallback(async (): Promise<void> => {
    // Chỉ xác nhận logout thành công sau khi server trả 204
    await apiLogout()
    clearSession()
  }, [clearSession])

  const retryBootstrap = useCallback(() => {
    setStatus('checking')
    setBootstrapTrigger((prev) => prev + 1)
  }, [])

  const getAccessToken = useCallback(
    async (forceRefresh = false): Promise<string | null> => {
      const now = Date.now()
      // Nếu không forceRefresh và token còn hạn an toàn (trừ hao 30 giây)
      if (
        !forceRefresh &&
        accessTokenRef.current &&
        expiresAtRef.current &&
        expiresAtRef.current - now > 30_000
      ) {
        return accessTokenRef.current
      }

      // Nếu token thiếu, sắp hết hạn trong 30s hoặc forceRefresh, dùng single-flight refresh
      try {
        const data = await refreshSession()
        applyAuthResponse(data)
        return data.accessToken
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          clearSession()
        }
        throw err
      }
    },
    [applyAuthResponse, clearSession]
  )

  const updateProfile = useCallback(
    async (request: UpdateProfileRequest): Promise<void> => {
      let token = await getAccessToken(false)
      if (!token) {
        throw new Error('Chưa đăng nhập.')
      }

      try {
        const updatedUser = await apiUpdateProfile(request, token)
        setUser(updatedUser)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Token có thể đã bị revoke hoặc expired trên server -> force refresh đúng 1 lần
          token = await getAccessToken(true)

          if (!token) {
            throw new Error('Chưa đăng nhập.', { cause: err })
          }

          // Retry update profile đúng 1 lần với token mới
          try {
            const updatedUser = await apiUpdateProfile(request, token)
            setUser(updatedUser)
            return
          } catch (retryErr) {
            // Nếu retry cuối vẫn trả 401/403: terminal authorization -> clear session
            if (
              retryErr instanceof ApiError &&
              (retryErr.status === 401 || retryErr.status === 403)
            ) {
              clearSession()
            }
            throw retryErr
          }
        }

        throw err
      }
    },
    [getAccessToken, clearSession]
  )

  const value: AuthContextValue = {
    status,
    user,
    isAuthenticated: status === 'authenticated' && user !== null,
    login,
    register,
    updateProfile,
    logout,
    retryBootstrap,
    getAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
