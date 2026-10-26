import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import {
  addAddress as apiAddAddress,
  deleteAddress as apiDeleteAddress,
  getMyAddresses,
  setDefaultAddress as apiSetDefaultAddress,
  updateAddress as apiUpdateAddress,
} from './addressApi'
import { AddressContext, type AddressContextValue } from './AddressContext'
import {
  ADDRESS_ERROR_MESSAGES,
  type AddAddressRequest,
  type AddressStatus,
  type UpdateAddressRequest,
  type UserAddressDto,
} from './addressTypes'

interface AddressProviderProps {
  children: React.ReactNode
}

function mapAddressError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && ADDRESS_ERROR_MESSAGES[err.code]) {
      return ADDRESS_ERROR_MESSAGES[err.code]
    }
    if (err.description) return err.description
    if (err.message) return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Đã xảy ra lỗi khi xử lý địa chỉ. Vui lòng thử lại.'
}

/**
 * Inner provider quản lý state, lifecycle và API calls cho một user session xác định.
 * Được mount/unmount tự động qua sessionKey trong AddressProvider.
 */
const AddressSessionProvider: React.FC<AddressProviderProps> = ({ children }) => {
  const { status: authStatus, getAccessToken } = useAuth()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [addresses, setAddresses] = useState<UserAddressDto[]>([])
  const [status, setStatus] = useState<AddressStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  // Giữ active load promise cho session hiện tại để chống gọi trùng lặp
  const activeLoadRef = useRef<Promise<UserAddressDto[]> | null>(null)

  /**
   * Helper private thực thi operation với token và hỗ trợ retry 1 lần khi gặp 401
   */
  const withAuthRetry = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      let token = await getAccessToken(false)
      if (!token) {
        throw new Error('Chưa đăng nhập.')
      }

      try {
        return await operation(token)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Token có thể đã hết hạn -> force refresh token 1 lần
          token = await getAccessToken(true)
          if (!token) {
            throw new Error('Chưa đăng nhập.', { cause: err })
          }
          // Retry đúng 1 lần với token mới
          return await operation(token)
        }
        throw err
      }
    },
    [getAccessToken]
  )

  /**
   * Tải danh sách địa chỉ từ server cho session hiện tại
   */
  const loadAddressesInternal = useCallback(
    async (signal?: AbortSignal): Promise<UserAddressDto[]> => {
      if (activeLoadRef.current) {
        return activeLoadRef.current
      }

      if (isMountedRef.current) {
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
        setError(null)
      }

      const fetchPromise = withAuthRetry((token) => getMyAddresses(token, signal))
        .then((data) => {
          if (isMountedRef.current) {
            setAddresses(data)
            setStatus('ready')
            setError(null)
          }
          return data
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') {
            throw err
          }
          if (isMountedRef.current) {
            const msg = mapAddressError(err)
            setError(msg)
            setStatus('error')
          }
          throw err
        })
        .finally(() => {
          activeLoadRef.current = null
        })

      activeLoadRef.current = fetchPromise
      return fetchPromise
    },
    [withAuthRetry]
  )

  const loadAddresses = useCallback(async (): Promise<void> => {
    await loadAddressesInternal()
  }, [loadAddressesInternal])

  // Tải danh sách khi session authenticated được kích hoạt
  useEffect(() => {
    const abortController = new AbortController()
    if (authStatus === 'authenticated') {
      loadAddressesInternal(abortController.signal).catch(() => {
        // Lỗi đã được lưu vào status và error state
      })
    }
    return () => {
      abortController.abort()
    }
  }, [authStatus, loadAddressesInternal])

  /**
   * Thêm địa chỉ mới và refetch lại danh sách từ server
   */
  const addAddress = useCallback(
    async (request: AddAddressRequest): Promise<void> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để thêm địa chỉ.')
      }

      setIsMutating(true)
      let mutationSucceeded = false
      try {
        await withAuthRetry((token) => apiAddAddress(request, token))
        mutationSucceeded = true
        await loadAddressesInternal()
      } catch (err) {
        if (mutationSucceeded) {
          const msg =
            'Thao tác đã được lưu nhưng không thể tải lại danh sách địa chỉ mới nhất. Vui lòng thử tải lại.'
          if (isMountedRef.current) setError(msg)
          throw new Error(msg, { cause: err })
        }
        const friendlyMessage = mapAddressError(err)
        if (isMountedRef.current) setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, loadAddressesInternal]
  )

  /**
   * Cập nhật địa chỉ và refetch lại danh sách từ server
   */
  const updateAddress = useCallback(
    async (id: string, request: UpdateAddressRequest): Promise<void> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để cập nhật địa chỉ.')
      }

      setIsMutating(true)
      let mutationSucceeded = false
      try {
        await withAuthRetry((token) => apiUpdateAddress(id, request, token))
        mutationSucceeded = true
        await loadAddressesInternal()
      } catch (err) {
        if (mutationSucceeded) {
          const msg =
            'Thao tác đã được lưu nhưng không thể tải lại danh sách địa chỉ mới nhất. Vui lòng thử tải lại.'
          if (isMountedRef.current) setError(msg)
          throw new Error(msg, { cause: err })
        }
        const friendlyMessage = mapAddressError(err)
        if (isMountedRef.current) setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, loadAddressesInternal]
  )

  /**
   * Đặt địa chỉ làm mặc định và refetch lại danh sách từ server
   */
  const setDefaultAddress = useCallback(
    async (id: string): Promise<void> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để thay đổi địa chỉ mặc định.')
      }

      setIsMutating(true)
      let mutationSucceeded = false
      try {
        await withAuthRetry((token) => apiSetDefaultAddress(id, token))
        mutationSucceeded = true
        await loadAddressesInternal()
      } catch (err) {
        if (mutationSucceeded) {
          const msg =
            'Thao tác đã được lưu nhưng không thể tải lại danh sách địa chỉ mới nhất. Vui lòng thử tải lại.'
          if (isMountedRef.current) setError(msg)
          throw new Error(msg, { cause: err })
        }
        const friendlyMessage = mapAddressError(err)
        if (isMountedRef.current) setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, loadAddressesInternal]
  )

  /**
   * Xóa địa chỉ và refetch lại danh sách từ server
   */
  const deleteAddress = useCallback(
    async (id: string): Promise<void> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để xóa địa chỉ.')
      }

      setIsMutating(true)
      let mutationSucceeded = false
      try {
        await withAuthRetry((token) => apiDeleteAddress(id, token))
        mutationSucceeded = true
        await loadAddressesInternal()
      } catch (err) {
        if (mutationSucceeded) {
          const msg =
            'Thao tác đã được lưu nhưng không thể tải lại danh sách địa chỉ mới nhất. Vui lòng thử tải lại.'
          if (isMountedRef.current) setError(msg)
          throw new Error(msg, { cause: err })
        }
        const friendlyMessage = mapAddressError(err)
        if (isMountedRef.current) setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, loadAddressesInternal]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = useMemo<AddressContextValue>(
    () => ({
      addresses,
      status,
      error,
      isMutating,
      loadAddresses,
      addAddress,
      updateAddress,
      setDefaultAddress,
      deleteAddress,
      clearError,
    }),
    [
      addresses,
      status,
      error,
      isMutating,
      loadAddresses,
      addAddress,
      updateAddress,
      setDefaultAddress,
      deleteAddress,
      clearError,
    ]
  )

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>
}

/**
 * Outer AddressProvider: Quản lý session isolation giữa các người dùng và trạng thái đăng nhập.
 * Reset toàn bộ state khi người dùng đăng xuất hoặc chuyển đổi tài khoản bằng unmount/mount qua key.
 */
export const AddressProvider: React.FC<AddressProviderProps> = ({ children }) => {
  const { status: authStatus, user } = useAuth()

  // Key duy nhất gắn với auth status và user.id cụ thể
  const sessionKey =
    authStatus === 'authenticated' && user
      ? `authenticated:${user.id}`
      : authStatus

  return <AddressSessionProvider key={sessionKey}>{children}</AddressSessionProvider>
}
