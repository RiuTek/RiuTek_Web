import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Package,
  ShoppingBag,
  MapPin,
  RefreshCw,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { getMyOrderById } from '../features/checkout/checkoutApi'
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../features/checkout/checkoutConstants'
import {
  clearPendingStripeCheckout,
  getPendingStripeCheckout,
} from '../features/checkout/stripeCheckoutSession'
import type { OrderDetailDto } from '../features/checkout/checkoutTypes'

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

export const CheckoutCompletePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { user, getAccessToken } = useAuth()

  const [order, setOrder] = useState<OrderDetailDto | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(targetOrderId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Xác định orderId từ query param hoặc pending Stripe checkout metadata
  const paramOrderId = searchParams.get('orderId')
  const pendingStripe = user?.id ? getPendingStripeCheckout(user.id) : null
  const targetOrderId = paramOrderId ?? pendingStripe?.orderId ?? null

  const handleManualRefresh = async () => {
    if (!targetOrderId || isRefreshing) return
    setIsRefreshing(true)
    setLoadError(null)

    try {
      let token = await getAccessToken(false)
      if (!token) throw new Error('Chưa đăng nhập.')

      let result: OrderDetailDto
      try {
        result = await getMyOrderById(targetOrderId, token)
      } catch (err: unknown) {
        token = await getAccessToken(true)
        if (!token) throw err
        result = await getMyOrderById(targetOrderId, token)
      }

      setOrder(result)

      if (
        result.status === 'Confirmed' ||
        result.status === 'Processing' ||
        result.status === 'Completed' ||
        result.paymentStatus === 'Completed'
      ) {
        clearPendingStripeCheckout()
      }
    } catch {
      setLoadError(
        'Không thể tải thông tin chi tiết đơn hàng. Vui lòng thử tải lại.'
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (!targetOrderId) return

    let cancelled = false
    const abortController = new AbortController()

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyOrderById(targetOrderId, token, abortController.signal)
      })
      .catch((err: unknown) => {
        return getAccessToken(true).then((newToken) => {
          if (!newToken) throw err
          return getMyOrderById(targetOrderId, newToken, abortController.signal)
        })
      })
      .then((result) => {
        if (!cancelled) {
          setOrder(result)
          if (
            result.status === 'Confirmed' ||
            result.status === 'Processing' ||
            result.status === 'Completed' ||
            result.paymentStatus === 'Completed'
          ) {
            clearPendingStripeCheckout()
          }
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            'Không thể tải thông tin chi tiết đơn hàng. Vui lòng thử tải lại.'
          )
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [targetOrderId, getAccessToken])

  // Không tìm thấy mã đơn hàng nào
  if (!targetOrderId) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">
            Không Tìm Thấy Thông Tin Đơn Hàng
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Không có mã đơn hàng hợp lệ nào được cung cấp. Vui lòng kiểm tra lại trong lịch sử tài khoản hoặc quay về trang chủ.
          </p>
        </div>
        <div>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <span>Tiếp Tục Mua Sắm</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  // Đang tải dữ liệu đơn hàng
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4"
      >
        <Loader2 className="w-8 h-8 animate-spin text-red-600 mx-auto" />
        <p className="text-sm font-semibold text-slate-600">
          Đang xác thực và tải thông tin đơn hàng...
        </p>
      </div>
    )
  }

  // Lỗi tải dữ liệu đơn hàng
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
          <p className="text-xs sm:text-sm text-rose-700 max-w-md mx-auto">
            {loadError}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Thử Tải Lại</span>
          </button>
          <Link
            to="/account"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors"
          >
            Về Trang Tài Khoản
          </Link>
        </div>
      </div>
    )
  }

  // Nhận diện trạng thái Stripe pending xác nhận
  const isStripePending =
    order.paymentMethod === 'Stripe' &&
    (order.status === 'PendingPayment' || order.paymentStatus === 'Pending')

  const statusLabel = ORDER_STATUS_LABELS[order.status] ?? order.status
  const paymentStatusLabel =
    PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Hero Notification Banner */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border text-center space-y-3 ${
          isStripePending
            ? 'bg-amber-50/60 border-amber-200 text-amber-950'
            : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-xs bg-white">
          {isStripePending ? (
            <Clock className="w-7 h-7 text-amber-600" />
          ) : (
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {isStripePending
              ? 'Đang Xác Nhận Thanh Toán'
              : 'Đặt Hàng Thành Công!'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
            {isStripePending
              ? 'Giao dịch qua cổng Stripe đang được xử lý và đồng bộ với hệ thống. Vui lòng chờ hoặc bấm tải lại trạng thái.'
              : `Cảm ơn bạn! Đơn hàng #${order.orderNumber} đã được ghi nhận và đang được xử lý chuẩn bị giao.`}
          </p>
        </div>

        {isStripePending && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Cập nhật trạng thái thanh toán</span>
            </button>
          </div>
        )}
      </div>

      {/* Order Details Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Header Metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-100 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400">Mã đơn hàng:</span>
            <p className="font-extrabold text-slate-900 text-sm">#{order.orderNumber}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Trạng thái:</span>
            <p className="font-bold text-slate-900">{statusLabel}</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Phương thức:</span>
            <p className="font-bold text-slate-900">
              {order.paymentMethod === 'COD' ? 'Tiền mặt (COD)' : 'Thẻ (Stripe)'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Thanh toán:</span>
            <p className="font-bold text-slate-900">{paymentStatusLabel}</p>
          </div>
        </div>

        {/* Shipping Address Section */}
        <div className="space-y-2 text-xs sm:text-sm">
          <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-red-600" />
            <span>Địa Chỉ Nhận Hàng</span>
          </h3>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1 text-slate-700">
            <p className="font-semibold text-slate-900">
              {order.customerName} | {order.customerPhone}
            </p>
            <p className="text-xs text-slate-600">{order.shippingAddress}</p>
            {order.notes && (
              <p className="text-[11px] text-slate-500 italic pt-1">
                Ghi chú: {order.notes}
              </p>
            )}
          </div>
        </div>

        {/* Item List */}
        <div className="space-y-3">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-red-600" />
            <span>Danh Sách Linh Kiện</span>
          </h3>

          <div className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 flex-shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate" title={item.productName}>
                      {item.productName}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatVnd(item.unitPrice)} × {item.quantity}
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
        <div className="space-y-2 pt-4 border-t border-slate-100 text-xs sm:text-sm">
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
          <div className="pt-2 flex items-baseline justify-between text-base font-black">
            <span className="text-slate-950">Tổng thanh toán:</span>
            <span className="text-red-600 text-lg sm:text-xl">
              {formatVnd(order.finalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Next Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
        <Link
          to="/products"
          className="w-full sm:w-auto px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors text-center shadow-xs"
        >
          Tiếp Tục Mua Sắm
        </Link>
        <Link
          to="/account"
          className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs sm:text-sm font-semibold transition-colors text-center"
        >
          Quản Lý Tài Khoản
        </Link>
      </div>
    </div>
  )
}
