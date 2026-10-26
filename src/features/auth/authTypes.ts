export enum UserRole {
  Customer = 1,
  Staff = 2,
  Admin = 3,
}

export interface AuthUser {
  id: string
  email: string
  fullName: string
  phoneNumber: string | null
  role: UserRole
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  expiresInSeconds: number
  user: AuthUser
}

export interface LoginRequest {
  email: string
  password: string
}

export type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'anonymous'
  | 'unavailable'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.Customer]: 'Khách hàng',
  [UserRole.Staff]: 'Nhân viên',
  [UserRole.Admin]: 'Quản trị viên',
}
