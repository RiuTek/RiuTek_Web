import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShoppingBag,
  ShieldCheck,
} from 'lucide-react'
import { QUOTE_ISSUE_MESSAGES } from '../checkoutConstants'
import type { CheckoutQuoteDto } from '../checkoutTypes'

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
  onSubmit: () => Promise<void>
  onRetryQuote: () => void
}

export const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  quote,
  quoteStatus,
  quoteError,
  hasAddress,
  isSubmitting,
  submitError,
  onSubmit,
  onRetryQuote,
}) => {
  const isReady = quoteStatus === 'ready' && quote !== null
  const canSubmit =
    isReady &&
    quote.canCheckout &&
    quote.items.length > 0 &&
    hasAddress &&
    !isSubmitting

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
          <p className="font-semibold">Vui lòng chọn địa chỉ giao hàng</p>
          <p className="text-[11px] text-amber-700">
            Vui lòng chọn địa chỉ nhận hàng để hệ thống tạo báo giá và đơn hàng.
          </p>
        </div>
      )}

      {/* Quote Items List */}
      {isReady && quote.items.length > 0 && (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {quote.items.map((item) => {
            const hasIssue = !item.canPurchase || item.issueCode
            const issueMessage = item.issueCode
              ? QUOTE_ISSUE_MESSAGES[item.issueCode] ?? item.issueCode
              : null

            return (
              <div
                key={item.productId}
                className={`flex items-start gap-3 p-3 rounded-2xl border text-xs ${
                  hasIssue
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-slate-100 bg-slate-50/50'
                }`}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-12 h-12 rounded-xl object-contain bg-white border border-slate-200 p-1 flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-300 flex-shrink-0">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-bold text-slate-900 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[10px] text-slate-400">SKU: {item.sku}</p>

                  <div className="flex items-center justify-between text-slate-600 pt-0.5">
                    <span>
                      {formatVnd(item.unitPrice)} × {item.quantity}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatVnd(item.lineTotal)}
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

      {/* Submit Error Alert */}
      {submitError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-start gap-2.5 shadow-xs"
        >
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{submitError}</span>
        </div>
      )}

      {/* Place Order CTA Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm sm:text-base font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Đang tạo đơn hàng...</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5" />
            <span>Đặt Hàng Ngay</span>
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
