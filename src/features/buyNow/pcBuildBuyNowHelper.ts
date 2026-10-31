import { ApiError } from '../../lib/api'
import { CHECKOUT_ERROR_MESSAGES } from '../checkout/checkoutConstants'
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentActionDto,
} from '../orders/orderTypes'
import type { CheckoutOrderDto } from '../checkout/checkoutTypes'
import type { BuyNowPCBuildRequest } from './buyNowTypes'
import type { MyPCBuild } from '../pcBuilder/pcBuilderTypes'
import type { SavePendingStripeData } from '../checkout/stripeCheckoutSession'

export type AttemptStatus =
  | 'idle'
  | 'submitting'
  | 'unresolved'
  | 'stripe_storage_failed'
  | 'stripe_redirect_failed'

export interface KnownOrderState {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  paymentAction: PaymentActionDto | null
}

export interface ActiveAttempt {
  ownerId: string
  buildId: string
  idempotencyKey: string
  requestPayload: BuyNowPCBuildRequest
  status: AttemptStatus
  knownOrder: KnownOrderState | null
  unresolvedMessage: string | null
}

/**
 * Validate và chuẩn hóa snapshot attempt đã lưu từ sessionStorage.
 * Nếu storage chứa status 'submitting' (do reload/đóng tab khi request đang bay):
 * Chuẩn hóa ngay thành 'unresolved' và giữ nguyên idempotencyKey, requestPayload snapshot cùng knownOrder.
 */
export function validateAndNormalizeSavedAttempt(
  raw: unknown,
  expectedOwnerId: string,
  expectedBuildId: string
): ActiveAttempt | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Record<string, unknown>

  if (candidate.ownerId !== expectedOwnerId || candidate.buildId !== expectedBuildId) {
    return null
  }

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

  if (payload.paymentMethod !== 'COD' && payload.paymentMethod !== 'Stripe') {
    return null
  }

  const notes =
    payload.notes === null || payload.notes === undefined
      ? null
      : typeof payload.notes === 'string' && payload.notes.length <= 1000
      ? payload.notes
      : null

  const validPayload: BuyNowPCBuildRequest = {
    addressId: payload.addressId.trim(),
    paymentMethod: payload.paymentMethod,
    notes,
  }

  let status: AttemptStatus
  let unresolvedMessage: string | null =
    typeof candidate.unresolvedMessage === 'string'
      ? candidate.unresolvedMessage
      : null

  // Fix A: Nếu storage chứa submitting, chuyển sang unresolved ngay ở initializer
  if (candidate.status === 'submitting') {
    status = 'unresolved'
    unresolvedMessage =
      unresolvedMessage ||
      'Yêu cầu đặt hàng trước đó đã bị gián đoạn. Đơn hàng của bạn có thể đã được khởi tạo trên hệ thống.'
  } else if (
    candidate.status === 'unresolved' ||
    candidate.status === 'stripe_storage_failed' ||
    candidate.status === 'stripe_redirect_failed'
  ) {
    status = candidate.status
  } else {
    return null
  }

  let knownOrder: KnownOrderState | null = null
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
    buildId: expectedBuildId,
    idempotencyKey: candidate.idempotencyKey.trim(),
    requestPayload: validPayload,
    status,
    knownOrder,
    unresolvedMessage,
  }
}

/**
 * Điều kiện để ĐẶT ĐƠN MỚI:
 * Phải đủ điều kiện mua hàng: Customer, build sẵn sàng, còn hàng (canPurchaseAll),
 * địa chỉ hợp lệ, notes hợp lệ, và KHÔNG có active attempt dở dang.
 */
export function canCreateNewOrder(params: {
  isCustomer: boolean
  build: MyPCBuild | null
  selectedAddressId: string | null
  notes: string
  isSubmitting: boolean
  activeAttempt: ActiveAttempt | null
}): boolean {
  const { isCustomer, build, selectedAddressId, notes, isSubmitting, activeAttempt } = params
  if (!isCustomer || isSubmitting || activeAttempt !== null) return false
  if (!build || !build.items || build.items.length === 0 || !build.canPurchaseAll) return false
  if (!selectedAddressId) return false
  if (notes.length > 1000) return false
  return true
}

/**
 * Điều kiện để REPLAY ATTEMPT CŨ:
 * Độc lập hoàn toàn với việc build có bị 404, rỗng, hay hết hàng (canPurchaseAll false).
 * Backend replay đơn cũ trước khi kiểm tra stock/build.
 */
export function canReplayExistingAttempt(params: {
  activeAttempt: ActiveAttempt | null
  isSubmitting: boolean
}): boolean {
  const { activeAttempt, isSubmitting } = params
  if (isSubmitting || !activeAttempt) return false
  return (
    activeAttempt.status === 'unresolved' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

/**
 * Điều kiện để phục hồi đơn hàng đã biết khi lưu storage thất bại
 */
export function canRecoverKnownOrder(params: {
  activeAttempt: ActiveAttempt | null
  isSubmitting: boolean
}): boolean {
  const { activeAttempt, isSubmitting } = params
  if (isSubmitting || !activeAttempt || !activeAttempt.knownOrder) return false
  return (
    activeAttempt.status === 'stripe_storage_failed' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

/**
 * Điều kiện hiển thị link chi tiết đơn hàng /orders/{id}:
 * Áp dụng khi đã có knownOrder và trạng thái thuộc nhóm lỗi/chờ xử lý (unresolved, storage_failed, redirect_failed).
 */
export function canShowKnownOrderLink(attempt: {
  status: AttemptStatus
  knownOrder: KnownOrderState | null
} | null): boolean {
  if (!attempt || !attempt.knownOrder) return false
  return (
    attempt.status === 'unresolved' ||
    attempt.status === 'stripe_storage_failed' ||
    attempt.status === 'stripe_redirect_failed'
  )
}

/**
 * Logic quyết định có chặn điều hướng qua React Router blocker hay không.
 * Nếu đơn hàng đã hoàn tất thành công (isSuccessBypass), KHÔNG ĐƯỢC CHẶN.
 */
export function shouldBlockBuyNowNavigation(params: {
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

export interface BuyNowSubmitDeps {
  buildId: string
  ownerId: string
  user: { id: string } | null
  canCreate: boolean
  canReplay: boolean
  activeAttempt: ActiveAttempt | null
  selectedAddressId: string | null
  paymentMethod: PaymentMethod
  notes: string
  isSubmitting: boolean
  getAccessToken: (forceRefresh: boolean) => Promise<string | null>
  buyNowPCBuild: (
    buildId: string,
    req: BuyNowPCBuildRequest,
    idempotencyKey: string,
    token: string
  ) => Promise<CheckoutOrderDto>
  savePendingStripeCheckout: (pending: SavePendingStripeData) => boolean
  validateStripeRedirectUrl: (url: string) => boolean
  redirectStripe?: (url: string) => void
  onSuccessNavigate: (order: CheckoutOrderDto) => void
  setActiveAttempt: (attempt: ActiveAttempt | null) => void
  persistSavedAttempt: (attempt: ActiveAttempt | null, ownerId: string, buildId: string) => void
  setSubmitError: (msg: string | null) => void
  setIsSubmitting: (submitting: boolean) => void
  isContextCurrent: () => boolean
  onAddressNotFound?: () => void
  generateUUID?: () => string
}

/**
 * Core async submit handler cho Buy Now PC Build.
 * Đảm bảo:
 * 1. Capture knownOrder ngay trước await; cả 2 nhánh catch (ApiError và Network Error) đều giữ nguyên knownOrder đã capture.
 * 2. Đặt mới chưa có order thì knownOrder vẫn null, không invent order.
 * 3. Bỏ qua response lỗi thời nếu context đã thay đổi (isContextCurrent = false).
 * 4. Replay dùng lại key/payload snapshot cũ; tạo mới sinh key một lần.
 */
export async function executeBuyNowPCBuildSubmit(deps: BuyNowSubmitDeps): Promise<void> {
  if (deps.isSubmitting || !deps.user?.id) return

  let attemptKey: string
  let attemptPayload: BuyNowPCBuildRequest
  let capturedKnownOrder: KnownOrderState | null = null

  if (deps.canReplay && deps.activeAttempt) {
    attemptKey = deps.activeAttempt.idempotencyKey
    attemptPayload = deps.activeAttempt.requestPayload
    capturedKnownOrder = deps.activeAttempt.knownOrder ?? null

    const replayingAttempt: ActiveAttempt = {
      ...deps.activeAttempt,
      status: 'submitting',
      knownOrder: capturedKnownOrder,
    }
    deps.setActiveAttempt(replayingAttempt)
    deps.persistSavedAttempt(replayingAttempt, deps.ownerId, deps.buildId)
  } else if (deps.canCreate) {
    const cleanNotes = deps.notes.trim()
    const uuidGen = deps.generateUUID || (() => crypto.randomUUID())
    attemptKey = uuidGen()
    attemptPayload = {
      addressId: deps.selectedAddressId!,
      paymentMethod: deps.paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
    }

    const newAttempt: ActiveAttempt = {
      ownerId: deps.ownerId,
      buildId: deps.buildId,
      idempotencyKey: attemptKey,
      requestPayload: attemptPayload,
      status: 'submitting',
      knownOrder: null,
      unresolvedMessage: null,
    }
    deps.setActiveAttempt(newAttempt)
    deps.persistSavedAttempt(newAttempt, deps.ownerId, deps.buildId)
  } else {
    return
  }

  deps.setIsSubmitting(true)
  deps.setSubmitError(null)

  try {
    let token = await deps.getAccessToken(false)
    if (!deps.isContextCurrent()) return
    if (!token) throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')

    const executeBuy = async (authToken: string) => {
      return deps.buyNowPCBuild(deps.buildId, attemptPayload, attemptKey, authToken)
    }

    let order: CheckoutOrderDto
    try {
      order = await executeBuy(token)
    } catch (err: unknown) {
      if (!deps.isContextCurrent()) return
      if (err instanceof ApiError && err.status === 401) {
        token = await deps.getAccessToken(true)
        if (!deps.isContextCurrent()) return
        if (!token) throw err
        order = await executeBuy(token)
      } else {
        throw err
      }
    }

    if (!deps.isContextCurrent()) return

    const known: KnownOrderState = {
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
        const failedAttempt: ActiveAttempt = {
          ownerId: deps.ownerId,
          buildId: deps.buildId,
          idempotencyKey: attemptKey,
          requestPayload: attemptPayload,
          status: 'stripe_redirect_failed',
          knownOrder: known,
          unresolvedMessage:
            'Liên kết thanh toán Stripe từ máy chủ không hợp lệ hoặc đã hết hạn.',
        }
        deps.setActiveAttempt(failedAttempt)
        deps.persistSavedAttempt(failedAttempt, deps.ownerId, deps.buildId)
        deps.setSubmitError(
          'Liên kết thanh toán Stripe không hợp lệ hoặc đã hết hạn. Đơn hàng của bạn đã được lưu trên hệ thống, bạn có thể xem chi tiết đơn để tiếp tục.'
        )
        return
      }

      const saved = deps.savePendingStripeCheckout({
        source: 'pc-build',
        userId: deps.user.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        idempotencyKey: attemptKey,
        addressId: attemptPayload.addressId,
        buildId: deps.buildId,
      })

      if (!saved) {
        const storageFailedAttempt: ActiveAttempt = {
          ownerId: deps.ownerId,
          buildId: deps.buildId,
          idempotencyKey: attemptKey,
          requestPayload: attemptPayload,
          status: 'stripe_storage_failed',
          knownOrder: known,
          unresolvedMessage:
            'Trình duyệt đang chặn lưu trữ phiên thanh toán (sessionStorage).',
        }
        deps.setActiveAttempt(storageFailedAttempt)
        deps.persistSavedAttempt(storageFailedAttempt, deps.ownerId, deps.buildId)
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
        const redirectFailedAttempt: ActiveAttempt = {
          ownerId: deps.ownerId,
          buildId: deps.buildId,
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
        deps.persistSavedAttempt(redirectFailedAttempt, deps.ownerId, deps.buildId)
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
        err.code === 'PCBuild.NotFound' ||
        err.code === 'PCBuild.EmptyBuild' ||
        err.code === 'Checkout.AddressNotFound' ||
        err.code === 'Checkout.ProductNotFound' ||
        err.code === 'Checkout.PaymentMethodNotAvailable' ||
        err.code === 'Checkout.InsufficientStock' ||
        err.code === 'Checkout.ProductInactive' ||
        err.code === 'Checkout.InvalidPrice' ||
        err.status === 400 ||
        err.status === 403 ||
        err.status === 404

      if (isDefinitivePreMutation) {
        deps.setActiveAttempt(null)
        deps.persistSavedAttempt(null, deps.ownerId, deps.buildId)

        let msg = 'Không thể đặt mua cấu hình PC lúc này.'
        if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
          msg = CHECKOUT_ERROR_MESSAGES[err.code]
        } else if (err.code === 'PCBuild.NotFound') {
          msg = 'Không tìm thấy cấu hình này trên máy chủ.'
        } else if (err.code === 'PCBuild.EmptyBuild') {
          msg = 'Cấu hình PC không có linh kiện nào để đặt mua.'
        } else if (err.description) {
          msg = err.description
        } else if (err.message) {
          msg = err.message
        }
        deps.setSubmitError(msg)

        if (err.code === 'Checkout.AddressNotFound' && deps.onAddressNotFound) {
          deps.onAddressNotFound()
        }
        return
      }

      const unresolvedMsg =
        (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) ||
        err.description ||
        err.message ||
        'Chưa thể xác nhận kết quả từ máy chủ do lỗi kết nối hoặc phản hồi chậm.'

      const unresolvedAttempt: ActiveAttempt = {
        ownerId: deps.ownerId,
        buildId: deps.buildId,
        idempotencyKey: attemptKey,
        requestPayload: attemptPayload,
        status: 'unresolved',
        knownOrder: capturedKnownOrder,
        unresolvedMessage: unresolvedMsg,
      }
      deps.setActiveAttempt(unresolvedAttempt)
      deps.persistSavedAttempt(unresolvedAttempt, deps.ownerId, deps.buildId)
      deps.setSubmitError(unresolvedMsg)
    } else {
      const networkMsg =
        err instanceof Error
          ? err.message
          : 'Mất kết nối với máy chủ. Vui lòng kiểm tra lại kết nối mạng.'

      const unresolvedAttempt: ActiveAttempt = {
        ownerId: deps.ownerId,
        buildId: deps.buildId,
        idempotencyKey: attemptKey,
        requestPayload: attemptPayload,
        status: 'unresolved',
        knownOrder: capturedKnownOrder,
        unresolvedMessage: networkMsg,
      }
      deps.setActiveAttempt(unresolvedAttempt)
      deps.persistSavedAttempt(unresolvedAttempt, deps.ownerId, deps.buildId)
      deps.setSubmitError(networkMsg)
    }
  } finally {
    if (deps.isContextCurrent()) {
      deps.setIsSubmitting(false)
    }
  }
}
