import { createContext, useContext } from 'react'
import type {
  AuthStatus,
  AuthUser,
  RegisterRequest,
  UpdateProfileRequest,
} from './authTypes'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (request: RegisterRequest) => Promise<void>
  updateProfile: (request: UpdateProfileRequest) => Promise<void>
  logout: () => Promise<void>
  retryBootstrap: () => void
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
  }
  return context
}
