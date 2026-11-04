import { ApiError, type PagedResult } from '../../lib/api'
import type { AuthStatus, UserRole } from '../auth/authTypes'
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orders/orderConstants'
import type {
  GetManagedOrdersParams,
  ManagedOrderSummaryDto,
  OrderDetailDto,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UpdateManagedOrderStatusRequest,
} from '../orders/orderTypes'
import {
  getManagedOrderById as defaultGetManagedOrderById,
  getManagedOrders as defaultGetManagedOrders,
  isValidUuid,
  updateManagedOrderStatus as defaultUpdateManagedOrderStatus,
} from './adminApi'
import { ADMIN_ERROR_MESSAGES, mapAdminApiError } from './adminConstants'
import { executeWithAdminAuth } from './adminGuardHelper'

export const ADMIN_ORDERS_PAGE_SIZE = 20
export const MAX_ORDER_SEARCH_LENGTH = 150

export const VALID_ORDER_STATUSES: readonly OrderStatus[] = [
  'PendingPayment',
  'Confirmed',
  'Processing',
  'Shipping',
  'Completed',
  'Cancelled',
  'Refunded',
] as const

export const VALID_PAYMENT_METHODS: readonly PaymentMethod[] = [
  'COD',
  'Stripe',
  'VNPay',
] as const

export const VALID_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'Pending',
  'Completed',
  'Failed',
  'Refunded',
] as const

const ORDER_STATUS_SET = new Set<string>(VALID_ORDER_STATUSES)
const PAYMENT_METHOD_SET = new Set<string>(VALID_PAYMENT_METHODS)
const PAYMENT_STATUS_SET = new Set<string>(VALID_PAYMENT_STATUSES)

export type ManagedFulfillmentTargetStatus =
  | 'Processing'
  | 'Shipping'
  | 'Completed'
  | 'Cancelled'

export const PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE =
  'Đơn đã thanh toán trực tuyến cần quy trình hoàn tiền; màn hình này chưa hỗ trợ.'

export const STRIPE_PENDING_ADMIN_NOTICE =
  'Chờ khách hoàn tất thanh toán. Nhấn "Tải lại dữ liệu" để cập nhật trạng thái mới nhất từ hệ thống.'

export const COD_COMPLETE_CONFIRM_MESSAGE =
  'Xác nhận đã giao hàng và thu tiền COD. Thao tác này hoàn tất đơn và ghi nhận đã thanh toán.'

export function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUS_SET.has(value)
}

export function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && PAYMENT_METHOD_SET.has(value)
}

export function isValidPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUS_SET.has(value)
}

/**
 * Parse số nguyên dương an toàn (strict positive safe integer >= 1).
 * Từ chối chuỗi lẫn chữ ('1abc'), số âm, số 0, số thập phân.
 */
export function parseStrictPositiveSafeInt(
  raw: string | number | null | undefined,
  fallback = 1
): number {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 1 ? raw : fallback
  }
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (!/^[1-9]\d*$/.test(trimmed)) return fallback
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : fallback
}

export interface NormalizedManagedOrdersQuery {
  pageIndex: number
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  search: string
}

/**
 * Chuẩn hóa query params từ URLSearchParams cho trang danh sách đơn hàng quản trị:
 * - page: strict positive safe integer (mặc định 1)
 * - status / paymentMethod / paymentStatus: chỉ nhận giá trị trong allowlist (bỏ qua 'all', 'undefined' hoặc giá trị lạ)
 * - search: trim và giới hạn tối đa 150 ký tự
 */
export function normalizeManagedOrdersQuery(
  input:
    | URLSearchParams
    | string
    | Record<string, string | number | null | undefined>
): NormalizedManagedOrdersQuery {
  const params =
    input instanceof URLSearchParams
      ? input
      : typeof input === 'string'
        ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
        : new URLSearchParams(
            Object.entries(input).reduce<Record<string, string>>(
              (acc, [k, v]) => {
                if (v !== undefined && v !== null) {
                  acc[k] = String(v)
                }
                return acc
              },
              {}
            )
          )

  const pageIndex = parseStrictPositiveSafeInt(params.get('page'), 1)
  const rawStatus = params.get('status')?.trim()
  const rawPaymentMethod = params.get('paymentMethod')?.trim()
  const rawPaymentStatus = params.get('paymentStatus')?.trim()
  const rawSearch = (params.get('search') ?? '').trim().slice(0, MAX_ORDER_SEARCH_LENGTH)

  return {
    pageIndex,
    status: isValidOrderStatus(rawStatus) ? rawStatus : undefined,
    paymentMethod: isValidPaymentMethod(rawPaymentMethod)
      ? rawPaymentMethod
      : undefined,
    paymentStatus: isValidPaymentStatus(rawPaymentStatus)
      ? rawPaymentStatus
      : undefined,
    search: rawSearch,
  }
}

/**
 * Tạo URLSearchParams sạch từ bộ lọc đơn hàng quản trị.
 * Bỏ các tham số rỗng hoặc mặc định ('all', page = 1).
 */
export function buildManagedOrdersSearchParams(
  query: Partial<NormalizedManagedOrdersQuery>
): URLSearchParams {
  const next = new URLSearchParams()
  const cleanSearch = (query.search ?? '').trim().slice(0, MAX_ORDER_SEARCH_LENGTH)
  if (cleanSearch) {
    next.set('search', cleanSearch)
  }
  if (query.status && isValidOrderStatus(query.status)) {
    next.set('status', query.status)
  }
  if (query.paymentMethod && isValidPaymentMethod(query.paymentMethod)) {
    next.set('paymentMethod', query.paymentMethod)
  }
  if (query.paymentStatus && isValidPaymentStatus(query.paymentStatus)) {
    next.set('paymentStatus', query.paymentStatus)
  }
  const pageIndex = parseStrictPositiveSafeInt(query.pageIndex, 1)
  if (pageIndex > 1) {
    next.set('page', String(pageIndex))
  }
  return next
}

/**
 * Áp dụng thay đổi bộ lọc hoặc từ khóa tìm kiếm và tự động reset về trang 1.
 */
export function applyManagedOrdersFilterChange(
  current: NormalizedManagedOrdersQuery,
  patch: Partial<Omit<NormalizedManagedOrdersQuery, 'pageIndex'>>
): NormalizedManagedOrdersQuery {
  const nextStatus = 'status' in patch ? patch.status : current.status
  const nextPaymentMethod =
    'paymentMethod' in patch ? patch.paymentMethod : current.paymentMethod
  const nextPaymentStatus =
    'paymentStatus' in patch ? patch.paymentStatus : current.paymentStatus
  const nextSearch =
    'search' in patch
      ? (patch.search ?? '').trim().slice(0, MAX_ORDER_SEARCH_LENGTH)
      : current.search

  return {
    pageIndex: 1,
    status: isValidOrderStatus(nextStatus) ? nextStatus : undefined,
    paymentMethod: isValidPaymentMethod(nextPaymentMethod)
      ? nextPaymentMethod
      : undefined,
    paymentStatus: isValidPaymentStatus(nextPaymentStatus)
      ? nextPaymentStatus
      : undefined,
    search: nextSearch,
  }
}

/**
 * Tạo đường dẫn quay lại danh sách đơn hàng có giữ nguyên bộ lọc/phân trang đã sanitize.
 */
export function resolveBackToOrdersHref(
  fromSearch: string | null | undefined
): string {
  if (!fromSearch || typeof fromSearch !== 'string') {
    return '/admin/orders'
  }
  const normalized = normalizeManagedOrdersQuery(fromSearch)
  const cleanParams = buildManagedOrdersSearchParams(normalized).toString()
  return cleanParams ? `/admin/orders?${cleanParams}` : '/admin/orders'
}

/**
 * Định dạng tiền tệ theo đúng currency của đơn hàng.
 * Không ép VND vào dữ liệu ngoại tệ (USD, EUR, ...).
 */
export function formatOrderCurrency(
  amount: number,
  currency: string | null | undefined
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const rawCurrency = (currency ?? '').trim().toUpperCase() || 'VND'

  if (rawCurrency === 'VND') {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(safeAmount)
  }

  if (/^[A-Z]{3}$/.test(rawCurrency)) {
    try {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: rawCurrency,
      }).format(safeAmount)
    } catch {
      // Fallback bên dưới nếu mã tiền tệ lạ không nằm trong chuẩn ISO 4217 của runtime
    }
  }

  return `${new Intl.NumberFormat('vi-VN').format(safeAmount)} ${rawCurrency}`
}

export function formatOrderDateTime(
  dateStr: string | null | undefined
): string {
  if (!dateStr || typeof dateStr !== 'string') return '—'
  try {
    const parsed = new Date(dateStr)
    if (Number.isNaN(parsed.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed)
  } catch {
    return dateStr
  }
}

export function getSafeOrderStatusLabel(status: string): string {
  if (isValidOrderStatus(status)) {
    return ORDER_STATUS_LABELS[status]
  }
  return status || 'Không xác định'
}

export function getSafePaymentMethodLabel(method: string): string {
  if (isValidPaymentMethod(method)) {
    return PAYMENT_METHOD_LABELS[method]
  }
  return method || 'Không xác định'
}

export function getSafePaymentStatusLabel(status: string): string {
  if (isValidPaymentStatus(status)) {
    return PAYMENT_STATUS_LABELS[status]
  }
  return status || 'Không xác định'
}

/**
 * Ghi chú ngữ cảnh cho trạng thái thanh toán:
 * - COD chưa Completed và paymentStatus Pending -> "Chưa thu tiền"
 * - Stripe đang PendingPayment + Pending -> "Chờ khách hoàn tất thanh toán"
 */
export function getContextualPaymentStatusHint(order: {
  status: string
  paymentMethod: string
  paymentStatus: string
}): string | null {
  if (
    order.paymentMethod === 'COD' &&
    order.paymentStatus === 'Pending' &&
    (order.status === 'Confirmed' ||
      order.status === 'Processing' ||
      order.status === 'Shipping')
  ) {
    return 'Chưa thu tiền'
  }

  if (
    order.paymentMethod === 'Stripe' &&
    order.status === 'PendingPayment' &&
    order.paymentStatus === 'Pending'
  ) {
    return 'Chờ khách hoàn tất thanh toán'
  }

  return null
}

export interface ManagedOrderActionOption {
  targetStatus: ManagedFulfillmentTargetStatus
  buttonLabel: string
  variant: 'primary' | 'success' | 'danger'
  confirmTitle: string
  confirmDescription: string
  confirmConsequenceNote: string
  confirmSubmitLabel: string
}

export interface ManagedOrderActionResolution {
  isKnownEnums: boolean
  isReadOnly: boolean
  canMutate: boolean
  actions: ManagedOrderActionOption[]
  statusGuidance: string
  paidOnlineCancelNotice: string | null
  stripePendingNotice: string | null
  codPendingNotice: string | null
}

/**
 * Ma trận hành động quản trị đơn hàng khớp 100% với Order.ChangeFulfillmentStatus và UpdateOrderStatusCommandValidator ở Backend:
 * - PendingPayment: Không có action quản trị (chờ thanh toán/webhook/expiration)
 * - Confirmed: Processing ("Bắt đầu xử lý"); Cancelled ("Hủy đơn") nếu KHÔNG phải online đã Paid (paymentMethod != 'COD' && paymentStatus == 'Completed')
 * - Processing: Shipping ("Chuyển sang giao hàng"); Cancelled ("Hủy đơn") với cùng điều kiện hủy như Confirmed
 * - Shipping: Completed ("Xác nhận giao thành công")
 * - Completed / Cancelled / Refunded: Chỉ đọc, không có action
 * - Enum không nhận diện được: Chỉ đọc an toàn, không crash, không tự đoán action
 */
export function resolveManagedOrderActions(order: {
  status: string
  paymentMethod: string
  paymentStatus: string
}): ManagedOrderActionResolution {
  if (
    !isValidOrderStatus(order.status) ||
    !isValidPaymentMethod(order.paymentMethod) ||
    !isValidPaymentStatus(order.paymentStatus)
  ) {
    return {
      isKnownEnums: false,
      isReadOnly: true,
      canMutate: false,
      actions: [],
      statusGuidance:
        'Đơn hàng có giá trị trạng thái hoặc phương thức chưa nhận diện được. Hệ thống hiển thị ở chế độ chỉ đọc để đảm bảo an toàn.',
      paidOnlineCancelNotice: null,
      stripePendingNotice: null,
      codPendingNotice: null,
    }
  }

  const isPaidOnlineOrder =
    order.paymentMethod !== 'COD' && order.paymentStatus === 'Completed'
  const isCodPending =
    order.paymentMethod === 'COD' && order.paymentStatus === 'Pending'

  switch (order.status) {
    case 'PendingPayment': {
      const isStripePending =
        order.paymentMethod === 'Stripe' && order.paymentStatus === 'Pending'
      return {
        isKnownEnums: true,
        isReadOnly: true,
        canMutate: false,
        actions: [],
        statusGuidance: isStripePending
          ? 'Chờ khách hoàn tất thanh toán trực tuyến qua Stripe. Nhấn "Tải lại dữ liệu" để kiểm tra sau khi khách thanh toán xong.'
          : 'Đơn hàng đang ở trạng thái chờ thanh toán, chờ webhook xác nhận hoặc tự động hết hạn. Không có thao tác xử lý giao hàng ở bước này.',
        paidOnlineCancelNotice: null,
        stripePendingNotice: isStripePending
          ? STRIPE_PENDING_ADMIN_NOTICE
          : null,
        codPendingNotice: null,
      }
    }

    case 'Confirmed': {
      const actions: ManagedOrderActionOption[] = [
        {
          targetStatus: 'Processing',
          buttonLabel: 'Bắt đầu xử lý',
          variant: 'primary',
          confirmTitle: 'Xác nhận bắt đầu xử lý đơn hàng',
          confirmDescription:
            'Chuyển trạng thái đơn hàng từ "Đã xác nhận" sang "Đang xử lý" để chuẩn bị đóng gói linh kiện.',
          confirmConsequenceNote: isCodPending
            ? 'Đơn COD vẫn ở trạng thái "Chưa thu tiền" cho đến khi xác nhận giao hàng thành công.'
            : 'Trạng thái thanh toán hiện tại của đơn hàng được giữ nguyên.',
          confirmSubmitLabel: 'Bắt đầu xử lý',
        },
      ]

      if (!isPaidOnlineOrder) {
        actions.push({
          targetStatus: 'Cancelled',
          buttonLabel: 'Hủy đơn',
          variant: 'danger',
          confirmTitle: 'Xác nhận hủy đơn hàng',
          confirmDescription:
            'Chuyển trạng thái đơn hàng từ "Đã xác nhận" sang "Đã hủy". Thao tác này không thể hoàn tác.',
          confirmConsequenceNote:
            'Hệ thống Backend sẽ tự động hoàn lại số lượng tồn kho cho các sản phẩm trong đơn hàng.',
          confirmSubmitLabel: 'Xác nhận hủy đơn',
        })
      }

      return {
        isKnownEnums: true,
        isReadOnly: false,
        canMutate: true,
        actions,
        statusGuidance:
          'Đơn hàng đã xác nhận và sẵn sàng để bộ phận kho/vận hành bắt đầu xử lý đóng gói.',
        paidOnlineCancelNotice: isPaidOnlineOrder
          ? PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
          : null,
        stripePendingNotice: null,
        codPendingNotice: isCodPending
          ? 'Đơn COD chưa thu tiền — sẽ thu hộ và ghi nhận đã thanh toán khi giao thành công.'
          : null,
      }
    }

    case 'Processing': {
      const actions: ManagedOrderActionOption[] = [
        {
          targetStatus: 'Shipping',
          buttonLabel: 'Chuyển sang giao hàng',
          variant: 'primary',
          confirmTitle: 'Xác nhận chuyển sang giao hàng',
          confirmDescription:
            'Chuyển trạng thái đơn hàng từ "Đang xử lý" sang "Đang giao hàng".',
          confirmConsequenceNote:
            'Sau khi chuyển sang "Đang giao hàng", đơn hàng không thể hủy hoặc quay lại bước "Đang xử lý".',
          confirmSubmitLabel: 'Chuyển sang giao hàng',
        },
      ]

      if (!isPaidOnlineOrder) {
        actions.push({
          targetStatus: 'Cancelled',
          buttonLabel: 'Hủy đơn',
          variant: 'danger',
          confirmTitle: 'Xác nhận hủy đơn hàng đang xử lý',
          confirmDescription:
            'Chuyển trạng thái đơn hàng từ "Đang xử lý" sang "Đã hủy". Thao tác này không thể hoàn tác.',
          confirmConsequenceNote:
            'Hệ thống Backend sẽ tự động hoàn lại số lượng tồn kho cho các sản phẩm trong đơn hàng.',
          confirmSubmitLabel: 'Xác nhận hủy đơn',
        })
      }

      return {
        isKnownEnums: true,
        isReadOnly: false,
        canMutate: true,
        actions,
        statusGuidance:
          'Đơn hàng đang được đóng gói/chuẩn bị tại kho. Khi bàn giao cho vận chuyển, hãy nhấn "Chuyển sang giao hàng".',
        paidOnlineCancelNotice: isPaidOnlineOrder
          ? PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
          : null,
        stripePendingNotice: null,
        codPendingNotice: isCodPending
          ? 'Đơn COD chưa thu tiền — sẽ thu hộ và ghi nhận đã thanh toán khi giao thành công.'
          : null,
      }
    }

    case 'Shipping': {
      const isCod = order.paymentMethod === 'COD'
      const actions: ManagedOrderActionOption[] = [
        {
          targetStatus: 'Completed',
          buttonLabel: 'Xác nhận giao thành công',
          variant: 'success',
          confirmTitle: isCod
            ? 'Xác nhận giao thành công & thu tiền COD'
            : 'Xác nhận giao hàng thành công',
          confirmDescription: isCod
            ? COD_COMPLETE_CONFIRM_MESSAGE
            : 'Xác nhận đơn hàng đã được giao thành công đến khách hàng. Thao tác này hoàn tất đơn hàng.',
          confirmConsequenceNote: isCod
            ? 'Hệ thống sẽ chuyển trạng thái đơn sang "Hoàn tất" và tự động cập nhật trạng thái thanh toán COD thành "Đã thanh toán".'
            : 'Hệ thống sẽ chuyển trạng thái đơn hàng sang "Hoàn tất".',
          confirmSubmitLabel: 'Xác nhận giao thành công',
        },
      ]

      return {
        isKnownEnums: true,
        isReadOnly: false,
        canMutate: true,
        actions,
        statusGuidance:
          'Đơn hàng đang trên đường giao tới khách hàng. Không thể hủy hoặc quay lại bước xử lý khi đơn đang giao.',
        paidOnlineCancelNotice: null,
        stripePendingNotice: null,
        codPendingNotice: isCodPending
          ? 'Đơn COD đang giao và chưa thu tiền. Khi xác nhận giao thành công, hệ thống sẽ ghi nhận đã thanh toán.'
          : null,
      }
    }

    case 'Completed':
      return {
        isKnownEnums: true,
        isReadOnly: true,
        canMutate: false,
        actions: [],
        statusGuidance:
          'Đơn hàng đã giao thành công và hoàn tất. Dữ liệu ở chế độ chỉ đọc.',
        paidOnlineCancelNotice: null,
        stripePendingNotice: null,
        codPendingNotice: null,
      }

    case 'Cancelled':
      return {
        isKnownEnums: true,
        isReadOnly: true,
        canMutate: false,
        actions: [],
        statusGuidance:
          'Đơn hàng đã hủy. Dữ liệu ở chế độ chỉ đọc và không thể khôi phục.',
        paidOnlineCancelNotice: null,
        stripePendingNotice: null,
        codPendingNotice: null,
      }

    case 'Refunded':
      return {
        isKnownEnums: true,
        isReadOnly: true,
        canMutate: false,
        actions: [],
        statusGuidance:
          'Đơn hàng đã hoàn tiền. Dữ liệu ở chế độ chỉ đọc.',
        paidOnlineCancelNotice: null,
        stripePendingNotice: null,
        codPendingNotice: null,
      }
  }
}

export interface ManagedOrderConfirmSnapshot {
  orderId: string
  orderNumber: string
  ownerId: string
  expectedStatus: OrderStatus
  newStatus: ManagedFulfillmentTargetStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  buttonLabel: string
  confirmTitle: string
  confirmDescription: string
  confirmConsequenceNote: string
  confirmSubmitLabel: string
}

/**
 * Tạo snapshot xác nhận thao tác chuyển trạng thái từ bản đơn hàng đang xem.
 * Trả về null nếu targetStatus không hợp lệ theo ma trận của đơn hàng hiện tại.
 */
export function createOrderStatusConfirmSnapshot(params: {
  order: OrderDetailDto | null
  ownerId: string | null
  targetStatus: ManagedFulfillmentTargetStatus
}): ManagedOrderConfirmSnapshot | null {
  const { order, ownerId, targetStatus } = params
  if (!order || !ownerId || !ownerId.trim()) return null

  const resolution = resolveManagedOrderActions(order)
  if (!resolution.canMutate) return null

  const matchedAction = resolution.actions.find(
    (a) => a.targetStatus === targetStatus
  )
  if (!matchedAction) return null

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    ownerId: ownerId.trim(),
    expectedStatus: order.status,
    newStatus: matchedAction.targetStatus,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    buttonLabel: matchedAction.buttonLabel,
    confirmTitle: matchedAction.confirmTitle,
    confirmDescription: matchedAction.confirmDescription,
    confirmConsequenceNote: matchedAction.confirmConsequenceNote,
    confirmSubmitLabel: matchedAction.confirmSubmitLabel,
  }
}

/**
 * Kiểm tra snapshot xác nhận còn khớp với context và bản đơn hàng hiện tại hay không.
 */
export function isConfirmSnapshotStillValid(params: {
  snapshot: ManagedOrderConfirmSnapshot | null
  currentOrder: OrderDetailDto | null
  currentOwnerId: string | null
  currentOrderId: string | null
}): boolean {
  const { snapshot, currentOrder, currentOwnerId, currentOrderId } = params
  if (!snapshot || !currentOrder || !currentOwnerId || !currentOrderId) {
    return false
  }
  if (snapshot.ownerId !== currentOwnerId.trim()) return false
  if (snapshot.orderId !== currentOrderId.trim()) return false
  if (currentOrder.id !== snapshot.orderId) return false
  if (currentOrder.status !== snapshot.expectedStatus) return false

  const resolution = resolveManagedOrderActions(currentOrder)
  return resolution.actions.some((a) => a.targetStatus === snapshot.newStatus)
}

export interface AdminOrderAuthContext {
  authStatus: AuthStatus | string
  user: { id: string; role: UserRole | string } | null
  getAccessToken: (forceRefresh: boolean) => Promise<string | null>
}

export interface ManagedOrderListState {
  data: PagedResult<ManagedOrderSummaryDto> | null
  isLoading: boolean
  error: string | null
  errorCode: string | null
  isForbidden: boolean
  loadedQueryKey: string | null
}

export interface ManagedOrderListCoordinatorDeps {
  getAuthContext: () => AdminOrderAuthContext
  fetchOrders?: typeof defaultGetManagedOrders
  onStateChange?: (state: ManagedOrderListState) => void
}

/**
 * Bộ điều phối danh sách đơn hàng quản trị (/admin/orders) dùng chung cho UI và runtime tests:
 * - Gắn request key với ownerId + bộ lọc + trang + generation
 * - Hủy (abort) request cũ khi đổi filter/page/user/unmount, chống response trả ngược thứ tự ghi đè dữ liệu mới
 * - Không bao giờ biến lỗi auth/403/500/mạng thành trạng thái "chưa có đơn hàng"
 * - Xóa dữ liệu đơn hàng cũ ngay khi đổi tài khoản hoặc mất trạng thái authenticated
 */
export function createManagedOrderListCoordinator(
  deps: ManagedOrderListCoordinatorDeps
) {
  const fetchOrders = deps.fetchOrders ?? defaultGetManagedOrders
  let mounted = true
  let generation = 0
  let activeAbortController: AbortController | null = null
  let activeOwnerId: string | null =
    deps.getAuthContext().user?.id?.trim() || null

  let state: ManagedOrderListState = {
    data: null,
    isLoading: false,
    error: null,
    errorCode: null,
    isForbidden: false,
    loadedQueryKey: null,
  }

  const emit = (patch: Partial<ManagedOrderListState>) => {
    state = { ...state, ...patch }
    deps.onStateChange?.(state)
  }

  const syncAuthOwner = () => {
    const auth = deps.getAuthContext()
    const nextOwner =
      auth.authStatus === 'authenticated' && auth.user?.id?.trim()
        ? auth.user.id.trim()
        : null

    if (nextOwner !== activeOwnerId) {
      activeOwnerId = nextOwner
      generation += 1
      activeAbortController?.abort()
      activeAbortController = null
      emit({
        data: null,
        isLoading: false,
        error: null,
        errorCode: null,
        isForbidden: false,
        loadedQueryKey: null,
      })
    }
  }

  const loadOrders = async (
    rawQuery: NormalizedManagedOrdersQuery
  ): Promise<PagedResult<ManagedOrderSummaryDto> | null> => {
    syncAuthOwner()
    const auth = deps.getAuthContext()
    const ownerId =
      auth.authStatus === 'authenticated' && auth.user?.id?.trim()
        ? auth.user.id.trim()
        : null

    if (!mounted || !ownerId) {
      emit({
        data: null,
        isLoading: false,
        error: null,
        errorCode: null,
        isForbidden: false,
        loadedQueryKey: null,
      })
      return null
    }

    generation += 1
    const myGen = generation
    activeAbortController?.abort()
    const controller = new AbortController()
    activeAbortController = controller

    const queryKey = `${ownerId}::p=${rawQuery.pageIndex}::s=${
      rawQuery.status ?? ''
    }::pm=${rawQuery.paymentMethod ?? ''}::ps=${
      rawQuery.paymentStatus ?? ''
    }::q=${rawQuery.search}`

    const isTicketCurrent = () => {
      if (!mounted) return false
      if (generation !== myGen) return false
      const nowAuth = deps.getAuthContext()
      const nowOwner =
        nowAuth.authStatus === 'authenticated' && nowAuth.user?.id?.trim()
          ? nowAuth.user.id.trim()
          : null
      return nowOwner === ownerId
    }

    emit({
      isLoading: true,
      error: null,
      errorCode: null,
      isForbidden: false,
    })

    const requestParams: GetManagedOrdersParams = {
      pageIndex: rawQuery.pageIndex,
      pageSize: ADMIN_ORDERS_PAGE_SIZE,
      status: rawQuery.status,
      paymentMethod: rawQuery.paymentMethod,
      paymentStatus: rawQuery.paymentStatus,
      search: rawQuery.search || undefined,
    }

    try {
      const result = await executeWithAdminAuth({
        authStatus: auth.authStatus,
        user: auth.user,
        getAccessToken: auth.getAccessToken,
        isContextCurrent: isTicketCurrent,
        operation: (token) =>
          fetchOrders(requestParams, token, controller.signal),
      })

      if (!isTicketCurrent()) return null

      emit({
        data: result,
        isLoading: false,
        error: null,
        errorCode: null,
        isForbidden: false,
        loadedQueryKey: queryKey,
      })
      return result
    } catch (err: unknown) {
      if (!isTicketCurrent()) return null
      if (err instanceof Error && err.name === 'AbortError') return null
      if (err instanceof ApiError && err.isAbortError) return null

      const code = err instanceof ApiError ? (err.code ?? null) : null
      const status = err instanceof ApiError ? err.status : 0
      const isForbidden =
        status === 403 ||
        code === 'OrderManagement.Forbidden' ||
        code === 'Checkout.AccountInactive' ||
        code === 'Auth.Forbidden'

      emit({
        data: null,
        isLoading: false,
        error: mapAdminApiError(
          err,
          'Không thể tải danh sách đơn hàng quản trị. Vui lòng kiểm tra kết nối mạng và thử lại.'
        ),
        errorCode: code,
        isForbidden,
        loadedQueryKey: queryKey,
      })
      return null
    }
  }

  const dispose = () => {
    mounted = false
    generation += 1
    activeAbortController?.abort()
    activeAbortController = null
  }

  return {
    getState: () => state,
    syncAuthOwner,
    loadOrders,
    dispose,
  }
}

export interface ManagedOrderDetailState {
  orderId: string | null
  order: OrderDetailDto | null
  isLoading: boolean
  loadError: string | null
  loadErrorCode: string | null
  isNotFound: boolean
  isUserNotFound: boolean
  isForbidden: boolean
  isStale: boolean
  isOutcomeAmbiguous: boolean
  isSubmitting: boolean
  confirmSnapshot: ManagedOrderConfirmSnapshot | null
  mutationError: string | null
  mutationErrorCode: string | null
  mutationSuccessMessage: string | null
}

export interface ManagedOrderDetailCoordinatorDeps {
  getContext: () => AdminOrderAuthContext & { orderId: string | null }
  fetchOrderById?: typeof defaultGetManagedOrderById
  patchOrderStatus?: typeof defaultUpdateManagedOrderStatus
  onStateChange?: (state: ManagedOrderDetailState) => void
}

/**
 * Bộ điều phối chi tiết & xử lý giao nhận đơn hàng (/admin/orders/:orderId) dùng chung cho UI và runtime tests:
 * - Chống race condition khi chuyển đơn A -> B -> A, đổi user, logout hoặc unmount
 * - Khóa đồng bộ (synchronous single-flight lock) chống double-click trước khi React kịp rerender
 * - Vô hiệu hóa mọi GET đang bay khi bắt đầu PATCH để GET cũ không bao giờ ghi đè kết quả PATCH mới
 * - Khi 409 Conflict: đóng confirm cũ, báo lỗi tiếng Việt rõ ràng, đánh dấu stale + khóa action, tự động GET lại đơn hàng;
 *   nếu GET lỗi thì tiếp tục khóa action cho đến khi GET thành công. Tuyệt đối không tự gửi PATCH lần 2.
 * - Khi lỗi mạng/timeout/5xx sau PATCH: kết quả trên BE chưa xác định -> không tự retry PATCH, khóa action và yêu cầu
 *   "Kiểm tra lại đơn hàng" (GET) thành công trước khi mở lại thao tác.
 */
export function createManagedOrderDetailCoordinator(
  deps: ManagedOrderDetailCoordinatorDeps
) {
  const fetchOrderById = deps.fetchOrderById ?? defaultGetManagedOrderById
  const patchOrderStatus =
    deps.patchOrderStatus ?? defaultUpdateManagedOrderStatus

  let mounted = true
  let readGeneration = 0
  let contextGeneration = 0
  let activeReadAbort: AbortController | null = null
  let activeMutationAbort: AbortController | null = null
  let inFlightMutation = false

  const initialCtx = deps.getContext()
  let trackedOwnerId: string | null =
    initialCtx.authStatus === 'authenticated' && initialCtx.user?.id?.trim()
      ? initialCtx.user.id.trim()
      : null
  let trackedOrderId: string | null = initialCtx.orderId?.trim() || null

  let state: ManagedOrderDetailState = {
    orderId: trackedOrderId,
    order: null,
    isLoading: false,
    loadError: null,
    loadErrorCode: null,
    isNotFound: false,
    isUserNotFound: false,
    isForbidden: false,
    isStale: false,
    isOutcomeAmbiguous: false,
    isSubmitting: false,
    confirmSnapshot: null,
    mutationError: null,
    mutationErrorCode: null,
    mutationSuccessMessage: null,
  }

  const emit = (patch: Partial<ManagedOrderDetailState>) => {
    state = { ...state, ...patch }
    deps.onStateChange?.(state)
  }

  const syncContext = (): {
    ownerId: string | null
    orderId: string | null
    isAuthenticated: boolean
  } => {
    const ctx = deps.getContext()
    const nextOwner =
      ctx.authStatus === 'authenticated' && ctx.user?.id?.trim()
        ? ctx.user.id.trim()
        : null
    const nextOrder = ctx.orderId?.trim() || null

    if (nextOwner !== trackedOwnerId || nextOrder !== trackedOrderId) {
      trackedOwnerId = nextOwner
      trackedOrderId = nextOrder
      contextGeneration += 1
      readGeneration += 1
      inFlightMutation = false
      activeReadAbort?.abort()
      activeReadAbort = null
      activeMutationAbort?.abort()
      activeMutationAbort = null

      emit({
        orderId: nextOrder,
        order: null,
        isLoading: false,
        loadError: null,
        loadErrorCode: null,
        isNotFound: false,
        isUserNotFound: false,
        isForbidden: false,
        isStale: false,
        isOutcomeAmbiguous: false,
        isSubmitting: false,
        confirmSnapshot: null,
        mutationError: null,
        mutationErrorCode: null,
        mutationSuccessMessage: null,
      })
    }

    return {
      ownerId: nextOwner,
      orderId: nextOrder,
      isAuthenticated: Boolean(nextOwner),
    }
  }

  const classifyDetailError = (err: unknown, fallbackMessage: string) => {
    const code = err instanceof ApiError ? (err.code ?? null) : null
    const status = err instanceof ApiError ? err.status : 0

    const isUnauthorized =
      status === 401 ||
      code === 'Auth.Unauthorized' ||
      code === 'Checkout.Unauthorized'

    const isForbidden =
      !isUnauthorized &&
      (status === 403 ||
        code === 'OrderManagement.Forbidden' ||
        code === 'Checkout.AccountInactive' ||
        code === 'Auth.Forbidden' ||
        code === 'User.AccountInactive')

    const isUserNotFound =
      !isUnauthorized && !isForbidden && code === 'Checkout.UserNotFound'

    const isOrderNotFound =
      !isUnauthorized &&
      !isForbidden &&
      !isUserNotFound &&
      (status === 404 || code === 'Order.NotFound')

    const isTerminalAccessOrMissing =
      isUnauthorized || isForbidden || isUserNotFound || isOrderNotFound

    const resolvedCode =
      code ??
      (isUnauthorized
        ? 'Auth.Unauthorized'
        : isForbidden
          ? 'OrderManagement.Forbidden'
          : isUserNotFound
            ? 'Checkout.UserNotFound'
            : isOrderNotFound
              ? 'Order.NotFound'
              : null)

    const mappedMessage =
      !code && resolvedCode && ADMIN_ERROR_MESSAGES[resolvedCode]
        ? ADMIN_ERROR_MESSAGES[resolvedCode]
        : mapAdminApiError(err, fallbackMessage)

    return {
      code,
      resolvedCode,
      status,
      isUnauthorized,
      isForbidden,
      isUserNotFound,
      isOrderNotFound,
      isTerminalAccessOrMissing,
      mappedMessage,
    }
  }

  const loadOrderDetail = async (options?: {
    preserveMutationNotice?: boolean
    keepStaleOnFailure?: boolean
  }): Promise<OrderDetailDto | null> => {
    const { ownerId, orderId } = syncContext()
    const ctx = deps.getContext()

    if (!mounted || !ownerId) {
      return null
    }

    // Không cho phép tải lại đè lên khi đang gửi PATCH
    if (inFlightMutation) {
      return null
    }

    if (!orderId || !isValidUuid(orderId)) {
      emit({
        order: null,
        isLoading: false,
        isSubmitting: false,
        loadError:
          ADMIN_ERROR_MESSAGES['Order.InvalidId'] ??
          'Mã định danh đơn hàng (ID) không đúng định dạng UUID.',
        loadErrorCode: 'Order.InvalidId',
        isNotFound: true,
        isUserNotFound: false,
        isForbidden: false,
        isStale: false,
        isOutcomeAmbiguous: false,
        confirmSnapshot: null,
        mutationError: null,
        mutationErrorCode: null,
        mutationSuccessMessage: null,
      })
      return null
    }

    const myCtxGen = contextGeneration
    const myReadGen = ++readGeneration
    activeReadAbort?.abort()
    const controller = new AbortController()
    activeReadAbort = controller

    const isReadCurrent = () => {
      if (!mounted) return false
      if (contextGeneration !== myCtxGen) return false
      if (readGeneration !== myReadGen) return false
      if (inFlightMutation) return false
      const now = deps.getContext()
      const nowOwner =
        now.authStatus === 'authenticated' && now.user?.id?.trim()
          ? now.user.id.trim()
          : null
      const nowOrder = now.orderId?.trim() || null
      return nowOwner === ownerId && nowOrder === orderId
    }

    emit({
      isLoading: true,
      loadError: null,
      loadErrorCode: null,
      isNotFound: false,
      isUserNotFound: false,
      isForbidden: false,
      confirmSnapshot: null,
      ...(options?.preserveMutationNotice || state.isOutcomeAmbiguous
        ? {}
        : {
            mutationError: null,
            mutationErrorCode: null,
            mutationSuccessMessage: null,
          }),
    })

    try {
      const detail = await executeWithAdminAuth({
        authStatus: ctx.authStatus,
        user: ctx.user,
        getAccessToken: ctx.getAccessToken,
        isContextCurrent: isReadCurrent,
        operation: (token) =>
          fetchOrderById(orderId, token, controller.signal),
      })

      if (!isReadCurrent()) return null

      emit({
        order: detail,
        isLoading: false,
        loadError: null,
        loadErrorCode: null,
        isNotFound: false,
        isUserNotFound: false,
        isForbidden: false,
        isStale: false,
        isOutcomeAmbiguous: false,
        confirmSnapshot: null,
        ...(options?.preserveMutationNotice
          ? {}
          : {
              mutationError: null,
              mutationErrorCode: null,
            }),
      })
      return detail
    } catch (err: unknown) {
      if (!isReadCurrent()) return null
      if (err instanceof Error && err.name === 'AbortError') return null
      if (err instanceof ApiError && err.isAbortError) return null

      const {
        code,
        resolvedCode,
        isForbidden,
        isUserNotFound,
        isOrderNotFound,
        isTerminalAccessOrMissing,
        mappedMessage,
      } = classifyDetailError(
        err,
        'Không thể tải thông tin chi tiết đơn hàng. Vui lòng kiểm tra kết nối mạng và thử lại.'
      )

      // Phân loại lỗi truy cập/không tồn tại (401/403/404) TRƯỚC quyết định giữ dữ liệu stale:
      // Xóa ngay dữ liệu đơn hàng cũ, đóng confirmSnapshot, kết thúc loading/submitting, xóa thông báo cũ
      if (isTerminalAccessOrMissing) {
        emit({
          order: null,
          isLoading: false,
          isSubmitting: false,
          loadError: mappedMessage,
          loadErrorCode: resolvedCode,
          isNotFound: isOrderNotFound,
          isUserNotFound,
          isForbidden,
          isStale: false,
          isOutcomeAmbiguous: false,
          confirmSnapshot: null,
          mutationError: null,
          mutationErrorCode: null,
          mutationSuccessMessage: null,
        })
        return null
      }

      // Nếu đang recover từ 409 hoặc ambiguous outcome mà GET bị lỗi tạm thời (mạng/status 0/5xx), giữ nguyên khóa isStale / isOutcomeAmbiguous
      if (options?.keepStaleOnFailure && state.order) {
        emit({
          isLoading: false,
          loadError: mappedMessage,
          loadErrorCode: code,
          isNotFound: false,
          isUserNotFound: false,
          isForbidden: false,
          isStale: true,
          confirmSnapshot: null,
          mutationSuccessMessage: null,
        })
        return null
      }

      emit({
        order: state.order,
        isLoading: false,
        loadError: mappedMessage,
        loadErrorCode: code,
        isNotFound: false,
        isUserNotFound: false,
        isForbidden: false,
        confirmSnapshot: null,
        mutationSuccessMessage: null,
      })
      return null
    }
  }

  const openConfirmDialog = (
    targetStatus: ManagedFulfillmentTargetStatus
  ): ManagedOrderConfirmSnapshot | null => {
    const { ownerId, orderId } = syncContext()
    if (
      !mounted ||
      !ownerId ||
      !orderId ||
      !state.order ||
      inFlightMutation ||
      state.isSubmitting ||
      state.isStale ||
      state.isOutcomeAmbiguous ||
      state.isForbidden
    ) {
      return null
    }

    const snapshot = createOrderStatusConfirmSnapshot({
      order: state.order,
      ownerId,
      targetStatus,
    })

    if (!snapshot) return null

    emit({
      confirmSnapshot: snapshot,
      mutationError: null,
      mutationErrorCode: null,
      mutationSuccessMessage: null,
    })
    return snapshot
  }

  const closeConfirmDialog = (): void => {
    if (inFlightMutation || state.isSubmitting) return
    if (state.confirmSnapshot !== null) {
      emit({ confirmSnapshot: null })
    }
  }

  const submitConfirmedStatusChange = async (): Promise<OrderDetailDto | null> => {
    // Khóa đồng bộ ngay lập tức chống double-click trước khi rerender
    if (inFlightMutation) {
      return null
    }

    const { ownerId, orderId } = syncContext()
    const snapshot = state.confirmSnapshot

    if (
      !mounted ||
      !ownerId ||
      !orderId ||
      !state.order ||
      state.isStale ||
      state.isOutcomeAmbiguous ||
      state.isForbidden ||
      !isConfirmSnapshotStillValid({
        snapshot,
        currentOrder: state.order,
        currentOwnerId: ownerId,
        currentOrderId: orderId,
      }) ||
      !snapshot
    ) {
      if (state.confirmSnapshot !== null) {
        emit({
          confirmSnapshot: null,
          ...(state.order
            ? {
                mutationError:
                  'Thao tác xác nhận không còn khớp với trạng thái đơn hàng hiện tại. Vui lòng kiểm tra lại đơn hàng.',
                mutationErrorCode: 'Order.StaleConfirmSnapshot',
              }
            : {}),
        })
      }
      return null
    }

    // Khóa mutation và vô hiệu hóa mọi GET đang bay trước đó để GET cũ không bao giờ ghi đè kết quả PATCH
    inFlightMutation = true
    readGeneration += 1
    activeReadAbort?.abort()
    activeReadAbort = null

    const myCtxGen = contextGeneration
    activeMutationAbort?.abort()
    const mutationController = new AbortController()
    activeMutationAbort = mutationController

    const isMutationCurrent = () => {
      if (!mounted) return false
      if (contextGeneration !== myCtxGen) return false
      const now = deps.getContext()
      const nowOwner =
        now.authStatus === 'authenticated' && now.user?.id?.trim()
          ? now.user.id.trim()
          : null
      const nowOrder = now.orderId?.trim() || null
      return nowOwner === ownerId && nowOrder === orderId
    }

    emit({
      isLoading: false,
      isSubmitting: true,
      mutationError: null,
      mutationErrorCode: null,
      mutationSuccessMessage: null,
    })

    const requestBody: UpdateManagedOrderStatusRequest = {
      expectedStatus: snapshot.expectedStatus,
      newStatus: snapshot.newStatus,
    }

    try {
      const ctx = deps.getContext()
      const updatedOrder = await executeWithAdminAuth({
        authStatus: ctx.authStatus,
        user: ctx.user,
        getAccessToken: ctx.getAccessToken,
        isContextCurrent: isMutationCurrent,
        operation: (token) =>
          patchOrderStatus(
            snapshot.orderId,
            requestBody,
            token,
            mutationController.signal
          ),
      })

      if (!isMutationCurrent()) return null

      // Kiểm tra đúng order.id từ response BE
      if (!updatedOrder || updatedOrder.id !== snapshot.orderId) {
        inFlightMutation = false
        emit({
          isSubmitting: false,
          confirmSnapshot: null,
          isOutcomeAmbiguous: true,
          mutationError:
            'Phản hồi cập nhật đơn hàng không khớp mã định danh. Vui lòng nhấn "Kiểm tra lại đơn hàng" để đồng bộ trạng thái thật từ máy chủ.',
          mutationErrorCode: 'Order.AmbiguousResponse',
        })
        return null
      }

      inFlightMutation = false
      const newStatusLabel = getSafeOrderStatusLabel(updatedOrder.status)
      const successMsg =
        updatedOrder.status === 'Completed' &&
        updatedOrder.paymentMethod === 'COD'
          ? `Đã hoàn tất đơn hàng #${updatedOrder.orderNumber} và ghi nhận thanh toán COD thành công.`
          : updatedOrder.status === 'Cancelled'
            ? `Đã hủy đơn hàng #${updatedOrder.orderNumber} và hoàn lại tồn kho thành công.`
            : `Đã cập nhật trạng thái đơn hàng #${updatedOrder.orderNumber} sang "${newStatusLabel}".`

      emit({
        order: updatedOrder,
        isSubmitting: false,
        confirmSnapshot: null,
        isNotFound: false,
        isUserNotFound: false,
        isForbidden: false,
        isStale: false,
        isOutcomeAmbiguous: false,
        loadError: null,
        loadErrorCode: null,
        mutationError: null,
        mutationErrorCode: null,
        mutationSuccessMessage: successMsg,
      })

      return updatedOrder
    } catch (err: unknown) {
      if (!isMutationCurrent()) {
        return null
      }
      inFlightMutation = false

      if (err instanceof Error && err.name === 'AbortError') {
        emit({ isSubmitting: false })
        return null
      }
      if (err instanceof ApiError && err.isAbortError) {
        emit({ isSubmitting: false })
        return null
      }

      const {
        code,
        resolvedCode,
        status,
        isForbidden,
        isUserNotFound,
        isOrderNotFound,
        isTerminalAccessOrMissing,
        mappedMessage,
      } = classifyDetailError(
        err,
        'Không thể cập nhật trạng thái đơn hàng. Vui lòng kiểm tra lại dữ liệu.'
      )

      // 1. Xử lý lỗi terminal 401 / 403 / 404 trên PATCH: xóa ngay dữ liệu đơn hàng, đóng confirm, gán loadError để nhánh !order hiển thị lý do
      if (isTerminalAccessOrMissing) {
        emit({
          order: null,
          isLoading: false,
          isSubmitting: false,
          loadError: mappedMessage,
          loadErrorCode: resolvedCode,
          isNotFound: isOrderNotFound,
          isUserNotFound,
          isForbidden,
          isStale: false,
          isOutcomeAmbiguous: false,
          confirmSnapshot: null,
          mutationError: mappedMessage,
          mutationErrorCode: resolvedCode,
          mutationSuccessMessage: null,
        })
        return null
      }

      // 2. Xử lý 409 Conflict: đóng confirm cũ, báo lỗi rõ ràng, đánh dấu stale + khóa action và tự động reload GET
      if (
        status === 409 ||
        code === 'Order.StatusConflict' ||
        code === 'Order.ConcurrencyConflict' ||
        code === 'Order.InvalidStatusTransition' ||
        code === 'Order.PaidOrderRequiresRefund'
      ) {
        const conflictMsg =
          code === 'Order.PaidOrderRequiresRefund'
            ? PAID_ONLINE_CANCEL_UNSUPPORTED_NOTICE
            : mapAdminApiError(
                err,
                'Trạng thái đơn hàng đã thay đổi hoặc thao tác không còn hợp lệ. Đang tải lại dữ liệu mới nhất...'
              )

        emit({
          isSubmitting: false,
          confirmSnapshot: null,
          isStale: true,
          mutationError: conflictMsg,
          mutationErrorCode: code ?? 'Order.StatusConflict',
          mutationSuccessMessage: null,
        })

        await loadOrderDetail({
          preserveMutationNotice: true,
          keepStaleOnFailure: true,
        })
        return null
      }

      // 3. Xử lý lỗi mạng / timeout / 5xx: kết quả trên BE chưa xác định -> KHÔNG tự retry PATCH, khóa action cho tới khi GET thành công
      const isAmbiguous =
        !(err instanceof ApiError) ||
        err.isNetworkError ||
        status === 0 ||
        status >= 500

      if (isAmbiguous) {
        emit({
          isSubmitting: false,
          confirmSnapshot: null,
          isOutcomeAmbiguous: true,
          mutationError:
            'Kết nối bị gián đoạn hoặc máy chủ phản hồi chậm khi cập nhật trạng thái. Yêu cầu có thể đã được ghi nhận trên hệ thống. Vui lòng nhấn "Kiểm tra lại đơn hàng" để xem trạng thái thật trước khi thực hiện thao tác tiếp theo.',
          mutationErrorCode: code ?? 'Order.AmbiguousOutcome',
          mutationSuccessMessage: null,
        })
        return null
      }

      // 4. Xử lý 400 Bad Request hoặc lỗi khác
      emit({
        isSubmitting: false,
        confirmSnapshot: null,
        mutationError: mappedMessage,
        mutationErrorCode: code,
        mutationSuccessMessage: null,
      })
      return null
    }
  }

  /**
   * Nút "Kiểm tra lại đơn hàng" sau khi gặp lỗi mạng/timeout/5xx hoặc khi detail bị đánh dấu stale.
   * Chỉ mở khóa thao tác khi GET /orders/admin/{id} trả về thành công.
   */
  const recoverOrderState = async (): Promise<OrderDetailDto | null> => {
    return loadOrderDetail({
      preserveMutationNotice: false,
      keepStaleOnFailure: true,
    })
  }

  const dispose = () => {
    mounted = false
    contextGeneration += 1
    readGeneration += 1
    inFlightMutation = false
    activeReadAbort?.abort()
    activeReadAbort = null
    activeMutationAbort?.abort()
    activeMutationAbort = null
  }

  return {
    getState: () => state,
    syncContext,
    loadOrderDetail,
    openConfirmDialog,
    closeConfirmDialog,
    submitConfirmedStatusChange,
    recoverOrderState,
    dispose,
  }
}
