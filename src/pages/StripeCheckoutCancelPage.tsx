import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CreditCard,
  ArrowRight,
  Loader2,
  Package,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { checkoutCart } from '../features/checkout/checkoutApi'
import { buyNowPCBuild, buyNowProduct } from '../features/buyNow/buyNowApi'
import { cancelMyOrder } from '../features/orders/orderApi'
import {
  CHECKOUT_ERROR_MESSAGES,
} from '../features/checkout/checkoutConstants'
import {
  getPendingStripeCheckout,
  validateStripeRedirectUrl,
  clearPendingStripeCheckoutForOrder,
} from '../features/checkout/stripeCheckoutSession'
import type { OrderDetailDto } from '../features/orders/orderTypes'

export const StripeCheckoutCancelPage: React.FC = () => {
  const { user, getAccessToken } = useAuth()
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelConflict, setCancelConflict] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelledOrder, setCancelledOrder] = useState<OrderDetailDto | null>(null)

  const pending = user?.id ? getPendingStripeCheckout(user.id) : null
  const isBusy = isRetrying || isCancelling

  const handleResumeStripe = async () => {
    if (!pending || isBusy) return

    setIsRetrying(true)
    setRetryError(null)
    setCancelError(null)

    try {
      let token = await getAccessToken(false)
      if (!token) throw new Error('Chưa đăng nhập.')

      const executeResume = async (authToken: string) => {
        if (pending.source === 'product') {
          return buyNowProduct(
            pending.productId,
            {
              addressId: pending.addressId,
              quantity: pending.quantity,
              paymentMethod: 'Stripe',
              notes: null,
            },
            pending.idempotencyKey,
            authToken
          )
        }

        if (pending.source === 'pc-build') {
          return buyNowPCBuild(
            pending.buildId,
            {
              addressId: pending.addressId,
              paymentMethod: 'Stripe',
              notes: null,
            },
            pending.idempotencyKey,
            authToken
          )
        }

        return checkoutCart(
          {
            addressId: pending.addressId,
            expectedCartVersion: pending.expectedCartVersion,
            paymentMethod: 'Stripe',
            notes: null,
          },
          pending.idempotencyKey,
          authToken
        )
      }

      let order
      try {
        order = await executeResume(token)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          token = await getAccessToken(true)
          if (!token) throw err
          order = await executeResume(token)
        } else {
          throw err
        }
      }

      const action = order.paymentAction
      if (
        action?.type === 'Redirect' &&
        action.url &&
        validateStripeRedirectUrl(action.url)
      ) {
        window.location.assign(action.url)
        return
      }

      setRetryError(
        'Không thể lấy lại phiên thanh toán Stripe. Vui lòng kiểm tra lại trạng thái đơn hàng.'
      )
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
        setRetryError(CHECKOUT_ERROR_MESSAGES[err.code])
      } else if (err instanceof Error) {
        setRetryError(err.message)
      } else {
        setRetryError('Không thể tiếp tục thanh toán đơn hàng này. Vui lòng thử lại sau.')
      }
    } finally {
      setIsRetrying(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!pending || !user?.id || isBusy) return

    setIsCancelling(true)
    setCancelError(null)
    setCancelConflict(false)
    setRetryError(null)

    try {
      let token = await getAccessToken(false)
      if (!token) throw new Error('Chưa đăng nhập.')

      let updatedOrder: OrderDetailDto
      try {
        updatedOrder = await cancelMyOrder(pending.orderId, token)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          token = await getAccessToken(true)
          if (!token) throw err
          updatedOrder = await cancelMyOrder(pending.orderId, token)
        } else {
          throw err
        }
      }

      if (updatedOrder.id !== pending.orderId) {
        setCancelError(
          'Dữ liệu phản hồi từ máy chủ không khớp với đơn hàng hiện tại. Không thể hoàn tất hủy đơn.'
        )
        return
      }

      clearPendingStripeCheckoutForOrder(user.id, updatedOrder.id)
      setCancelledOrder(updatedOrder)
      setShowCancelConfirm(false)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setCancelConflict(true)
        setCancelError(
          'Trạng thái đơn hàng hoặc phiên thanh toán Stripe đã thay đổi trên hệ thống.'
        )
      } else if (err instanceof ApiError && err.status === 503) {
        setCancelConflict(false)
        setCancelError(
          'Cổng thanh toán Stripe tạm thời không khả dụng. Đơn hàng chưa bị hủy, bạn có thể thử lại.'
        )
      } else if (err instanceof Error) {
        setCancelConflict(false)
        setCancelError(err.message)
      } else {
        setCancelConflict(false)
        setCancelError('Không thể hủy đơn hàng lúc này. Vui lòng thử lại sau.')
      }
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
      {/* Cancel Warning Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
            Quá Trình Thanh Toán Đã Bị Hủy
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            Bạn đã rời khỏi cổng thanh toán Stripe. Đơn hàng của bạn hiện đang ở trạng thái{' '}
            <span className="font-bold text-slate-900">Chờ thanh toán</span>. Bạn có thể tiếp tục thanh toán hoặc chủ động hủy đơn hàng để giải phóng sản phẩm về kho.
          </p>
        </div>

        {/* Retry Error Alert */}
        {retryError && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl max-w-md mx-auto text-left"
          >
            {retryError}
          </div>
        )}

        {/* Cancel Error Alert */}
        {cancelError && (
          <div
            role="alert"
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl max-w-md mx-auto text-left space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{cancelError}</span>
            </div>
            {cancelConflict && pending && (
              <div className="pt-1">
                <Link
                  to={`/orders/${encodeURIComponent(pending.orderId)}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-900 underline"
                >
                  <span>Xem chi tiết trạng thái đơn hàng &rarr;</span>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Success State when Order is Cancelled */}
        {cancelledOrder ? (
          <div
            role="status"
            className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-3 max-w-md mx-auto text-left"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span className="font-bold text-sm">
                Đã hủy đơn hàng #{cancelledOrder.orderNumber} thành công
              </span>
            </div>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Phiên thanh toán Stripe đã được đóng và số lượng linh kiện đã được tự động hoàn lại kho RiuTek.
            </p>
            <div className="pt-1 flex items-center gap-3">
              <Link
                to={`/orders/${encodeURIComponent(cancelledOrder.id)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <span>Xem chi tiết đơn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/orders"
                className="text-xs font-semibold text-emerald-800 hover:underline"
              >
                Danh sách đơn hàng
              </Link>
            </div>
          </div>
        ) : pending ? (
          /* Pending Order Actions Section */
          <div className="pt-4 space-y-4 max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-400" />
                <span>Mã đơn hàng:</span>
              </span>
              <span className="font-black text-slate-900">#{pending.orderNumber}</span>
            </div>

            {/* Primary Action: Resume Stripe Checkout */}
            <button
              type="button"
              onClick={handleResumeStripe}
              disabled={isBusy}
              className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang kết nối lại Stripe...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Tiếp Tục Thanh Toán Đơn Hàng Này</span>
                </>
              )}
            </button>

            {/* Secondary Action: Cancel Order */}
            {!showCancelConfirm ? (
              <button
                type="button"
                onClick={() => {
                  setShowCancelConfirm(true)
                  setCancelError(null)
                  setRetryError(null)
                }}
                disabled={isBusy}
                className="w-full py-2.5 px-4 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-2xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                <span>Hủy đơn hàng này</span>
              </button>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3 text-left">
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm font-bold text-rose-900">
                      Xác nhận hủy đơn hàng #{pending.orderNumber}?
                    </p>
                    <p className="text-xs text-rose-700 leading-relaxed">
                      Phiên thanh toán Stripe sẽ bị đóng, đơn hàng bị hủy và số lượng linh kiện sẽ được tự động hoàn lại kho RiuTek. Bạn sẽ không thể tiếp tục thanh toán đơn hàng này sau khi hủy.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isBusy}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang xử lý hủy...</span>
                      </>
                    ) : (
                      <span>Xác nhận hủy đơn</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={isBusy}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 border border-slate-200"
                  >
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-2 text-xs text-slate-500 max-w-md mx-auto">
            Phiên thanh toán tạm thời đã hết hạn hoặc không khả dụng. Bạn có thể kiểm tra danh sách đơn hàng trong tài khoản của mình.
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/products"
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Khám phá sản phẩm khác</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/orders"
            className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-semibold transition-colors text-center"
          >
            Xem Đơn Hàng Của Tôi
          </Link>
        </div>
      </div>
    </div>
  )
}
