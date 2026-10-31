import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  ShieldCheck,
  RotateCcw,
  ExternalLink,
} from 'lucide-react'
import { QUOTE_ISSUE_MESSAGES } from '../checkoutConstants'
import type { CheckoutQuoteDto, PaymentMethod } from '../checkoutTypes'
import type { CartAttemptStatus, KnownCartOrderState } from '../cartCheckoutHelper'

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

interface CheckoutOrderSummaryProps {
  quote: CheckoutQuoteDto | null
  quoteStatus: 'idle' | 'loading' | 'ready' | 'error'
  quoteError: string | null
  hasAddress: boolean
  isSubmitting: boolean
  submitError: string | null
  attemptStatus?: CartAttemptStatus
  unresolvedMessage?: string | null
  knownOrder?: KnownCartOrderState | null
  paymentMethod?: PaymentMethod
  canCreateNew?: boolean
  canReplay?: boolean
  onSubmit: () => Promise<void>
  onRetryQuote: () => void
  onRetryStorageAndRedirect?: () => void
}

export const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  quote,
  quoteStatus,
  quoteError,
  hasAddress,
  isSubmitting,
  submitError,
  attemptStatus = 'idle',
  unresolvedMessage,
  knownOrder,
  paymentMethod = 'COD',
  canCreateNew = false,
  canReplay = false,
  onSubmit,
  onRetryQuote,
  onRetryStorageAndRedirect,
}) => {
  const isReady = quoteStatus === 'ready' && quote !== null
  const isUnresolved = attemptStatus === 'unresolved'
  const isStripeStorageFailed = attemptStatus === 'stripe_storage_failed'
  const isStripeRedirectFailed = attemptStatus === 'stripe_redirect_failed'

  const isButtonEnabled = !isSubmitting && (canCreateNew || canReplay)

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-28">
      <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-red-600" />
          <span>Chi Tiết Đơn Hàng</span>
        </h3>
        {quote && (
          <span className="text-xs font-semibold text-slate-500">
            {quote.items.length} sản phẩm
          </span>
        )}
      </div>

      {/* Quote Loading */}
      {quoteStatus === 'loading' && (
        <div
          aria-busy="true"
          className="py-10 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs sm:text-sm text-center"
        >
          <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          <span>Đang tính toán báo giá và kiểm tra tồn kho...</span>
        </div>
      )}

      {/* Quote Error */}
      {quoteStatus === 'error' && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl space-y-3"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Không thể tính toán báo giá</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {quoteError || 'Đã có lỗi xảy ra khi xác nhận báo giá. Vui lòng thử lại.'}
          </p>
          <button
            type="button"
            onClick={onRetryQuote}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Thử tải lại báo giá
          </button>
        </div>
      )}

      {/* No Address Selected */}
      {!hasAddress && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl space-y-1.5">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Chưa chọn địa chỉ nhận hàng</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Vui lòng chọn hoặc thêm địa chỉ nhận hàng bên trái để hệ thống tính toán chi tiết và thuế phí.
          </p>
        </div>
      )}

      {/* Quote Items List */}
      {isReady && quote.items.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {quote.items.map((item) => {
            const hasIssue = !item.canPurchase
            const issueMessage = item.issueCode
              ? QUOTE_ISSUE_MESSAGES[item.issueCode] ?? item.issueCode
              : null

            return (
              <div
                key={item.productId}
                className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
                  hasIssue
                    ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                    : 'bg-slate-50/60 border-slate-100 text-slate-800'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate text-slate-900" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] mt-0.5">
                    <span>{formatVnd(item.unitPrice)}</span>
                    <span>×</span>
                    <span>{item.quantity}</span>
                    <span className="font-semibold text-slate-900">
                      = {formatVnd(item.lineTotal)}
                    </span>
                  </div>

                  {hasIssue && issueMessage && (
                    <p className="text-[10px] font-semibold text-rose-600 pt-0.5">
                      {issueMessage}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quote Summary Pricing */}
      {isReady && (
        <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs sm:text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Tạm tính tiền hàng:</span>
            <span className="font-semibold text-slate-900">
              {formatVnd(quote.subtotal)}
            </span>
          </div>

          {quote.discountAmount > 0 && (
            <div className="flex items-center justify-between text-emerald-600">
              <span>Giảm giá:</span>
              <span className="font-semibold">
                -{formatVnd(quote.discountAmount)}
              </span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-sm font-black text-slate-950">Tổng thanh toán:</span>
              <p className="text-[10px] text-slate-400">Tổng tiền theo báo giá hiện tại</p>
            </div>
            <span className="text-xl sm:text-2xl font-black text-red-600">
              {formatVnd(quote.finalAmount)}
            </span>
          </div>
        </div>
      )}

      {/* Quote Overall Issues Alert */}
      {isReady && !quote.canCheckout && (
        <div
          role="alert"
          className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-xs text-amber-900"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Giỏ hàng cần được điều chỉnh</span>
          </div>

          <div className="space-y-1 text-[11px] text-amber-800 leading-relaxed">
            {quote.issues.map((code, idx) => (
              <p key={idx}>• {QUOTE_ISSUE_MESSAGES[code] ?? code}</p>
            ))}
          </div>

          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:underline pt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại giỏ hàng để cập nhật</span>
          </Link>
        </div>
      )}

      {/* Unresolved Attempt Warning Card */}
      {isUnresolved && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                {knownOrder
                  ? `Đơn hàng #${knownOrder.orderNumber} đã ghi nhận nhưng chưa thể xác nhận tiếp thanh toán`
                  : 'Chưa thể xác nhận kết quả từ máy chủ'}
              </span>
              <p className="text-amber-800 leading-relaxed">
                {unresolvedMessage ||
                  (knownOrder
                    ? 'Yêu cầu thanh toán tiếp theo bị gián đoạn. Đơn hàng của bạn đã được ghi nhận trên hệ thống.'
                    : 'Yêu cầu trước đó bị gián đoạn hoặc phản hồi chậm. Đơn hàng của bạn có thể đã được khởi tạo thành công trên hệ thống.')}
              </p>
              <p className="text-amber-900 font-medium pt-0.5">
                Bạn có thể bấm <strong>"Thử lại an toàn"</strong> để kiểm tra lại với cùng mã giao dịch này (máy chủ sẽ tự nhận diện và không tạo đơn trùng lặp), hoặc kiểm tra mục Đơn hàng của tôi.
              </p>
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {knownOrder && (
              <Link
                to={`/orders/${encodeURIComponent(knownOrder.id)}`}
                className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Xem chi tiết đơn #{knownOrder.orderNumber}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <Link
              to="/orders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline text-xs py-1"
            >
              <span>Kiểm tra danh sách Đơn hàng của tôi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Known Order with Storage / Redirect Recovery */}
      {knownOrder && (isStripeStorageFailed || isStripeRedirectFailed) && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                Đơn hàng #{knownOrder.orderNumber} đã được tạo thành công!
              </span>
              <p className="text-emerald-800 leading-relaxed">
                {isStripeStorageFailed
                  ? 'Tuy nhiên trình duyệt đang chặn lưu trữ phiên thanh toán (sessionStorage). Để tiếp tục thanh toán, bạn có thể xem chi tiết đơn hàng hoặc thử lưu lại.'
                  : 'Tuy nhiên kết nối chuyển hướng sang Stripe gặp sự cố hoặc phiên thanh toán đã hết hạn. Bạn có thể mở chi tiết đơn hàng để tiếp tục thanh toán.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Link
              to={`/orders/${encodeURIComponent(knownOrder.id)}`}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Xem chi tiết đơn #{knownOrder.orderNumber}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {isStripeStorageFailed && onRetryStorageAndRedirect && (
              <button
                type="button"
                onClick={onRetryStorageAndRedirect}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 text-center"
              >
                Thử lưu lại và tiếp tục
              </button>
            )}
          </div>
        </div>
      )}

      {/* Submit Error Alert (Definitive error) */}
      {submitError && !isUnresolved && !knownOrder && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-start gap-2.5 shadow-xs"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{submitError}</span>
        </div>
      )}

      {/* Submit / Replay CTA Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!isButtonEnabled}
        className={`w-full py-3.5 px-6 rounded-2xl text-sm sm:text-base font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
          isUnresolved
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang xử lý đơn hàng...</span>
          </>
        ) : isUnresolved ? (
          <>
            <RotateCcw className="w-5 h-5" />
            <span>Thử lại an toàn với mã giao dịch này</span>
          </>
        ) : isStripeRedirectFailed ? (
          <>
            <RotateCcw className="w-5 h-5" />
            <span>Thử kết nối lại cổng Stripe</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            <span>
              {paymentMethod === 'Stripe'
                ? 'Tiếp tục thanh toán với Stripe'
                : 'Đặt Hàng Ngay'}
            </span>
          </>
        )}
      </button>

      {/* Backend Verification Note */}
      <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center gap-2 text-[11px] text-slate-500">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>Giá và tồn kho được Backend kiểm tra lại khi tạo đơn hàng.</span>
      </div>
    </div>
  )
}
