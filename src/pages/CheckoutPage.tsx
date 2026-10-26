import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { useCartCheckout } from '../features/checkout/useCartCheckout'
import { CheckoutAddressSelector } from '../features/checkout/components/CheckoutAddressSelector'
import { CheckoutPaymentSelector } from '../features/checkout/components/CheckoutPaymentSelector'
import { CheckoutOrderSummary } from '../features/checkout/components/CheckoutOrderSummary'

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    addresses,
    addressStatus,
    addressError,
    loadAddresses,
    selectedAddressId,
    setSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    quote,
    quoteStatus,
    quoteError,
    refetchQuote,
    isSubmitting,
    submitError,
    handleCheckout,
  } = useCartCheckout()

  // Nếu giỏ hàng rỗng, hiển thị empty state
  if (cart && cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">
            Giỏ Hàng Đang Trống
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Bạn chưa có linh kiện nào trong giỏ hàng để tiến hành thanh toán. Hãy chọn thêm sản phẩm nhé!
          </p>
        </div>
        <div>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Khám Phá Sản Phẩm Ngay</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header & Breadcrumbs */}
      <div className="space-y-2 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Link to="/cart" className="hover:text-red-600 transition-colors">
            Giỏ hàng
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold">Thanh toán đơn hàng</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
          Xác Nhận & Đặt Hàng
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Vui lòng kiểm tra địa chỉ nhận hàng, phương thức thanh toán và danh mục linh kiện.
        </p>
      </div>

      {/* Main Checkout Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Address & Payment Selection */}
        <div className="lg:col-span-7 space-y-6">
          <CheckoutAddressSelector
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            isLoading={addressStatus === 'loading'}
            error={addressError}
            onRetry={loadAddresses}
          />

          <CheckoutPaymentSelector
            paymentMethod={paymentMethod}
            onChangePaymentMethod={setPaymentMethod}
            notes={notes}
            onChangeNotes={setNotes}
            disabled={isSubmitting}
          />
        </div>

        {/* Right Column: Order Summary & Place Order */}
        <div className="lg:col-span-5">
          <CheckoutOrderSummary
            quote={quote}
            quoteStatus={quoteStatus}
            quoteError={quoteError}
            hasAddress={selectedAddressId !== null}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={async () => {
              await handleCheckout()
            }}
            onRetryQuote={refetchQuote}
          />
        </div>
      </div>
    </div>
  )
}
