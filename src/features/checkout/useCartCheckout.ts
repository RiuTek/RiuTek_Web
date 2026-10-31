import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { UserRole } from '../auth/authTypes'
import { useAddresses } from '../addresses/AddressContext'
import { useCart } from '../cart/CartContext'
import { checkoutCart, getCheckoutQuote } from './checkoutApi'
import {
  CHECKOUT_ERROR_MESSAGES,
} from './checkoutConstants'
import {
  savePendingStripeCheckout,
  validateStripeRedirectUrl,
} from './stripeCheckoutSession'
import type {
  CheckoutOrderDto,
  CheckoutQuoteDto,
  PaymentMethod,
} from './checkoutTypes'
import {
  type ActiveCartAttempt,
  loadSavedCartAttempt,
  persistSavedCartAttempt,
  canCreateNewCartOrder,
  canReplayExistingCartAttempt,
  canRecoverKnownCartOrder,
  shouldBlockCartNavigation,
  executeCartCheckoutSubmit,
} from './cartCheckoutHelper'

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error'

function mapCheckoutError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
      return CHECKOUT_ERROR_MESSAGES[err.code]
    }
    if (err.description) return err.description
    if (err.message) return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Đã xảy ra lỗi trong quá trình xử lý đơn hàng. Vui lòng thử lại.'
}

export function useCartCheckout() {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? ''
  const isCustomer = user?.role === UserRole.Customer

  const {
    addresses,
    status: addressStatus,
    error: addressError,
    loadAddresses,
  } = useAddresses()
  const { cart, loadCart, selectedProductIds, setSelectedProductIds } = useCart()

  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [notes, setNotes] = useState('')

  // Tự động phân giải địa chỉ đang chọn từ user preference hoặc fallback default/first
  const selectedAddressId = useMemo(() => {
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [addresses, userSelectedAddressId])

  // Active attempt khôi phục từ storage
  const [activeAttempt, setActiveAttempt] = useState<ActiveCartAttempt | null>(() =>
    loadSavedCartAttempt(ownerId)
  )

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // One-shot synchronous bypass cho navigation blocker khi order thành công
  const isSuccessBypassRef = useRef(false)
  const submitSeqRef = useRef(0)

  // React Router blocker để tránh khách rời trang khi attempt chưa xác định kết quả
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldBlockCartNavigation({
      currentPath: currentLocation.pathname,
      nextPath: nextLocation.pathname,
      isSuccessBypass: isSuccessBypassRef.current,
      isAttemptActive: activeAttempt !== null && activeAttempt.status !== 'idle',
    })
  )

  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('idle')
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Tracking sequence để huỷ response quote cũ nếu user đổi địa chỉ/selection/version
  const quoteRequestIdRef = useRef(0)

  // Token helper có retry 1 lần khi 401
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
          token = await getAccessToken(true)
          if (!token) {
            throw new Error('Chưa đăng nhập.', { cause: err })
          }
          return await operation(token)
        }
        throw err
      }
    },
    [getAccessToken]
  )

  // Quote identity tracking
  const sortedSelectedIdsStr = useMemo(
    () => [...selectedProductIds].sort().join(','),
    [selectedProductIds]
  )
  const cartVersion = cart?.version ?? 0

  const currentQuoteIdentity = useMemo(() => {
    if (!selectedAddressId || selectedProductIds.length === 0) return ''
    return `${ownerId}:${selectedAddressId}:${sortedSelectedIdsStr}:${cartVersion}`
  }, [ownerId, selectedAddressId, sortedSelectedIdsStr, cartVersion, selectedProductIds.length])

  const [prevQuoteIdentity, setPrevQuoteIdentity] = useState(currentQuoteIdentity)
  if (currentQuoteIdentity !== prevQuoteIdentity) {
    setPrevQuoteIdentity(currentQuoteIdentity)
    setQuote(null)
    setQuoteStatus(currentQuoteIdentity ? 'loading' : 'idle')
    setQuoteError(null)
  }

  // Tải báo giá khi quote identity thay đổi
  useEffect(() => {
    if (!currentQuoteIdentity || !selectedAddressId || selectedProductIds.length === 0) {
      return
    }

    let cancelled = false
    const currentRequestId = ++quoteRequestIdRef.current

    withAuthRetry((token) =>
      getCheckoutQuote(selectedAddressId, token, selectedProductIds)
    )
      .then((result) => {
        if (!cancelled && currentRequestId === quoteRequestIdRef.current) {
          setQuote(result)
          setQuoteStatus('ready')
          setQuoteError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && currentRequestId === quoteRequestIdRef.current) {
          const msg = mapCheckoutError(err)
          setQuoteError(msg)
          setQuoteStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [currentQuoteIdentity, selectedAddressId, selectedProductIds, withAuthRetry])

  const refetchQuote = useCallback(async () => {
    if (!selectedAddressId || selectedProductIds.length === 0) return
    const currentRequestId = ++quoteRequestIdRef.current
    setQuoteStatus('loading')
    setQuoteError(null)

    try {
      const result = await withAuthRetry((token) =>
        getCheckoutQuote(selectedAddressId, token, selectedProductIds)
      )
      if (currentRequestId === quoteRequestIdRef.current) {
        setQuote(result)
        setQuoteStatus('ready')
        setQuoteError(null)
      }
    } catch (err: unknown) {
      if (currentRequestId === quoteRequestIdRef.current) {
        const msg = mapCheckoutError(err)
        setQuoteError(msg)
        setQuoteStatus('error')
      }
    }
  }, [selectedAddressId, selectedProductIds, withAuthRetry])

  // Gating quyết định submit
  const canCreate = canCreateNewCartOrder({
    isCustomer,
    isSubmitting,
    activeAttempt,
    selectedAddressId,
    quote,
    quoteStatus,
    selectedProductIds,
    notes,
  })

  const canReplay = canReplayExistingCartAttempt({
    activeAttempt,
    isSubmitting,
  })

  const canRecover = canRecoverKnownCartOrder({
    activeAttempt,
    isSubmitting,
  })

  const handleCheckout = async (): Promise<CheckoutOrderDto | void> => {
    if (isSubmitting || !user?.id) return

    const submitSeq = ++submitSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      user.id === ownerId &&
      submitSeqRef.current === submitSeq

    await executeCartCheckoutSubmit({
      ownerId,
      user,
      canCreate,
      canReplay,
      activeAttempt,
      selectedAddressId,
      expectedCartVersion: quote?.cartVersion ?? cartVersion,
      paymentMethod,
      notes,
      selectedProductIds,
      isSubmitting,
      getAccessToken,
      checkoutCart,
      savePendingStripeCheckout,
      validateStripeRedirectUrl,
      onSuccessNavigate: (order) => {
        isSuccessBypassRef.current = true
        setActiveAttempt(null)
        persistSavedCartAttempt(null, ownerId)

        // Prune các sản phẩm vừa mua khỏi selection
        if (order.items && order.items.length > 0) {
          const purchasedIds = new Set(order.items.map((i) => i.productId.toLowerCase()))
          setSelectedProductIds((prev) =>
            prev.filter((id) => !purchasedIds.has(id.toLowerCase()))
          )
        }

        // Tải lại giỏ hàng (giữ lại các sản phẩm chưa thanh toán)
        loadCart().catch(() => {})

        if (blocker.state === 'blocked') {
          blocker.reset()
        }
        navigate(`/checkout/success?orderId=${encodeURIComponent(order.id)}`)
      },
      setActiveAttempt,
      persistSavedAttempt: persistSavedCartAttempt,
      setSubmitError,
      setIsSubmitting,
      isContextCurrent,
      onReconcileNeeded: () => {
        loadCart().catch(() => {})
        refetchQuote().catch(() => {})
      },
      onAddressNotFound: () => {
        loadAddresses().catch(() => {})
      },
    })
  }

  // Thử lưu lại pending Stripe và chuyển hướng
  const handleRetryStorageAndRedirect = () => {
    if (!activeAttempt?.knownOrder?.paymentAction?.url || !user?.id) return
    const url = activeAttempt.knownOrder.paymentAction.url
    if (!validateStripeRedirectUrl(url)) {
      setSubmitError('URL thanh toán Stripe không hợp lệ.')
      return
    }

    const saved = savePendingStripeCheckout({
      source: 'cart',
      userId: user.id,
      orderId: activeAttempt.knownOrder.id,
      orderNumber: activeAttempt.knownOrder.orderNumber,
      idempotencyKey: activeAttempt.idempotencyKey,
      addressId: activeAttempt.requestPayload.addressId,
      expectedCartVersion: activeAttempt.requestPayload.expectedCartVersion,
      selectedProductIds: activeAttempt.requestPayload.selectedProductIds,
    })

    if (!saved) {
      setSubmitError(
        'Vẫn không thể lưu phiên vào trình duyệt. Vui lòng mở chi tiết đơn hàng trong tài khoản.'
      )
      return
    }

    window.location.assign(url)
  }

  return {
    user,
    cart,
    selectedProductIds,
    activeAttempt,
    canCreate,
    canReplay,
    canRecover,
    blocker,
    addresses,
    addressStatus,
    addressError,
    loadAddresses,
    selectedAddressId,
    setSelectedAddressId: setUserSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    quote,
    quoteStatus,
    quoteError,
    refetchQuote,
    isSubmitting,
    submitError,
    setSubmitError,
    handleCheckout,
    handleRetryStorageAndRedirect,
  }
}
