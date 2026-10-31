import { ApiError } from '../../lib/api'
import { CHECKOUT_ERROR_MESSAGES } from './checkoutConstants'
import type { AuthStatus, UserRole } from '../auth/authTypes'
import type { CartDto, CartStatus } from '../cart/cartTypes'
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentActionDto,
} from '../orders/orderTypes'
import type {
  CheckoutCartRequest,
  CheckoutOrderDto,
  CheckoutQuoteDto,
} from './checkoutTypes'
import type { SavePendingStripeData } from './stripeCheckoutSession'
import { validateSelectedProductIds } from '../cart/cartSelectionHelper'

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error'

export type CartAttemptStatus =
  | 'idle'
  | 'submitting'
  | 'unresolved'
  | 'stripe_storage_failed'
  | 'stripe_redirect_failed'

export interface KnownCartOrderState {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  paymentAction: PaymentActionDto | null
}

export interface ActiveCartAttempt {
  ownerId: string
  idempotencyKey: string
  requestPayload: CheckoutCartRequest
  status: CartAttemptStatus
  knownOrder: KnownCartOrderState | null
  unresolvedMessage: string | null
}

export function getCartAttemptStorageKey(ownerId: string): string {
  return `riutek:cart-checkout-attempt:${ownerId}`
}

/**
 * Validate và chuẩn hóa snapshot attempt đã lưu từ sessionStorage.
 * Nếu storage chứa status 'submitting': chuẩn hóa thành 'unresolved' và giữ nguyên key, payload, knownOrder.
 */
export function validateAndNormalizeSavedCartAttempt(
  raw: unknown,
  expectedOwnerId: string
): ActiveCartAttempt | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>

  if (candidate.ownerId !== expectedOwnerId) return null

  if (
    typeof candidate.idempotencyKey !== 'string' ||
    candidate.idempotencyKey.trim().length < 16 ||
    candidate.idempotencyKey.trim().length > 128
  ) {
    return null
  }

  const payload = candidate.requestPayload as Record<string, unknown> | undefined
  if (!payload || typeof payload !== 'object') return null

  if (typeof payload.addressId !== 'string' || !payload.addressId.trim()) {
    return null
  }

  if (
    typeof payload.expectedCartVersion !== 'number' ||
    !Number.isInteger(payload.expectedCartVersion) ||
    payload.expectedCartVersion < 1
  ) {
    return null
  }

  if (payload.paymentMethod !== 'COD' && payload.paymentMethod !== 'Stripe') {
    return null
  }

  const notes =
    payload.notes === null || payload.notes === undefined
      ? null
      : typeof payload.notes === 'string' && payload.notes.length <= 1000
      ? payload.notes
      : null

  const validSelectedIds = validateSelectedProductIds(payload.selectedProductIds)
  // Contract: selectedProductIds phải có 1..50 IDs hợp lệ
  if (validSelectedIds.length === 0) {
    return null
  }

  const validPayload: CheckoutCartRequest = {
    addressId: payload.addressId.trim(),
    expectedCartVersion: payload.expectedCartVersion,
    paymentMethod: payload.paymentMethod,
    notes,
    selectedProductIds: validSelectedIds,
  }

  let status: CartAttemptStatus
  let unresolvedMessage: string | null =
    typeof candidate.unresolvedMessage === 'string'
      ? candidate.unresolvedMessage
      : null

  if (candidate.status === 'submitting') {
    status = 'unresolved'
    unresolvedMessage =
      unresolvedMessage ||
      'Yêu cầu thanh toán trước đó đã bị gián đoạn. Đơn hàng của bạn có thể đã được khởi tạo trên hệ thống.'
  } else if (
    candidate.status === 'unresolved' ||
    candidate.status === 'stripe_storage_failed' ||
    candidate.status === 'stripe_redirect_failed'
  ) {
    status = candidate.status
  } else {
    return null
  }

  let knownOrder: KnownCartOrderState | null = null
  if (candidate.knownOrder && typeof candidate.knownOrder === 'object') {
    const ko = candidate.knownOrder as Record<string, unknown>
    if (
      typeof ko.id === 'string' &&
      ko.id.trim() &&
      typeof ko.orderNumber === 'string' &&
      ko.orderNumber.trim() &&
      typeof ko.status === 'string' &&
      typeof ko.paymentStatus === 'string' &&
      (ko.paymentMethod === 'COD' || ko.paymentMethod === 'Stripe')
    ) {
      knownOrder = {
        id: ko.id.trim(),
        orderNumber: ko.orderNumber.trim(),
        status: ko.status as OrderStatus,
        paymentStatus: ko.paymentStatus as PaymentStatus,
        paymentMethod: ko.paymentMethod as PaymentMethod,
        paymentAction: (ko.paymentAction as PaymentActionDto) || null,
      }
    }
  }

  return {
    ownerId: expectedOwnerId,
    idempotencyKey: candidate.idempotencyKey.trim(),
    requestPayload: validPayload,
    status,
    knownOrder,
    unresolvedMessage,
  }
}

export function loadSavedCartAttempt(ownerId: string): ActiveCartAttempt | null {
  if (!ownerId) return null
  try {
    const raw = sessionStorage.getItem(getCartAttemptStorageKey(ownerId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return validateAndNormalizeSavedCartAttempt(parsed, ownerId)
  } catch {
    return null
  }
}

export function persistSavedCartAttempt(
  attempt: ActiveCartAttempt | null,
  ownerId: string
): void {
  if (!ownerId) return
  try {
    const key = getCartAttemptStorageKey(ownerId)
    if (!attempt || attempt.status === 'idle') {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, JSON.stringify(attempt))
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Kiểm tra quyền thực hiện Cart Checkout theo đúng contract BE (OrderAuthHelper.ValidateActiveUserAsync):
 * Áp dụng cho mọi tài khoản đã xác thực hợp lệ (Customer, Staff, Admin).
 * Các trạng thái checking, anonymous, unavailable không đủ điều kiện tạo đơn mới.
 */
export function isCartCheckoutEligible(params: {
  authStatus: AuthStatus | string
  user: { id: string; role?: UserRole | string } | null
}): boolean {
  if (params.authStatus !== 'authenticated') return false
  if (!params.user || typeof params.user.id !== 'string' || !params.user.id.trim()) {
    return false
  }
  return true
}

/**
 * Snapshot định danh một ngữ cảnh báo giá hợp lệ:
 * S = { ownerId, addressId, sorted normalized selectedProductIds, expected cartVersion }
 */
export interface CartQuoteSnapshot {
  key: string
  ownerId: string
  addressId: string
  selectedProductIds: string[]
  normalizedSortedIds: string[]
  cartVersion: number
}

export interface CreateCartQuoteSnapshotParams {
  isAuthenticated: boolean
  ownerId: string
  addressId: string | null
  selectedProductIds: string[]
  cartStatus: CartStatus | string
  cart: Pick<CartDto, 'version' | 'items'> | null
}

/**
 * Khởi tạo snapshot báo giá chỉ khi:
 * - Phiên đã xác thực hợp lệ và có ownerId
 * - Giỏ hàng đã tải thành công (cartStatus === 'ready', cart !== null, version >= 1, items không rỗng)
 * - Có địa chỉ nhận hàng hợp lệ
 * - selectedProductIds có 1..50 UUID hợp lệ, không trùng lặp (copy mảng để tránh mutation ngoài ý muốn)
 */
export function createCartQuoteSnapshot(
  params: CreateCartQuoteSnapshotParams
): CartQuoteSnapshot | null {
  if (!params.isAuthenticated) return null

  const cleanOwnerId = typeof params.ownerId === 'string' ? params.ownerId.trim() : ''
  if (!cleanOwnerId) return null

  if (params.cartStatus !== 'ready' || !params.cart) return null
  if (
    typeof params.cart.version !== 'number' ||
    !Number.isInteger(params.cart.version) ||
    params.cart.version < 1
  ) {
    return null
  }
  if (!Array.isArray(params.cart.items) || params.cart.items.length === 0) {
    return null
  }

  const cleanAddressId =
    typeof params.addressId === 'string' ? params.addressId.trim() : ''
  if (!cleanAddressId) return null

  if (
    !Array.isArray(params.selectedProductIds) ||
    params.selectedProductIds.length === 0 ||
    params.selectedProductIds.length > 50
  ) {
    return null
  }

  const validSelectedIds = validateSelectedProductIds(params.selectedProductIds)
  if (
    validSelectedIds.length === 0 ||
    validSelectedIds.length !== params.selectedProductIds.length
  ) {
    return null
  }

  const selectedCopy = [...validSelectedIds]
  const normalizedSortedIds = selectedCopy.map((id) => id.toLowerCase()).sort()
  const key = `${cleanOwnerId.toLowerCase()}:${cleanAddressId.toLowerCase()}:${params.cart.version}:${normalizedSortedIds.join(',')}`

  return {
    key,
    ownerId: cleanOwnerId,
    addressId: cleanAddressId,
    selectedProductIds: selectedCopy,
    normalizedSortedIds,
    cartVersion: params.cart.version,
  }
}

/**
 * Quote kèm theo provenance (snapshot và key đã tạo ra nó).
 */
export interface ProvenancedCartQuote {
  quote: CheckoutQuoteDto
  snapshotKey: string
  snapshot: CartQuoteSnapshot
}

/**
 * Kiểm tra chặt chẽ xem một ProvenancedCartQuote có khớp chính xác với snapshot hiện hành S hay không:
 * 1. Provenance snapshotKey và ownerId khớp S
 * 2. quote.addressId == S.addressId (case-insensitive, trimmed)
 * 3. quote.cartVersion == S.cartVersion hiện hành
 * 4. Tập quote.items.productId KHỚP CHÍNH XÁC hai chiều với S.selectedProductIds (không duplicate, không thiếu, không thừa)
 */
export function doesQuoteMatchSnapshot(
  provenancedQuote: ProvenancedCartQuote | null,
  currentSnapshot: CartQuoteSnapshot | null
): boolean {
  if (!provenancedQuote || !currentSnapshot) return false
  if (provenancedQuote.snapshotKey !== currentSnapshot.key) return false
  if (
    provenancedQuote.snapshot.ownerId.trim().toLowerCase() !==
    currentSnapshot.ownerId.trim().toLowerCase()
  ) {
    return false
  }

  const { quote } = provenancedQuote
  if (!quote || typeof quote.addressId !== 'string') return false
  if (
    quote.addressId.trim().toLowerCase() !==
    currentSnapshot.addressId.trim().toLowerCase()
  ) {
    return false
  }

  if (
    typeof quote.cartVersion !== 'number' ||
    quote.cartVersion !== currentSnapshot.cartVersion
  ) {
    return false
  }

  if (!Array.isArray(quote.items) || quote.items.length === 0) return false
  if (quote.items.length !== currentSnapshot.normalizedSortedIds.length) {
    return false
  }

  const seenQuoteIds = new Set<string>()
  const normalizedQuoteIds: string[] = []

  for (const item of quote.items) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim()) {
      return false
    }
    const normalizedId = item.productId.trim().toLowerCase()
    if (seenQuoteIds.has(normalizedId)) {
      return false
    }
    seenQuoteIds.add(normalizedId)
    normalizedQuoteIds.push(normalizedId)
  }

  normalizedQuoteIds.sort()
  for (let i = 0; i < currentSnapshot.normalizedSortedIds.length; i++) {
    if (normalizedQuoteIds[i] !== currentSnapshot.normalizedSortedIds[i]) {
      return false
    }
  }

  return true
}

export interface CanCreateNewCartOrderParams {
  isAuthenticated: boolean
  ownerId: string
  isSubmitting: boolean
  activeAttempt: ActiveCartAttempt | null
  cartStatus: CartStatus | string
  cart: Pick<CartDto, 'version' | 'items'> | null
  selectedAddressId: string | null
  selectedProductIds: string[]
  provenancedQuote: ProvenancedCartQuote | null
  quoteStatus: QuoteStatus | string
  hasPendingQuoteRequest?: boolean
  notes: string
}

/**
 * Điều kiện để ĐẶT ĐƠN MỚI TỪ GIỎ HÀNG (Section 3):
 * 1. Phiên authenticated đúng owner, không active attempt và không submitting.
 * 2. Cart đã tải thành công, selection nonempty hợp lệ, địa chỉ hiện hành hợp lệ.
 * 3. Quote ready và provenance khớp snapshot hiện hành; không có request mới hơn đang invalidating quote.
 * 4. quote.addressId == S.addressId; quote.cartVersion == S.cartVersion hiện hành.
 * 5. Tập quote.items.productId KHỚP CHÍNH XÁC selection S (hai chiều, không duplicate, không thiếu/thừa).
 * 6. quote.canCheckout === true và notes <= 1000 ký tự.
 */
export function canCreateNewCartOrder(params: CanCreateNewCartOrderParams): boolean {
  const {
    isAuthenticated,
    ownerId,
    isSubmitting,
    activeAttempt,
    cartStatus,
    cart,
    selectedAddressId,
    selectedProductIds,
    provenancedQuote,
    quoteStatus,
    hasPendingQuoteRequest = false,
    notes,
  } = params

  if (!isAuthenticated || isSubmitting || activeAttempt !== null) return false
  if (typeof notes !== 'string' || notes.length > 1000) return false
  if (quoteStatus !== 'ready' || hasPendingQuoteRequest) return false

  const snapshot = createCartQuoteSnapshot({
    isAuthenticated,
    ownerId,
    addressId: selectedAddressId,
    selectedProductIds,
    cartStatus,
    cart,
  })
  if (!snapshot) return false

  if (!doesQuoteMatchSnapshot(provenancedQuote, snapshot)) {
    return false
  }

  if (!provenancedQuote || !provenancedQuote.quote.canCheckout) {
    return false
  }

  return true
}

export function mapCheckoutQuoteError(err: unknown): string {
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

export interface CartQuoteCoordinatorState {
  status: QuoteStatus
  provenancedQuote: ProvenancedCartQuote | null
  error: string | null
  snapshotKey: string | null
}

export interface CartQuoteCoordinatorDeps {
  isContextCurrent: () => boolean
  getCurrentSnapshot: () => CartQuoteSnapshot | null
  getAccessToken: (forceRefresh: boolean) => Promise<string | null>
  getCheckoutQuote: (
    addressId: string,
    token: string,
    selectedProductIds: string[],
    signal?: AbortSignal
  ) => Promise<CheckoutQuoteDto>
  onStateChange: (state: CartQuoteCoordinatorState) => void
  onVersionMismatchSync?: (info: {
    snapshot: CartQuoteSnapshot
    quoteCartVersion: number
  }) => Promise<void> | void
  maxConsecutiveVersionMismatchSyncs?: number
}

export interface CartQuoteCoordinator {
  requestQuote: (snapshotInput?: CartQuoteSnapshot | null) => Promise<void>
  invalidate: (notifyIdle?: boolean) => number
  dispose: () => void
  hasPendingRequest: () => boolean
  getCurrentSequence: () => number
}

/**
 * Production request coordinator dùng chung cho cả useEffect (auto quote) và refetchQuote (manual retry).
 */
export function createCartQuoteCoordinator(
  deps: CartQuoteCoordinatorDeps
): CartQuoteCoordinator {
  let currentSeq = 0
  let activeRequestSeq: number | null = null
  let activeAbortController: AbortController | null = null
  let disposed = false
  const syncedMismatchSnapshotKeys = new Set<string>()
  let consecutiveVersionMismatchCount = 0
  const maxMismatchSyncs = deps.maxConsecutiveVersionMismatchSyncs ?? 2

  const hasPendingRequest = (): boolean => {
    return !disposed && activeRequestSeq !== null && activeRequestSeq === currentSeq
  }

  const getCurrentSequence = (): number => currentSeq

  const invalidate = (notifyIdle = true): number => {
    const seq = ++currentSeq
    activeRequestSeq = null
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
    if (notifyIdle && !disposed && deps.isContextCurrent()) {
      deps.onStateChange({
        status: 'idle',
        provenancedQuote: null,
        error: null,
        snapshotKey: null,
      })
    }
    return seq
  }

  const dispose = (): void => {
    disposed = true
    currentSeq += 1
    activeRequestSeq = null
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  }

  const requestQuote = async (
    snapshotInput?: CartQuoteSnapshot | null
  ): Promise<void> => {
    const snapshot =
      snapshotInput !== undefined ? snapshotInput : deps.getCurrentSnapshot()

    if (disposed || !deps.isContextCurrent()) {
      invalidate(false)
      return
    }

    // Nếu snapshot mới rỗng (selection [], address null, cart chưa ready...):
    // Vô hiệu hóa quote ngay, tăng sequence để hủy mọi request đang bay và đưa về idle.
    if (!snapshot) {
      invalidate(true)
      return
    }

    const seq = ++currentSeq
    activeRequestSeq = seq

    if (activeAbortController) {
      activeAbortController.abort()
    }
    const abortController = new AbortController()
    activeAbortController = abortController

    const requestProductIds = [...snapshot.selectedProductIds]

    deps.onStateChange({
      status: 'loading',
      provenancedQuote: null,
      error: null,
      snapshotKey: snapshot.key,
    })

    const isRequestCurrent = (): boolean => {
      if (disposed) return false
      if (!deps.isContextCurrent()) return false
      if (currentSeq !== seq) return false
      const liveSnapshot = deps.getCurrentSnapshot()
      if (!liveSnapshot || liveSnapshot.key !== snapshot.key) return false
      return true
    }

    try {
      let token = await deps.getAccessToken(false)
      if (!isRequestCurrent()) return
      if (!token) {
        throw new Error('Chưa đăng nhập.')
      }

      let result: CheckoutQuoteDto
      try {
        result = await deps.getCheckoutQuote(
          snapshot.addressId,
          token,
          requestProductIds,
          abortController.signal
        )
      } catch (err: unknown) {
        if (!isRequestCurrent()) return
        if (err instanceof ApiError && err.status === 401) {
          token = await deps.getAccessToken(true)
          if (!isRequestCurrent()) return
          if (!token) {
            throw new Error('Chưa đăng nhập.', { cause: err })
          }
          result = await deps.getCheckoutQuote(
            snapshot.addressId,
            token,
            requestProductIds,
            abortController.signal
          )
        } else {
          throw err
        }
      }

      if (!isRequestCurrent()) return

      // Nếu quote trả về cartVersion khác với snapshot.cartVersion hiện hành:
      // Không cho phép submit bằng quote này trên UI cart cũ; chuyển sang trạng thái cần đồng bộ
      if (
        typeof result.cartVersion !== 'number' ||
        result.cartVersion !== snapshot.cartVersion
      ) {
        const canSyncThisSnapshot =
          !syncedMismatchSnapshotKeys.has(snapshot.key) &&
          consecutiveVersionMismatchCount < maxMismatchSyncs

        if (activeRequestSeq === seq) {
          activeRequestSeq = null
        }

        deps.onStateChange({
          status: 'error',
          provenancedQuote: null,
          error: canSyncThisSnapshot
            ? 'Giỏ hàng vừa được cập nhật ở phiên khác. Đang đồng bộ lại dữ liệu giỏ hàng...'
            : 'Giỏ hàng đã thay đổi so với phiên hiện tại. Vui lòng kiểm tra lại giỏ hàng.',
          snapshotKey: snapshot.key,
        })

        if (canSyncThisSnapshot && deps.onVersionMismatchSync) {
          syncedMismatchSnapshotKeys.add(snapshot.key)
          consecutiveVersionMismatchCount += 1
          try {
            await deps.onVersionMismatchSync({
              snapshot,
              quoteCartVersion: result.cartVersion,
            })
          } catch {
            return
          }
          if (disposed || !deps.isContextCurrent() || currentSeq !== seq) return
          const updatedSnapshot = deps.getCurrentSnapshot()
          if (updatedSnapshot && updatedSnapshot.key !== snapshot.key) {
            await requestQuote(updatedSnapshot)
          }
        }
        return
      }

      const candidateProvenanced: ProvenancedCartQuote = {
        quote: result,
        snapshotKey: snapshot.key,
        snapshot,
      }

      if (!doesQuoteMatchSnapshot(candidateProvenanced, snapshot)) {
        if (activeRequestSeq === seq) {
          activeRequestSeq = null
        }
        deps.onStateChange({
          status: 'error',
          provenancedQuote: null,
          error:
            'Dữ liệu báo giá phản hồi không khớp với lựa chọn hiện tại. Vui lòng thử lại.',
          snapshotKey: snapshot.key,
        })
        return
      }

      consecutiveVersionMismatchCount = 0
      if (activeRequestSeq === seq) {
        activeRequestSeq = null
      }
      deps.onStateChange({
        status: 'ready',
        provenancedQuote: candidateProvenanced,
        error: null,
        snapshotKey: snapshot.key,
      })
    } catch (err: unknown) {
      if (!isRequestCurrent()) return
      if (err instanceof Error && err.name === 'AbortError') return

      if (activeRequestSeq === seq) {
        activeRequestSeq = null
      }
      const msg = mapCheckoutQuoteError(err)
      deps.onStateChange({
        status: 'error',
        provenancedQuote: null,
        error: msg,
        snapshotKey: snapshot.key,
      })
    } finally {
      if (activeRequestSeq === seq) {
        activeRequestSeq = null
      }
      if (activeAbortController === abortController) {
        activeAbortController = null
      }
    }
  }

  return {
    requestQuote,
    invalidate,
    dispose,
    hasPendingRequest,
    getCurrentSequence,
  }
}

/**
 * Điều kiện để REPLAY ATTEMPT CŨ:
 * Độc lập hoàn toàn với việc cart hiện tại có còn sản phẩm hay không,
 * quote có sẵn sàng hay không, hay địa chỉ còn trong sổ hay không.
 */
export function canReplayExistingCartAttempt(params: {
  activeAttempt: ActiveCartAttempt | null
  isSubmitting: boolean
}): boolean {
  const { activeAttempt, isSubmitting } = params
  if (isSubmitting || !activeAttempt) return false
  return (
    activeAttempt.status === 'unresolved' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

export function canRecoverKnownCartOrder(params: {
  activeAttempt: ActiveCartAttempt | null
  isSubmitting: boolean
}): boolean {
  const { activeAttempt, isSubmitting } = params
  if (isSubmitting || !activeAttempt || !activeAttempt.knownOrder) return false
  return (
    activeAttempt.status === 'stripe_storage_failed' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

export function canShowKnownCartOrderLink(attempt: {
  status: CartAttemptStatus
  knownOrder: KnownCartOrderState | null
} | null): boolean {
  if (!attempt || !attempt.knownOrder) return false
  return (
    attempt.status === 'unresolved' ||
    attempt.status === 'stripe_storage_failed' ||
    attempt.status === 'stripe_redirect_failed'
  )
}

export function shouldBlockCartNavigation(params: {
  currentPath: string
  nextPath: string
  isSuccessBypass: boolean
  isAttemptActive: boolean
}): boolean {
  const { currentPath, nextPath, isSuccessBypass, isAttemptActive } = params
  if (isSuccessBypass) return false
  if (!isAttemptActive) return false
  return currentPath !== nextPath
}

export interface CartSubmitDeps {
  ownerId: string
  user: { id: string } | null
  canCreate: boolean
  canReplay: boolean
  activeAttempt: ActiveCartAttempt | null
  snapshot?: CartQuoteSnapshot | null
  provenancedQuote?: ProvenancedCartQuote | null
  selectedAddressId: string | null
  expectedCartVersion: number
  paymentMethod: PaymentMethod
  notes: string
  selectedProductIds: string[]
  isSubmitting: boolean
  getAccessToken: (forceRefresh: boolean) => Promise<string | null>
  checkoutCart: (
    req: CheckoutCartRequest,
    idempotencyKey: string,
    token: string
  ) => Promise<CheckoutOrderDto>
  savePendingStripeCheckout: (pending: SavePendingStripeData) => boolean
  validateStripeRedirectUrl: (url: string) => boolean
  redirectStripe?: (url: string) => void
  onSuccessNavigate: (order: CheckoutOrderDto) => void
  setActiveAttempt: (attempt: ActiveCartAttempt | null) => void
  persistSavedAttempt: (attempt: ActiveCartAttempt | null, ownerId: string) => void
  setSubmitError: (msg: string | null) => void
  setIsSubmitting: (submitting: boolean) => void
  isContextCurrent: () => boolean
  onReconcileNeeded?: () => void
  onAddressNotFound?: () => void
  generateUUID?: () => string
}

/**
 * Core async submit handler cho Checkout Cart theo selectedProductIds.
 */
export async function executeCartCheckoutSubmit(deps: CartSubmitDeps): Promise<void> {
  if (deps.isSubmitting || !deps.user?.id || deps.user.id !== deps.ownerId) return

  let attemptKey: string
  let attemptPayload: CheckoutCartRequest
  let capturedKnownOrder: KnownCartOrderState | null = null

  if (deps.canReplay && deps.activeAttempt) {
    attemptKey = deps.activeAttempt.idempotencyKey
    attemptPayload = deps.activeAttempt.requestPayload
    capturedKnownOrder = deps.activeAttempt.knownOrder ?? null

    const replayingAttempt: ActiveCartAttempt = {
      ...deps.activeAttempt,
      status: 'submitting',
      knownOrder: capturedKnownOrder,
    }
    deps.setActiveAttempt(replayingAttempt)
    deps.persistSavedAttempt(replayingAttempt, deps.ownerId)
  } else if (deps.canCreate && !deps.activeAttempt) {
    if (typeof deps.notes !== 'string' || deps.notes.length > 1000) return

    // Nếu truyền snapshot/provenancedQuote: bắt buộc xác thực khớp tuyệt đối trước khi tạo attempt mới
    if (deps.snapshot !== undefined || deps.provenancedQuote !== undefined) {
      if (
        !deps.snapshot ||
        !deps.provenancedQuote ||
        !doesQuoteMatchSnapshot(deps.provenancedQuote, deps.snapshot) ||
        !deps.provenancedQuote.quote.canCheckout
      ) {
        return
      }
    }

    const effectiveAddressId = deps.snapshot?.addressId ?? deps.selectedAddressId
    const effectiveCartVersion =
      deps.snapshot?.cartVersion ?? deps.expectedCartVersion
    const effectiveSelectedIds = deps.snapshot
      ? [...deps.snapshot.selectedProductIds]
      : validateSelectedProductIds(deps.selectedProductIds)

    if (
      !effectiveAddressId ||
      !Number.isInteger(effectiveCartVersion) ||
      effectiveCartVersion < 1 ||
      effectiveSelectedIds.length === 0
    ) {
      return
    }

    const cleanNotes = deps.notes.trim()
    const uuidGen = deps.generateUUID || (() => crypto.randomUUID())
    attemptKey = uuidGen()
    attemptPayload = {
      addressId: effectiveAddressId,
      expectedCartVersion: effectiveCartVersion,
      paymentMethod: deps.paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
      selectedProductIds: effectiveSelectedIds,
    }

    const newAttempt: ActiveCartAttempt = {
      ownerId: deps.ownerId,
      idempotencyKey: attemptKey,
      requestPayload: attemptPayload,
      status: 'submitting',
      knownOrder: null,
      unresolvedMessage: null,
    }
    deps.setActiveAttempt(newAttempt)
    deps.persistSavedAttempt(newAttempt, deps.ownerId)
  } else {
    return
  }

  deps.setIsSubmitting(true)
  deps.setSubmitError(null)

  try {
    let token = await deps.getAccessToken(false)
    if (!deps.isContextCurrent()) return
    if (!token) throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')

    const executeCheckout = async (authToken: string) => {
      return deps.checkoutCart(attemptPayload, attemptKey, authToken)
    }

    let order: CheckoutOrderDto
    try {
      order = await executeCheckout(token)
    } catch (err: unknown) {
      if (!deps.isContextCurrent()) return
      if (err instanceof ApiError && err.status === 401) {
        token = await deps.getAccessToken(true)
        if (!deps.isContextCurrent()) return
        if (!token) throw err
        order = await executeCheckout(token)
      } else {
        throw err
      }
    }

    if (!deps.isContextCurrent()) return

    const known: KnownCartOrderState = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      paymentAction: order.paymentAction,
    }

    if (order.paymentMethod === 'COD') {
      deps.onSuccessNavigate(order)
      return
    }

    if (order.paymentMethod === 'Stripe') {
      if (order.paymentStatus === 'Completed' || order.status !== 'PendingPayment') {
        deps.onSuccessNavigate(order)
        return
      }

      const action = order.paymentAction
      if (
        !action ||
        action.type !== 'Redirect' ||
        !action.url ||
        !deps.validateStripeRedirectUrl(action.url)
      ) {
        const failedAttempt: ActiveCartAttempt = {
          ownerId: deps.ownerId,
          idempotencyKey: attemptKey,
          requestPayload: attemptPayload,
          status: 'stripe_redirect_failed',
          knownOrder: known,
          unresolvedMessage:
            'Liên kết thanh toán Stripe từ máy chủ không hợp lệ hoặc đã hết hạn.',
        }
        deps.setActiveAttempt(failedAttempt)
        deps.persistSavedAttempt(failedAttempt, deps.ownerId)
        deps.setSubmitError(
          'Liên kết thanh toán Stripe không hợp lệ hoặc đã hết hạn. Đơn hàng của bạn đã được lưu trên hệ thống, bạn có thể xem chi tiết đơn để tiếp tục.'
        )
        return
      }

      const saved = deps.savePendingStripeCheckout({
        source: 'cart',
        userId: deps.user.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        idempotencyKey: attemptKey,
        addressId: attemptPayload.addressId,
        expectedCartVersion: attemptPayload.expectedCartVersion,
        selectedProductIds: attemptPayload.selectedProductIds,
      })

      if (!saved) {
        const storageFailedAttempt: ActiveCartAttempt = {
          ownerId: deps.ownerId,
          idempotencyKey: attemptKey,
          requestPayload: attemptPayload,
          status: 'stripe_storage_failed',
          knownOrder: known,
          unresolvedMessage:
            'Trình duyệt đang chặn lưu trữ phiên thanh toán (sessionStorage).',
        }
        deps.setActiveAttempt(storageFailedAttempt)
        deps.persistSavedAttempt(storageFailedAttempt, deps.ownerId)
        deps.setSubmitError(
          'Trình duyệt đang chặn lưu trữ phiên thanh toán tạm thời. Đơn hàng đã được tạo thành công, bạn có thể mở chi tiết đơn hàng để tiếp tục thanh toán.'
        )
        return
      }

      try {
        if (deps.redirectStripe) {
          deps.redirectStripe(action.url)
        } else {
          window.location.assign(action.url)
        }
        return
      } catch (redirectErr) {
        const redirectFailedAttempt: ActiveCartAttempt = {
          ownerId: deps.ownerId,
          idempotencyKey: attemptKey,
          requestPayload: attemptPayload,
          status: 'stripe_redirect_failed',
          knownOrder: known,
          unresolvedMessage:
            redirectErr instanceof Error
              ? redirectErr.message
              : 'Không thể chuyển hướng sang Stripe.',
        }
        deps.setActiveAttempt(redirectFailedAttempt)
        deps.persistSavedAttempt(redirectFailedAttempt, deps.ownerId)
        deps.setSubmitError(
          'Không thể chuyển hướng sang Stripe. Đơn hàng đã được lưu an toàn, vui lòng mở chi tiết đơn hàng.'
        )
        return
      }
    }
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return

    if (err instanceof ApiError) {
      const isDefinitivePreMutation =
        err.code === 'Checkout.CartChanged' ||
        err.code === 'Checkout.SelectionChanged' ||
        err.code === 'Checkout.InventoryChanged' ||
        err.code === 'Checkout.EmptyCart' ||
        err.code === 'Checkout.AddressNotFound' ||
        err.code === 'Checkout.ProductNotFound' ||
        err.code === 'Checkout.ProductInactive' ||
        err.code === 'Checkout.PaymentMethodNotAvailable' ||
        err.code === 'Checkout.InsufficientStock' ||
        err.code === 'Checkout.InvalidPrice' ||
        err.status === 400 ||
        err.status === 403 ||
        err.status === 404 ||
        err.status === 409

      if (isDefinitivePreMutation) {
        deps.setActiveAttempt(null)
        deps.persistSavedAttempt(null, deps.ownerId)

        let msg = 'Không thể thanh toán giỏ hàng lúc này.'
        if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
          msg = CHECKOUT_ERROR_MESSAGES[err.code]
        } else if (err.description) {
          msg = err.description
        } else if (err.message) {
          msg = err.message
        }
        deps.setSubmitError(msg)

        if (err.code === 'Checkout.AddressNotFound' && deps.onAddressNotFound) {
          deps.onAddressNotFound()
        }

        // Với SelectionChanged, CartChanged, InventoryChanged -> gọi reconcile để refresh cart/quote
        if (deps.onReconcileNeeded) {
          deps.onReconcileNeeded()
        }
        return
      }

      const unresolvedMsg =
        (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) ||
        err.description ||
        err.message ||
        'Chưa thể xác nhận kết quả từ máy chủ do lỗi kết nối hoặc phản hồi chậm.'

      const unresolvedAttempt: ActiveCartAttempt = {
        ownerId: deps.ownerId,
        idempotencyKey: attemptKey,
        requestPayload: attemptPayload,
        status: 'unresolved',
        knownOrder: capturedKnownOrder,
        unresolvedMessage: unresolvedMsg,
      }
      deps.setActiveAttempt(unresolvedAttempt)
      deps.persistSavedAttempt(unresolvedAttempt, deps.ownerId)
      deps.setSubmitError(unresolvedMsg)
    } else {
      const networkMsg =
        err instanceof Error
          ? err.message
          : 'Mất kết nối với máy chủ. Vui lòng kiểm tra lại kết nối mạng.'

      const unresolvedAttempt: ActiveCartAttempt = {
        ownerId: deps.ownerId,
        idempotencyKey: attemptKey,
        requestPayload: attemptPayload,
        status: 'unresolved',
        knownOrder: capturedKnownOrder,
        unresolvedMessage: networkMsg,
      }
      deps.setActiveAttempt(unresolvedAttempt)
      deps.persistSavedAttempt(unresolvedAttempt, deps.ownerId)
      deps.setSubmitError(networkMsg)
    }
  } finally {
    if (deps.isContextCurrent()) {
      deps.setIsSubmitting(false)
    }
  }
}
