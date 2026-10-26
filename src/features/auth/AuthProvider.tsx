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
  refreshSession,
} from './authApi'
import { AuthContext, type AuthContextValue } from './AuthContext'
import type { AuthStatus, AuthUser } from './authTypes'

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

  // Bootstrap session khi app khởi động bằng refresh cookie HttpOnly
  useEffect(() => {
    let isMounted = true

    refreshSession()
      .then((data) => {
        if (!isMounted) return
        accessTokenRef.current = data.accessToken
        expiresAtRef.current = Date.now() + data.expiresInSeconds * 1000
        setUser(data.user)
        setStatus('authenticated')
      })
      .catch((err) => {
        if (!isMounted) return
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          accessTokenRef.current = null
          expiresAtRef.current = null
          setUser(null)
          setStatus('anonymous')
        } else {
          // Lỗi mạng hoặc 5xx không được coi là đã logout
          setStatus('unavailable')
        }
      })

    return () => {
      isMounted = false
    }
  }, [bootstrapTrigger])

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const data = await apiLogin({ email, password })
      accessTokenRef.current = data.accessToken
      expiresAtRef.current = Date.now() + data.expiresInSeconds * 1000
      setUser(data.user)
      setStatus('authenticated')
    },
    []
  )

  const logout = useCallback(async (): Promise<void> => {
    // Chỉ xác nhận logout thành công sau khi server trả 204
    await apiLogout()
    accessTokenRef.current = null
    expiresAtRef.current = null
    setUser(null)
    setStatus('anonymous')
  }, [])

  const retryBootstrap = useCallback(() => {
    setStatus('checking')
    setBootstrapTrigger((prev) => prev + 1)
  }, [])

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const now = Date.now()
    // Nếu token còn hạn an toàn (trừ hao 30 giây)
    if (
      accessTokenRef.current &&
      expiresAtRef.current &&
      expiresAtRef.current - now > 30_000
    ) {
      return accessTokenRef.current
    }

    // Nếu token thiếu hoặc sắp hết hạn trong 30s, dùng single-flight refresh
    try {
      const data = await refreshSession()
      accessTokenRef.current = data.accessToken
      expiresAtRef.current = Date.now() + data.expiresInSeconds * 1000
      setUser(data.user)
      setStatus('authenticated')
      return data.accessToken
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        accessTokenRef.current = null
        expiresAtRef.current = null
        setUser(null)
        setStatus('anonymous')
      }
      throw err
    }
  }, [])

  const value: AuthContextValue = {
    status,
    user,
    isAuthenticated: status === 'authenticated' && user !== null,
    login,
    logout,
    retryBootstrap,
    getAccessToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
