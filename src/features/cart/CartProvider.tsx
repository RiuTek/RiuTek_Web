import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import {
  addCartItem,
  clearCart as apiClearCart,
  getCart,
  removeCartItem,
  setCartItemQuantity,
} from './cartApi'
import { CartContext, type CartContextValue } from './CartContext'
import {
  CART_ERROR_MESSAGES,
  type CartDto,
  type CartStatus,
} from './cartTypes'

interface CartProviderProps {
  children: React.ReactNode
}

function mapCartError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && CART_ERROR_MESSAGES[err.code]) {
      return CART_ERROR_MESSAGES[err.code]
    }
    if (err.description) return err.description
    if (err.message) return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Đã xảy ra lỗi khi xử lý giỏ hàng. Vui lòng thử lại.'
}

function isCartConflict(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.code === 'Cart.ConcurrencyConflict' ||
      err.code === 'Cart.DuplicateCartCreation')
  )
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { status: authStatus, getAccessToken } = useAuth()

  const [cart, setCart] = useState<CartDto | null>(null)
  const [status, setStatus] = useState<CartStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  // Lưu trữ active load promise để tránh race conditions hoặc reload trùng lặp
  const activeLoadRef = useRef<Promise<CartDto> | null>(null)

  /**
   * Helper private thực thi operation với token và hỗ trợ retry 1 lần khi 401
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
   * Tải giỏ hàng từ server
   */
  const loadCartInternal = useCallback(async (): Promise<CartDto> => {
    if (activeLoadRef.current) {
      return activeLoadRef.current
    }

    setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
    setError(null)

    const fetchPromise = withAuthRetry((token) => getCart(token))
      .then((data) => {
        setCart(data)
        setStatus('ready')
        setError(null)
        return data
      })
      .catch((err) => {
        const msg = mapCartError(err)
        setError(msg)
        setStatus('error')
        throw err
      })
      .finally(() => {
        activeLoadRef.current = null
      })

    activeLoadRef.current = fetchPromise
    return fetchPromise
  }, [withAuthRetry])

  const loadCart = useCallback(async (): Promise<void> => {
    await loadCartInternal()
  }, [loadCartInternal])

  // Reset giỏ hàng khi người dùng chuyển sang trạng thái anonymous (logout)
  const [prevAuthStatus, setPrevAuthStatus] = useState(authStatus)
  if (authStatus !== prevAuthStatus) {
    setPrevAuthStatus(authStatus)
    if (authStatus === 'anonymous') {
      setCart(null)
      setStatus('idle')
      setError(null)
    }
  }

  // Tải giỏ hàng khi người dùng đã xác thực
  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadCartInternal().catch(() => {
        // Lỗi đã được ghi nhận trong status và error state
      })
    }
  }, [authStatus, loadCartInternal])

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  const addItem = useCallback(
    async (productId: string, quantity: number): Promise<CartDto> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.')
      }

      setIsMutating(true)
      try {
        const updatedCart = await withAuthRetry((token) =>
          addCartItem({ productId, quantity }, token)
        )
        setCart(updatedCart)
        setError(null)
        return updatedCart
      } catch (err) {
        if (isCartConflict(err)) {
          // Tải lại state mới nhất nhưng không tự động lặp lại mutation để tránh cộng 2 lần
          void loadCartInternal()
        }
        const friendlyMessage = mapCartError(err)
        setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        setIsMutating(false)
      }
    },
    [authStatus, withAuthRetry, loadCartInternal]
  )

  /**
   * Đặt số lượng tuyệt đối cho một sản phẩm trong giỏ hàng
   */
  const setQuantity = useCallback(
    async (productId: string, quantity: number): Promise<CartDto> => {
      setIsMutating(true)
      try {
        const updatedCart = await withAuthRetry((token) =>
          setCartItemQuantity(productId, quantity, token)
        )
        setCart(updatedCart)
        setError(null)
        return updatedCart
      } catch (err) {
        if (isCartConflict(err)) {
          void loadCartInternal()
        }
        const friendlyMessage = mapCartError(err)
        setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        setIsMutating(false)
      }
    },
    [withAuthRetry, loadCartInternal]
  )

  /**
   * Xóa một sản phẩm khỏi giỏ hàng
   */
  const removeItem = useCallback(
    async (productId: string): Promise<void> => {
      setIsMutating(true)
      try {
        await withAuthRetry((token) => removeCartItem(productId, token))
        // Endpoint trả 204 No Content -> refetch cart để lấy state mới nhất
        await loadCartInternal()
      } catch (err) {
        if (isCartConflict(err)) {
          void loadCartInternal()
        }
        const friendlyMessage = mapCartError(err)
        setError(friendlyMessage)
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        setIsMutating(false)
      }
    },
    [withAuthRetry, loadCartInternal]
  )

  /**
   * Xóa sạch toàn bộ sản phẩm khỏi giỏ hàng
   */
  const clearCart = useCallback(async (): Promise<void> => {
    setIsMutating(true)
    try {
      await withAuthRetry((token) => apiClearCart(token))
      // Endpoint trả 204 No Content -> refetch cart
      await loadCartInternal()
    } catch (err) {
      if (isCartConflict(err)) {
        void loadCartInternal()
      }
      const friendlyMessage = mapCartError(err)
      setError(friendlyMessage)
      throw new Error(friendlyMessage, { cause: err })
    } finally {
      setIsMutating(false)
    }
  }, [withAuthRetry, loadCartInternal])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Tổng số lượng các sản phẩm trong giỏ (tổng quantity, không phải số dòng)
  const itemCount = useMemo(() => {
    if (!cart || !cart.items) return 0
    return cart.items.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      status,
      error,
      isMutating,
      itemCount,
      loadCart,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      clearError,
    }),
    [
      cart,
      status,
      error,
      isMutating,
      itemCount,
      loadCart,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
      clearError,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
