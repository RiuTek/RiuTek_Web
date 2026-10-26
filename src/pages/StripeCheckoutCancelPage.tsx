import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  CreditCard,
  ArrowRight,
  Loader2,
  Package,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { checkoutCart } from '../features/checkout/checkoutApi'
import {
  CHECKOUT_ERROR_MESSAGES,
} from '../features/checkout/checkoutConstants'
import {
  getPendingStripeCheckout,
  validateStripeRedirectUrl,
} from '../features/checkout/stripeCheckoutSession'
import type { CheckoutCartRequest } from '../features/checkout/checkoutTypes'

export const StripeCheckoutCancelPage: React.FC = () => {
  const { user, getAccessToken } = useAuth()
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const pending = user?.id ? getPendingStripeCheckout(user.id) : null

  const handleResumeStripe = async () => {
    if (!pending || isRetrying) return

    setIsRetrying(true)
    setRetryError(null)

    const request: CheckoutCartRequest = {
      addressId: pending.addressId,
      expectedCartVersion: pending.expectedCartVersion,
      paymentMethod: 'Stripe',
      notes: null,
    }

    try {
      let token = await getAccessToken(false)
      if (!token) throw new Error('Chưa đăng nhập.')

      let order
      try {
        order = await checkoutCart(request, pending.idempotencyKey, token)
      } catch (err: unknown) {
        token = await getAccessToken(true)
        if (!token) throw err
        order = await checkoutCart(request, pending.idempotencyKey, token)
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
            <span className="font-bold text-slate-900">Chờ thanh toán</span>. Tồn kho vẫn được tạm giữ cho đến khi phiên thanh toán hết hạn.
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

        {/* Pending Order Resume Section */}
        {pending ? (
          <div className="pt-4 space-y-4 max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-slate-400" />
                <span>Mã đơn hàng:</span>
              </span>
              <span className="font-black text-slate-900">#{pending.orderNumber}</span>
            </div>

            <button
              type="button"
              onClick={handleResumeStripe}
              disabled={isRetrying}
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
            to="/account"
            className="w-full sm:w-auto px-5 py-2.5 text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-semibold transition-colors text-center"
          >
            Về Trang Tài Khoản
          </Link>
        </div>
      </div>
    </div>
  )
}
