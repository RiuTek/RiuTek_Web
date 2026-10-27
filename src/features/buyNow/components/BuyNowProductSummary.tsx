import React from 'react'
import { Package, ShieldCheck, AlertCircle } from 'lucide-react'
import type { ProductDetail } from '../../products/productTypes'
import type { PaymentMethod } from '../../orders/orderTypes'
import { formatVnd } from '../../products/productConstants'

interface BuyNowProductSummaryProps {
  product: ProductDetail
  quantity: number
  isSubmitting?: boolean
  submitError?: string | null
  canSubmit?: boolean
  paymentMethod: PaymentMethod
  onSubmit: () => void
}

export const BuyNowProductSummary: React.FC<BuyNowProductSummaryProps> = ({
  product,
  quantity,
  isSubmitting = false,
  submitError = null,
  canSubmit = true,
  paymentMethod,
  onSubmit,
}) => {
  const primaryImageUrl =
    product.imageUrl || product.additionalImages?.[0] || null

  const lineSubtotal =
    Number.isFinite(product.price) && Number.isFinite(quantity)
      ? product.price * quantity
      : 0

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-24">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <Package className="w-5 h-5 text-red-600" />
          <span>Sản Phẩm Đặt Mua</span>
        </h3>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          Mua ngay trực tiếp
        </span>
      </div>

      {/* Product Item Card */}
      <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
        <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 p-1">
          {primaryImageUrl ? (
            <img
              src={primaryImageUrl}
              alt={product.name}
              className="w-full h-full object-contain"
              loading="lazy"
              onError={(e) => {
                // Fallback nếu ảnh không tải được
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <Package className="w-8 h-8 text-slate-300" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <h4
            className="text-xs sm:text-sm font-bold text-slate-900 truncate"
            title={product.name}
          >
            {product.name}
          </h4>
          <p className="text-[11px] text-slate-400">
            SKU: {product.sku}
          </p>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">
              {formatVnd(product.price)} × {quantity}
            </span>
            <span className="font-bold text-slate-900">
              {formatVnd(lineSubtotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="space-y-3 pt-2 text-xs sm:text-sm border-t border-slate-100">
        <div className="flex items-center justify-between text-slate-600">
          <span>Số lượng:</span>
          <span className="font-semibold text-slate-900">{quantity}</span>
        </div>

        <div className="flex items-center justify-between text-slate-600">
          <span>Đơn giá niêm yết:</span>
          <span className="font-semibold text-slate-900">
            {formatVnd(product.price)}
          </span>
        </div>

        <div className="pt-2 flex items-baseline justify-between text-base font-black border-t border-slate-100">
          <span className="text-slate-950">Tạm tính thanh toán:</span>
          <span className="text-red-600 text-lg sm:text-xl font-black">
            {formatVnd(lineSubtotal)}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 italic pt-1 leading-relaxed">
          * Giá bán và số lượng tồn kho thực tế sẽ được hệ thống RiuTek xác nhận lại tại thời điểm gửi đơn hàng.
        </p>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        {isSubmitting ? (
          <span>Đang xử lý đơn hàng...</span>
        ) : (
          <span>
            {paymentMethod === 'COD'
              ? 'Xác Nhận Đặt Hàng (COD)'
              : 'Tiến Hành Thanh Toán Stripe'}
          </span>
        )}
      </button>

      {/* Trust Badge */}
      <div className="pt-2 flex items-center justify-center gap-2 text-slate-400 text-xs text-center">
        <ShieldCheck className="w-4 h-4 text-slate-400" />
        <span>Thanh toán an toàn • Linh kiện chính hãng</span>
      </div>
    </div>
  )
}
