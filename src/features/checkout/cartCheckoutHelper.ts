import { ApiError } from '../../lib/api'
import { CHECKOUT_ERROR_MESSAGES } from './checkoutConstants'
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
 * Điều kiện để ĐẶT ĐƠN MỚI TỪ GIỎ HÀNG:
 * - Khách hàng (Customer)
 * - Không đang submit, không có active attempt
 * - Có địa chỉ được chọn
 * - Quote sẵn sàng, canCheckout === true, items không rỗng
 * - SelectedProductIds nonempty (1..50)
 * - Notes <= 1000 ký tự
 */
export function canCreateNewCartOrder(params: {
  isCustomer: boolean
  isSubmitting: boolean
  activeAttempt: ActiveCartAttempt | null
  selectedAddressId: string | null
  quote: CheckoutQuoteDto | null
  quoteStatus: string
  selectedProductIds: string[]
  notes: string
}): boolean {
  const {
    isCustomer,
    isSubmitting,
    activeAttempt,
    selectedAddressId,
    quote,
    quoteStatus,
    selectedProductIds,
    notes,
  } = params

  if (!isCustomer || isSubmitting || activeAttempt !== null) return false
  if (!selectedAddressId) return false
  if (notes.length > 1000) return false
  if (selectedProductIds.length === 0 || selectedProductIds.length > 50) return false
  if (!quote || quoteStatus !== 'ready' || !quote.canCheckout || quote.items.length === 0) {
    return false
  }

  // Đảm bảo quote items khớp với các sản phẩm được chọn
  const quoteProductIds = new Set(quote.items.map((i) => i.productId.toLowerCase()))
  if (!selectedProductIds.every((id) => quoteProductIds.has(id.toLowerCase()))) {
    return false
  }

  return true
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
  if (deps.isSubmitting || !deps.user?.id) return

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
  } else if (deps.canCreate) {
    const cleanNotes = deps.notes.trim()
    const uuidGen = deps.generateUUID || (() => crypto.randomUUID())
    attemptKey = uuidGen()
    attemptPayload = {
      addressId: deps.selectedAddressId!,
      expectedCartVersion: deps.expectedCartVersion,
      paymentMethod: deps.paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
      selectedProductIds: deps.selectedProductIds,
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
