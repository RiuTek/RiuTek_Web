import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useBlocker } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useAddresses } from '../addresses/AddressContext'
import { useCart } from '../cart/CartContext'
import { checkoutCart, getCheckoutQuote } from './checkoutApi'
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
  type CartQuoteCoordinator,
  type CartQuoteCoordinatorState,
  type CartQuoteSnapshot,
  type QuoteStatus,
  isCartCheckoutEligible,
  createCartQuoteSnapshot,
  doesQuoteMatchSnapshot,
  createCartQuoteCoordinator,
  loadSavedCartAttempt,
  persistSavedCartAttempt,
  canCreateNewCartOrder,
  canReplayExistingCartAttempt,
  canRecoverKnownCartOrder,
  shouldBlockCartNavigation,
  executeCartCheckoutSubmit,
} from './cartCheckoutHelper'

export type { QuoteStatus }

export function useCartCheckout() {
  const navigate = useNavigate()
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? ''
  const isAuthenticated = isCartCheckoutEligible({ authStatus, user })

  const {
    addresses,
    status: addressStatus,
    error: addressError,
    loadAddresses,
  } = useAddresses()
  const {
    cart,
    status: cartStatus,
    loadCart,
    selectedProductIds,
    setSelectedProductIds,
  } = useCart()

  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod>('COD')
  const [notes, setNotesState] = useState('')

  // Tự động phân giải địa chỉ đang chọn từ user preference hoặc fallback default/first
  const selectedAddressId = useMemo(() => {
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [addresses, userSelectedAddressId])

  // Active attempt khôi phục từ storage theo từng ownerId
  const [attemptState, setAttemptState] = useState<{
    ownerId: string
    attempt: ActiveCartAttempt | null
  }>(() => ({
    ownerId,
    attempt: loadSavedCartAttempt(ownerId),
  }))

  const activeAttempt = useMemo(() => {
    if (attemptState.ownerId === ownerId) {
      return attemptState.attempt
    }
    return loadSavedCartAttempt(ownerId)
  }, [attemptState, ownerId])

  const setActiveAttempt = useCallback(
    (nextAttempt: ActiveCartAttempt | null) => {
      setAttemptState({
        ownerId,
        attempt: nextAttempt,
      })
    },
    [ownerId]
  )

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Không cho phép đổi địa chỉ / phương thức / ghi chú khi đang submit hoặc có activeAttempt
  const setSelectedAddressId = useCallback(
    (addressId: string | null) => {
      if (isSubmitting || activeAttempt !== null) return
      setUserSelectedAddressId(addressId)
    },
    [isSubmitting, activeAttempt]
  )

  const setPaymentMethod = useCallback(
    (method: PaymentMethod) => {
      if (isSubmitting || activeAttempt !== null) return
      setPaymentMethodState(method)
    },
    [isSubmitting, activeAttempt]
  )

  const setNotes = useCallback(
    (nextNotes: string) => {
      if (isSubmitting || activeAttempt !== null) return
      setNotesState(nextNotes)
    },
    [isSubmitting, activeAttempt]
  )

  // Snapshot báo giá hiện hành (chỉ tồn tại khi session authenticated, cart ready, địa chỉ & selection hợp lệ)
  const currentSnapshot = useMemo(
    () =>
      createCartQuoteSnapshot({
        isAuthenticated,
        ownerId,
        addressId: selectedAddressId,
        selectedProductIds,
        cartStatus,
        cart,
      }),
    [isAuthenticated, ownerId, selectedAddressId, selectedProductIds, cartStatus, cart]
  )
  const currentSnapshotKey = currentSnapshot?.key ?? ''

  const [quoteState, setQuoteState] = useState<CartQuoteCoordinatorState>({
    status: 'idle',
    provenancedQuote: null,
    error: null,
    snapshotKey: null,
  })

  const isMountedRef = useRef(true)
  const latestOwnerIdRef = useRef(ownerId)
  const latestUserIdRef = useRef(user?.id ?? '')
  const latestSnapshotRef = useRef<CartQuoteSnapshot | null>(currentSnapshot)
  const getAccessTokenRef = useRef(getAccessToken)
  const loadCartRef = useRef(loadCart)
  const coordinatorRef = useRef<CartQuoteCoordinator | null>(null)

  // One-shot synchronous bypass cho navigation blocker khi order thành công
  const isSuccessBypassRef = useRef(false)
  const submitSeqRef = useRef(0)

  // React Router blocker để tránh rời trang khi attempt chưa xác định kết quả
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldBlockCartNavigation({
      currentPath: currentLocation.pathname,
      nextPath: nextLocation.pathname,
      isSuccessBypass: isSuccessBypassRef.current,
      isAttemptActive: activeAttempt !== null && activeAttempt.status !== 'idle',
    })
  )

  const getOrCreateCoordinator = useCallback((): CartQuoteCoordinator => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = createCartQuoteCoordinator({
        isContextCurrent: () =>
          isMountedRef.current &&
          Boolean(latestOwnerIdRef.current) &&
          latestUserIdRef.current === latestOwnerIdRef.current,
        getCurrentSnapshot: () => latestSnapshotRef.current,
        getAccessToken: (forceRefresh) => getAccessTokenRef.current(forceRefresh),
        getCheckoutQuote: (addressId, token, productIds, signal) =>
          getCheckoutQuote(addressId, token, productIds, signal),
        onStateChange: (nextState) => {
          if (isMountedRef.current) {
            setQuoteState(nextState)
          }
        },
        onVersionMismatchSync: async () => {
          await loadCartRef.current()
        },
      })
    }
    return coordinatorRef.current
  }, [])

  // Cleanup khi unmount hoặc đổi owner/account
  useEffect(() => {
    isMountedRef.current = true
    latestOwnerIdRef.current = ownerId
    return () => {
      isMountedRef.current = false
      if (coordinatorRef.current) {
        coordinatorRef.current.dispose()
        coordinatorRef.current = null
      }
    }
  }, [ownerId])

  useEffect(() => {
    latestUserIdRef.current = user?.id ?? ''
    getAccessTokenRef.current = getAccessToken
    loadCartRef.current = loadCart
  }, [user?.id, getAccessToken, loadCart])

  useEffect(() => {
    latestSnapshotRef.current = currentSnapshot
  }, [currentSnapshot])

  // Auto quote: đi qua cùng coordinator với manual retry
  useEffect(() => {
    const coordinator = getOrCreateCoordinator()
    void coordinator.requestQuote(latestSnapshotRef.current)
  }, [currentSnapshotKey, getOrCreateCoordinator])

  // Manual retry: capture snapshot hiện tại lúc click và đi qua cùng coordinator
  const refetchQuote = useCallback(async () => {
    const coordinator = getOrCreateCoordinator()
    await coordinator.requestQuote(latestSnapshotRef.current)
  }, [getOrCreateCoordinator])

  // Render guard chỉ quyết định có dùng quote/state của snapshot hiện hành hay không
  const isQuoteMatchingCurrentSnapshot =
    currentSnapshot !== null &&
    quoteState.snapshotKey === currentSnapshot.key &&
    doesQuoteMatchSnapshot(quoteState.provenancedQuote, currentSnapshot)

  const effectiveProvenancedQuote = isQuoteMatchingCurrentSnapshot
    ? quoteState.provenancedQuote
    : null

  const quote: CheckoutQuoteDto | null = effectiveProvenancedQuote
    ? effectiveProvenancedQuote.quote
    : null

  const quoteStatus: QuoteStatus =
    currentSnapshot === null
      ? 'idle'
      : quoteState.snapshotKey !== currentSnapshot.key
      ? 'loading'
      : quoteState.status

  const quoteError: string | null =
    currentSnapshot !== null && quoteState.snapshotKey === currentSnapshot.key
      ? quoteState.error
      : null

  const hasPendingQuoteRequest = quoteStatus === 'loading'

  // Gating quyết định submit tạo đơn mới
  const canCreate = canCreateNewCartOrder({
    isAuthenticated,
    ownerId,
    isSubmitting,
    activeAttempt,
    cartStatus,
    cart,
    selectedAddressId,
    selectedProductIds,
    provenancedQuote: effectiveProvenancedQuote,
    quoteStatus,
    hasPendingQuoteRequest,
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
    if (isSubmitting || !user?.id || user.id !== ownerId) return

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
      snapshot: currentSnapshot,
      provenancedQuote: effectiveProvenancedQuote,
      selectedAddressId,
      expectedCartVersion: currentSnapshot?.cartVersion ?? cart?.version ?? 0,
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

        // Prune các sản phẩm vừa mua khỏi selection (không đặt side effect trong state updater)
        if (order.items && order.items.length > 0) {
          const purchasedIds = new Set(order.items.map((i) => i.productId.toLowerCase()))
          const remainingIds = selectedProductIds.filter(
            (id) => !purchasedIds.has(id.toLowerCase())
          )
          setSelectedProductIds(remainingIds)
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
        loadCart()
          .then(() => refetchQuote())
          .catch(() => {})
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
    cartStatus,
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
    setSelectedAddressId,
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
