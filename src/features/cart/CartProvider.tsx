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
  addCartItem,
  addPCBuildToCart as apiAddPCBuildToCart,
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
import {
  loadCartSelection,
  persistCartSelection,
  reconcileSelectionWithCart,
  calculateCartSelectionTotals,
  validateSelectedProductIds,
} from './cartSelectionHelper'

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

/**
 * Inner provider chứa toàn bộ lifecycle, state và async operations của một phiên xác thực cụ thể.
 * Được mount/unmount tự động qua session key của CartProvider.
 */
const CartSessionProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? ''
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [cart, setCart] = useState<CartDto | null>(null)
  const [status, setStatus] = useState<CartStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isMutating, setIsMutating] = useState(false)

  // Selection state
  const [selectedProductIds, setSelectedProductIdsState] = useState<string[]>(() =>
    loadCartSelection(ownerId)
  )

  const [prunedNotification, setPrunedNotification] = useState<string | null>(null)

  const applyCartUpdate = useCallback(
    (newCart: CartDto) => {
      setCart(newCart)
      setStatus('ready')
      setError(null)
      setSelectedProductIdsState((currentSelection) => {
        const { reconciledIds, hasPruned, prunedCount } = reconcileSelectionWithCart(
          currentSelection,
          newCart
        )
        if (hasPruned) {
          persistCartSelection(ownerId, reconciledIds)
          setPrunedNotification(
            `Đã tự động bỏ chọn ${prunedCount} sản phẩm không còn khả dụng hoặc đã thay đổi trong giỏ hàng.`
          )
          return reconciledIds
        }
        return currentSelection
      })
    },
    [ownerId]
  )

  const setSelectedProductIds = useCallback(
    (action: string[] | ((prev: string[]) => string[])) => {
      setSelectedProductIdsState((prev) => {
        const next = typeof action === 'function' ? action(prev) : action
        const valid = validateSelectedProductIds(next)
        persistCartSelection(ownerId, valid)
        return valid
      })
    },
    [ownerId]
  )

  const toggleSelectProduct = useCallback(
    (productId: string) => {
      if (!cart || !cart.items) return
      const targetItem = cart.items.find(
        (i) => i.productId.toLowerCase() === productId.toLowerCase()
      )
      // Không thể chọn sản phẩm canPurchase === false
      if (!targetItem || !targetItem.canPurchase) return

      setSelectedProductIdsState((prev) => {
        const exists = prev.some((id) => id.toLowerCase() === productId.toLowerCase())
        let next: string[]
        if (exists) {
          next = prev.filter((id) => id.toLowerCase() !== productId.toLowerCase())
        } else {
          if (prev.length >= 50) return prev
          next = [...prev, targetItem.productId]
        }
        persistCartSelection(ownerId, next)
        return next
      })
    },
    [cart, ownerId]
  )

  const toggleSelectAll = useCallback(() => {
    if (!cart || !cart.items) return
    const purchasable = cart.items.filter((i) => i.canPurchase)
    if (purchasable.length === 0) return

    setSelectedProductIdsState((prev) => {
      const allSelected =
        purchasable.length > 0 &&
        purchasable.every((i) =>
          prev.some((id) => id.toLowerCase() === i.productId.toLowerCase())
        )
      const next = allSelected
        ? []
        : purchasable.map((i) => i.productId).slice(0, 50)
      persistCartSelection(ownerId, next)
      return next
    })
  }, [cart, ownerId])

  const isProductSelected = useCallback(
    (productId: string) => {
      return selectedProductIds.some(
        (id) => id.toLowerCase() === productId.toLowerCase()
      )
    },
    [selectedProductIds]
  )

  const selectedTotals = useMemo(() => {
    return calculateCartSelectionTotals(cart, selectedProductIds)
  }, [cart, selectedProductIds])

  const clearPrunedNotification = useCallback(() => {
    setPrunedNotification(null)
  }, [])

  // Lưu trữ active load promise cho phiên hiện tại (không dùng chung giữa các user)
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
   * Tải giỏ hàng từ server cho session hiện tại
   */
  const loadCartInternal = useCallback(
    async (signal?: AbortSignal): Promise<CartDto> => {
      if (activeLoadRef.current) {
        return activeLoadRef.current
      }

      if (isMountedRef.current) {
        setStatus((prev) => (prev === 'ready' ? 'ready' : 'loading'))
        setError(null)
      }

      const fetchPromise = withAuthRetry((token) => getCart(token, signal))
        .then((data) => {
          if (isMountedRef.current) {
            applyCartUpdate(data)
          }
          return data
        })
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') {
            throw err
          }
          if (isMountedRef.current) {
            const msg = mapCartError(err)
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
    [withAuthRetry, applyCartUpdate]
  )

  const loadCart = useCallback(async (): Promise<void> => {
    await loadCartInternal()
  }, [loadCartInternal])

  // Tải giỏ hàng khi session authenticated được kích hoạt
  useEffect(() => {
    const abortController = new AbortController()
    if (authStatus === 'authenticated') {
      loadCartInternal(abortController.signal).catch(() => {
        // Lỗi đã được ghi nhận trong status và error state
      })
    }
    return () => {
      abortController.abort()
    }
  }, [authStatus, loadCartInternal])

  /**
   * Helper xử lý xung đột (conflict recovery):
   * 1. Tải lại state mới nhất đúng 1 lần (bắt lỗi để không tạo unhandled rejection)
   * 2. Không replay lại mutation
   * 3. Ném thông báo lỗi thân thiện cho caller
   */
  const recoverFromConflict = useCallback(
    async (err: unknown): Promise<never> => {
      try {
        await loadCartInternal()
      } catch {
        // Lỗi reload đã được ghi nhận trong status/error của provider
      }
      const friendlyMessage = mapCartError(err)
      throw new Error(friendlyMessage, { cause: err })
    },
    [loadCartInternal]
  )

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
        if (isMountedRef.current) {
          applyCartUpdate(updatedCart)
        }
        return updatedCart
      } catch (err) {
        if (isCartConflict(err)) {
          return await recoverFromConflict(err)
        }
        const friendlyMessage = mapCartError(err)
        if (isMountedRef.current) {
          setError(friendlyMessage)
        }
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, applyCartUpdate, recoverFromConflict]
  )

  /**
   * Thêm toàn bộ cấu hình PC đã lưu vào giỏ hàng
   */
  const addFromPCBuild = useCallback(
    async (pcBuildId: string): Promise<CartDto> => {
      if (authStatus !== 'authenticated') {
        throw new Error('Vui lòng đăng nhập để thêm cấu hình PC vào giỏ hàng.')
      }

      setIsMutating(true)
      try {
        const updatedCart = await withAuthRetry((token) =>
          apiAddPCBuildToCart(pcBuildId, token)
        )
        if (isMountedRef.current) {
          applyCartUpdate(updatedCart)
        }
        return updatedCart
      } catch (err) {
        if (isCartConflict(err)) {
          return await recoverFromConflict(err)
        }
        const friendlyMessage = mapCartError(err)
        if (isMountedRef.current) {
          setError(friendlyMessage)
        }
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [authStatus, withAuthRetry, applyCartUpdate, recoverFromConflict]
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
        if (isMountedRef.current) {
          applyCartUpdate(updatedCart)
        }
        return updatedCart
      } catch (err) {
        if (isCartConflict(err)) {
          return await recoverFromConflict(err)
        }
        const friendlyMessage = mapCartError(err)
        if (isMountedRef.current) {
          setError(friendlyMessage)
        }
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [withAuthRetry, applyCartUpdate, recoverFromConflict]
  )

  /**
   * Xóa một sản phẩm khỏi giỏ hàng
   */
  const removeItem = useCallback(
    async (productId: string): Promise<void> => {
      setIsMutating(true)
      try {
        await withAuthRetry((token) => removeCartItem(productId, token))
        setSelectedProductIdsState((prev) => {
          const next = prev.filter((id) => id.toLowerCase() !== productId.toLowerCase())
          persistCartSelection(ownerId, next)
          return next
        })
        // Endpoint trả 204 No Content -> refetch cart
        await loadCartInternal()
      } catch (err) {
        if (isCartConflict(err)) {
          return await recoverFromConflict(err)
        }
        const friendlyMessage = mapCartError(err)
        if (isMountedRef.current) {
          setError(friendlyMessage)
        }
        throw new Error(friendlyMessage, { cause: err })
      } finally {
        if (isMountedRef.current) {
          setIsMutating(false)
        }
      }
    },
    [withAuthRetry, ownerId, loadCartInternal, recoverFromConflict]
  )

  /**
   * Xóa sạch toàn bộ sản phẩm khỏi giỏ hàng
   */
  const clearCart = useCallback(async (): Promise<void> => {
    setIsMutating(true)
    try {
      await withAuthRetry((token) => apiClearCart(token))
      setSelectedProductIdsState([])
      persistCartSelection(ownerId, [])
      // Endpoint trả 204 No Content -> refetch cart
      await loadCartInternal()
    } catch (err) {
      if (isCartConflict(err)) {
        return await recoverFromConflict(err)
      }
      const friendlyMessage = mapCartError(err)
      if (isMountedRef.current) {
        setError(friendlyMessage)
      }
      throw new Error(friendlyMessage, { cause: err })
    } finally {
      if (isMountedRef.current) {
        setIsMutating(false)
      }
    }
  }, [withAuthRetry, ownerId, loadCartInternal, recoverFromConflict])

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
      addFromPCBuild,
      setQuantity,
      removeItem,
      clearCart,
      clearError,
      selectedProductIds,
      setSelectedProductIds,
      toggleSelectProduct,
      toggleSelectAll,
      isProductSelected,
      selectedTotals,
      prunedNotification,
      clearPrunedNotification,
    }),
    [
      cart,
      status,
      error,
      isMutating,
      itemCount,
      loadCart,
      addItem,
      addFromPCBuild,
      setQuantity,
      removeItem,
      clearCart,
      clearError,
      selectedProductIds,
      setSelectedProductIds,
      toggleSelectProduct,
      toggleSelectAll,
      isProductSelected,
      selectedTotals,
      prunedNotification,
      clearPrunedNotification,
    ]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/**
 * Outer CartProvider: Quản lý session isolation giữa các người dùng và trạng thái đăng nhập.
 * Unmount và reset toàn bộ state/ref khi người dùng đăng xuất hoặc chuyển đổi tài khoản.
 */
export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const { status: authStatus, user } = useAuth()

  // Key duy nhất gắn với auth status và user.id cụ thể
  const sessionKey =
    authStatus === 'authenticated' && user
      ? `authenticated:${user.id}`
      : authStatus

  return <CartSessionProvider key={sessionKey}>{children}</CartSessionProvider>
}
