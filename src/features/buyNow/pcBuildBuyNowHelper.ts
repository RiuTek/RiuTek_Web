import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaymentActionDto,
} from '../orders/orderTypes'
import type { BuyNowPCBuildRequest } from './buyNowTypes'
import type { MyPCBuild } from '../pcBuilder/pcBuilderTypes'

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
 * Chuẩn hóa ngay thành 'unresolved' và giữ nguyên idempotencyKey cùng payload snapshot ban đầu.
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
 * Điều kiện tạo đơn hàng mới từ trang mua ngay:
 * Yêu cầu đầy đủ quyền, build hợp lệ, còn hàng, có địa chỉ, và không có attempt đang hoạt động.
 */
export function canCreateNewOrder({
  isCustomer,
  build,
  selectedAddressId,
  notes,
  isSubmitting,
  activeAttempt,
}: {
  isCustomer: boolean
  build: MyPCBuild | null
  selectedAddressId: string | null
  notes: string
  isSubmitting: boolean
  activeAttempt: ActiveAttempt | null
}): boolean {
  if (!isCustomer) return false
  if (isSubmitting) return false
  if (activeAttempt !== null && activeAttempt.status !== 'idle') return false
  if (!build) return false
  if (build.items.length === 0) return false
  if (!build.canPurchaseAll) return false
  if (!selectedAddressId) return false
  if (notes.trim().length > 1000) return false
  return true
}

/**
 * Điều kiện thử lại / replay attempt đã có:
 * Chỉ phụ thuộc vào trạng thái attempt (unresolved / stripe_redirect_failed) và không đang submit.
 * KHÔNG phụ thuộc vào build hiện tại còn hàng hay không, hay địa chỉ còn trong sổ hay không.
 */
export function canReplayExistingAttempt({
  activeAttempt,
  isSubmitting,
}: {
  activeAttempt: ActiveAttempt | null
  isSubmitting: boolean
}): boolean {
  if (isSubmitting) return false
  if (!activeAttempt) return false
  return (
    activeAttempt.status === 'unresolved' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

/**
 * Điều kiện phục hồi đơn hàng đã có (knownOrder) khi gặp lỗi lưu storage hoặc lỗi redirect.
 */
export function canRecoverKnownOrder({
  activeAttempt,
  isSubmitting,
}: {
  activeAttempt: ActiveAttempt | null
  isSubmitting: boolean
}): boolean {
  if (isSubmitting) return false
  if (!activeAttempt || !activeAttempt.knownOrder) return false
  return (
    activeAttempt.status === 'stripe_storage_failed' ||
    activeAttempt.status === 'stripe_redirect_failed'
  )
}

/**
 * Kiểm tra xem có cần chặn điều hướng nội bộ hay không:
 * Nếu có one-shot success bypass (do đơn hàng vừa thành công) thì cho qua ngay.
 */
export function shouldBlockBuyNowNavigation({
  isAttemptActive,
  isSuccessBypass,
  currentPath,
  nextPath,
}: {
  isAttemptActive: boolean
  isSuccessBypass: boolean
  currentPath: string
  nextPath: string
}): boolean {
  if (isSuccessBypass) return false
  if (!isAttemptActive) return false
  return currentPath !== nextPath
}
