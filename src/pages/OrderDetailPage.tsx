import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Package,
  CreditCard,
  MapPin,
  User,
  Phone,
  Mail,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { getMyOrderById, cancelMyOrder } from '../features/orders/orderApi'
import {
  canCustomerCancelOrder,
  PAYMENT_METHOD_LABELS,
} from '../features/orders/orderConstants'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../features/orders/components/OrderStatusBadge'
import { getPendingStripeCheckout } from '../features/checkout/stripeCheckoutSession'
import type { OrderDetailDto } from '../features/orders/orderTypes'

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

function formatCreatedAt(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

export const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const { user, getAccessToken } = useAuth()

  const [order, setOrder] = useState<OrderDetailDto | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Track the query key currently being fetched / displayed
  const currentQueryKey = `${orderId ?? ''}-${reloadKey}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)

  const isLoading =
    Boolean(orderId) && loadedQueryKey !== currentQueryKey && loadError === null

  // Cancellation states
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelConflict, setCancelConflict] = useState(false)
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null)

  const handleRetry = () => {
    setLoadError(null)
    setReloadKey((prev) => prev + 1)
  }

  // Initial load effect
  useEffect(() => {
    if (!orderId) return

    let cancelled = false
    const abortController = new AbortController()

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyOrderById(orderId, token, abortController.signal)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          return getAccessToken(true).then((newToken) => {
            if (!newToken) throw err
            return getMyOrderById(orderId, newToken, abortController.signal)
          })
        }
        throw err
      })
      .then((res) => {
        if (!cancelled) {
          setOrder(res)
          setLoadError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return
        setLoadError(
          'Không thể tải thông tin chi tiết đơn hàng. Đơn hàng có thể không tồn tại hoặc bạn không có quyền xem.'
        )
        setLoadedQueryKey(currentQueryKey)
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [orderId, currentQueryKey, getAccessToken])

  // Handle Cancel COD
  const handleConfirmCancel = async () => {
    if (!order || isCancelling) return

    setIsCancelling(true)
    setCancelError(null)
    setCancelConflict(false)
    setCancelSuccessMsg(null)

    try {
      let token = await getAccessToken(false)
      if (!token) throw new Error('Chưa đăng nhập.')

      let updatedOrder: OrderDetailDto
      try {
        updatedOrder = await cancelMyOrder(order.id, token)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          token = await getAccessToken(true)
          if (!token) throw err
          updatedOrder = await cancelMyOrder(order.id, token)
        } else {
          throw err
        }
      }

      setOrder(updatedOrder)
      setShowCancelConfirm(false)
      setCancelSuccessMsg('Đã hủy đơn hàng thành công.')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setCancelConflict(true)
        setCancelError(
          'Trạng thái đơn hàng đã thay đổi trên hệ thống. Vui lòng tải lại trang để xem thông tin mới nhất.'
        )
      } else {
        setCancelError(
          'Không thể hủy đơn hàng lúc này. Vui lòng thử lại sau.'
        )
      }
    } finally {
      setIsCancelling(false)
    }
  }

  // Pending Stripe validation
  const pendingStripe = user?.id ? getPendingStripeCheckout(user.id) : null
  const isStripePendingOrder =
    order !== null &&
    order.paymentMethod === 'Stripe' &&
    order.status === 'PendingPayment' &&
    order.paymentStatus === 'Pending'

  const canResumeStripe =
    isStripePendingOrder &&
    pendingStripe !== null &&
    pendingStripe.orderId === order.id

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-100 rounded" />
            </div>
          </div>
          <div className="h-28 bg-slate-100 rounded-2xl" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (loadError || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">
            Không Thể Tải Đơn Hàng
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {loadError ?? 'Đơn hàng không tìm thấy.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleRetry}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
          <Link
            to="/orders"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
          >
            Về danh sách đơn hàng
          </Link>
        </div>
      </div>
    )
  }

  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-red-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách đơn hàng</span>
        </Link>

        <span className="text-xs text-slate-400">
          Ngày tạo: {formatCreatedAt(order.createdAt)}
        </span>
      </div>

      {/* Success Notification after Cancel */}
      {cancelSuccessMsg && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{cancelSuccessMsg}</span>
        </div>
      )}

      {/* Cancel Error Notification */}
      {cancelError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{cancelError}</span>
          </div>
          {cancelConflict && (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Tải lại chi tiết</span>
            </button>
          )}
        </div>
      )}

      {/* Main Order Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 flex-shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Chi tiết đơn hàng</span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950">
                #{order.orderNumber}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        {/* Customer & Shipping Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 rounded-2xl bg-slate-50/70 border border-slate-100 text-xs sm:text-sm">
          {/* Receiver Info */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <span>Người Nhận</span>
            </h2>
            <div className="space-y-1 text-slate-600">
              <p className="font-bold text-slate-900">{order.customerName}</p>
              <p className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{order.customerPhone}</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{order.customerEmail}</span>
              </p>
            </div>
          </div>

          {/* Delivery & Payment Info */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>Giao Hàng &amp; Thanh Toán</span>
            </h2>
            <div className="space-y-1 text-slate-600">
              <p>{order.shippingAddress}</p>
              <p className="flex items-center gap-1.5 pt-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800">
                  {paymentMethodLabel}
                </span>
              </p>
              {order.notes && (
                <p className="text-[11px] text-slate-500 italic pt-1">
                  Ghi chú: {order.notes}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Item List */}
        <div className="space-y-3">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-red-600" />
            <span>Danh Sách Sản Phẩm</span>
          </h2>

          <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
            {order.items.map((item) => (
              <div
                key={item.productId}
                className="py-3.5 flex items-center justify-between gap-4 text-xs sm:text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate" title={item.productName}>
                      {item.productName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      SKU: {item.productSku} | {formatVnd(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                </div>

                <span className="font-bold text-slate-900 flex-shrink-0">
                  {formatVnd(item.totalPrice)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="space-y-2.5 pt-2 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Tổng tiền hàng:</span>
            <span className="font-semibold text-slate-900">
              {formatVnd(order.totalAmount)}
            </span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-600">
              <span>Giảm giá:</span>
              <span className="font-semibold">
                -{formatVnd(order.discountAmount)}
              </span>
            </div>
          )}
          <div className="pt-2 flex items-baseline justify-between text-base font-black border-t border-slate-100">
            <span className="text-slate-950">Tổng thanh toán:</span>
            <span className="text-red-600 text-lg sm:text-xl">
              {formatVnd(order.finalAmount)}
            </span>
          </div>
        </div>

        {/* Stripe Resume Section */}
        {isStripePendingOrder && (
          <div className="pt-4 border-t border-slate-100">
            {canResumeStripe ? (
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    <span>Đơn hàng đang chờ thanh toán Stripe</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Bạn có thể tiếp tục hoàn tất thanh toán cho đơn hàng này ngay bây giờ.
                  </p>
                </div>
                <Link
                  to="/checkout/cancel"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto"
                >
                  <span>Tiếp tục thanh toán</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">
                  Phiên thanh toán tạm thời không còn khả dụng trên trình duyệt này.
                </p>
                <p className="mt-0.5 text-slate-500">
                  Nếu bạn cần thanh toán lại, vui lòng đặt đơn hàng mới hoặc liên hệ bộ phận hỗ trợ của RiuTek.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cancellation Section for Confirmed COD */}
        {canCustomerCancelOrder(order) && (
          <div className="pt-4 border-t border-slate-100">
            {!showCancelConfirm ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900">
                    Hủy Đơn Hàng COD
                  </p>
                  <p className="text-[11px] sm:text-xs text-slate-500">
                    Đơn hàng COD đang ở trạng thái xác nhận và chưa được xử lý giao có thể hủy.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-4 py-2 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-xs sm:text-sm font-bold transition-colors self-start sm:self-auto shadow-2xs"
                >
                  Hủy đơn hàng
                </button>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-rose-900">
                      Xác nhận hủy đơn hàng #{order.orderNumber}?
                    </p>
                    <p className="text-xs text-rose-700">
                      Hành động này không thể hoàn tác. Số lượng linh kiện sẽ được tự động khôi phục về kho RiuTek.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={isCancelling}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý hủy...</span>
                      </>
                    ) : (
                      <span>Xác nhận hủy</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isCancelling}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 border border-slate-200"
                  >
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
