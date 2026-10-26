import React from 'react'
import { CreditCard, Banknote, FileText } from 'lucide-react'
import { MAX_NOTES_LENGTH } from '../checkoutConstants'
import type { PaymentMethod } from '../checkoutTypes'

interface CheckoutPaymentSelectorProps {
  paymentMethod: PaymentMethod
  onChangePaymentMethod: (method: PaymentMethod) => void
  notes: string
  onChangeNotes: (notes: string) => void
  disabled?: boolean
}

export const CheckoutPaymentSelector: React.FC<CheckoutPaymentSelectorProps> = ({
  paymentMethod,
  onChangePaymentMethod,
  notes,
  onChangeNotes,
  disabled = false,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-950 flex items-center gap-2 pb-3 border-b border-slate-100">
          <CreditCard className="w-5 h-5 text-red-600" />
          <span>Phương Thức Thanh Toán</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          {/* COD Option */}
          <label
            className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
              paymentMethod === 'COD'
                ? 'border-red-500 bg-red-50/30 ring-1 ring-red-500'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value="COD"
              checked={paymentMethod === 'COD'}
              onChange={() => onChangePaymentMethod('COD')}
              disabled={disabled}
              className="mt-1 text-red-600 focus:ring-red-500"
            />
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>Thanh toán khi nhận hàng (COD)</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Thanh toán bằng tiền mặt trực tiếp cho bưu tá khi nhận kiện hàng.
              </p>
            </div>
          </label>

          {/* Stripe Option */}
          <label
            className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
              paymentMethod === 'Stripe'
                ? 'border-red-500 bg-red-50/30 ring-1 ring-red-500'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <input
              type="radio"
              name="payment-method"
              value="Stripe"
              checked={paymentMethod === 'Stripe'}
              onChange={() => onChangePaymentMethod('Stripe')}
              disabled={disabled}
              className="mt-1 text-red-600 focus:ring-red-500"
            />
            <div className="space-y-1">
              <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Thẻ Quốc Tế (Stripe Test)</span>
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Chuyển tiếp bảo mật sang cổng Stripe Checkout để thanh toán bằng thẻ.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Order Notes Field */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label
            htmlFor="checkout-notes"
            className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>Ghi chú đơn hàng (Tùy chọn)</span>
          </label>
          <span
            className={`text-[11px] font-medium ${
              notes.length > MAX_NOTES_LENGTH ? 'text-rose-600' : 'text-slate-400'
            }`}
          >
            {notes.length} / {MAX_NOTES_LENGTH}
          </span>
        </div>

        <textarea
          id="checkout-notes"
          rows={3}
          maxLength={MAX_NOTES_LENGTH}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          disabled={disabled}
          placeholder="Ví dụ: Giao giờ hành chính, gọi điện trước khi đến..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all resize-none bg-slate-50/30 focus:bg-white"
        />
      </div>
    </div>
  )
}
