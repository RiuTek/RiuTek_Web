import { ApiError } from '../../lib/api'
import { USER_ROLE_LABELS, UserRole, type AuthStatus } from '../auth/authTypes'

export type AdminAccessStatus =
  | 'checking'
  | 'unavailable'
  | 'redirect_login'
  | 'forbidden'
  | 'allowed'

export interface AdminAccessResolution {
  status: AdminAccessStatus
  loginReturnTo: string | null
  canExecuteAdminAction: boolean
}

export function isContentManagerRole(role: UserRole | string | undefined | null): boolean {
  return role === UserRole.Admin || role === UserRole.Staff
}

/**
 * Nhãn vai trò hiển thị trên badge/tài khoản trong khu vực Quản trị (Desktop & Mobile).
 * Tuyệt đối không gắn nhãn cứng "Admin" cho tài khoản Nhân viên (Staff).
 */
export function getAdminRoleBadgeLabel(
  role: UserRole | string | undefined | null
): string {
  if (role === UserRole.Admin || role === 'Admin') {
    return USER_ROLE_LABELS[UserRole.Admin]
  }
  if (role === UserRole.Staff || role === 'Staff') {
    return USER_ROLE_LABELS[UserRole.Staff]
  }
  return 'Quản trị'
}

/**
 * Kiểm tra trạng thái active cho mục điều hướng trong AdminLayout:
 * - '/admin/orders' active ở cả '/admin/orders' và '/admin/orders/:orderId'
 * - '/admin/products' active ở '/admin/products' và '/admin/products/:id/edit' (nhưng không active ở '/admin/products/new')
 */
export function isAdminNavItemActive(itemTo: string, pathname: string): boolean {
  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/'
  const cleanTarget = (itemTo || '').replace(/\/+$/, '') || '/'

  if (cleanPath === cleanTarget) {
    return true
  }

  if (cleanTarget === '/admin/orders') {
    return cleanPath.startsWith('/admin/orders/')
  }

  if (cleanTarget === '/admin/products') {
    return (
      cleanPath.startsWith('/admin/products/') &&
      cleanPath !== '/admin/products/new'
    )
  }

  return false
}

export function resolveAdminAccessState(params: {
  authStatus: AuthStatus | string
  isAuthenticated: boolean
  user: { id: string; role: UserRole | string } | null
  currentPathWithSearch: string
}): AdminAccessResolution {
  const { authStatus, isAuthenticated, user, currentPathWithSearch } = params

  if (authStatus === 'checking') {
    return {
      status: 'checking',
      loginReturnTo: null,
      canExecuteAdminAction: false,
    }
  }

  if (authStatus === 'unavailable') {
    return {
      status: 'unavailable',
      loginReturnTo: null,
      canExecuteAdminAction: false,
    }
  }

  if (!isAuthenticated || authStatus !== 'authenticated' || !user || !user.id?.trim()) {
    const returnTo = currentPathWithSearch?.trim() || '/admin/products'
    return {
      status: 'redirect_login',
      loginReturnTo: returnTo,
      canExecuteAdminAction: false,
    }
  }

  if (!isContentManagerRole(user.role)) {
    return {
      status: 'forbidden',
      loginReturnTo: null,
      canExecuteAdminAction: false,
    }
  }

  return {
    status: 'allowed',
    loginReturnTo: null,
    canExecuteAdminAction: true,
  }
}

/**
 * Thực thi thao tác quản trị (read private detail hoặc mutation) có kiểm tra guard trước khi gọi API
 * và hỗ trợ refresh token đúng 1 lần khi 401 (kèm kiểm tra isContextCurrent sau mỗi await).
 */
export async function executeWithAdminAuth<T>(params: {
  authStatus: AuthStatus | string
  user: { id: string; role: UserRole | string } | null
  getAccessToken: (forceRefresh: boolean) => Promise<string | null>
  isContextCurrent?: () => boolean
  operation: (token: string) => Promise<T>
}): Promise<T> {
  const { authStatus, user, getAccessToken, isContextCurrent, operation } = params
  const checkCurrent = () => (isContextCurrent ? isContextCurrent() : true)

  if (authStatus !== 'authenticated' || !user?.id?.trim()) {
    throw new ApiError({
      message: 'Bạn cần đăng nhập để thực hiện thao tác quản trị.',
      status: 401,
      code: 'Auth.Unauthorized',
      description: 'Bạn cần đăng nhập để thực hiện thao tác quản trị.',
    })
  }

  if (!isContentManagerRole(user.role)) {
    throw new ApiError({
      message: 'Bạn không có quyền thực hiện thao tác quản trị này.',
      status: 403,
      code: 'Auth.Forbidden',
      description: 'Bạn không có quyền thực hiện thao tác quản trị này.',
    })
  }

  let token = await getAccessToken(false)
  if (!checkCurrent()) {
    throw new DOMException('Context cancelled', 'AbortError')
  }
  if (!token) {
    throw new ApiError({
      message: 'Phiên đăng nhập đã hết hạn.',
      status: 401,
      code: 'Auth.Unauthorized',
      description: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    })
  }

  try {
    return await operation(token)
  } catch (err: unknown) {
    if (!checkCurrent()) {
      throw new DOMException('Context cancelled', 'AbortError')
    }
    if (err instanceof ApiError && err.status === 401) {
      token = await getAccessToken(true)
      if (!checkCurrent()) {
        throw new DOMException('Context cancelled', 'AbortError')
      }
      if (!token) {
        throw err
      }
      return await operation(token)
    }
    throw err
  }
}
