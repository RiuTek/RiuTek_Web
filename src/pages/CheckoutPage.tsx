import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, AlertTriangle } from 'lucide-react'
import { useCartCheckout } from '../features/checkout/useCartCheckout'
import { CheckoutAddressSelector } from '../features/checkout/components/CheckoutAddressSelector'
import { CheckoutPaymentSelector } from '../features/checkout/components/CheckoutPaymentSelector'
import { CheckoutOrderSummary } from '../features/checkout/components/CheckoutOrderSummary'

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    selectedProductIds,
    activeAttempt,
    canCreate,
    canReplay,
    blocker,
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
    handleRetryStorageAndRedirect,
  } = useCartCheckout()

  const handleRetryAddresses = () => {
    loadAddresses().catch(() => {
      // Lỗi được lưu và hiển thị trong AddressContext
    })
  }

  // 1. Nếu không có active attempt và giỏ hàng rỗng
  if (!activeAttempt && cart && cart.items.length === 0) {
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

  // 2. Nếu không có active attempt và không có sản phẩm nào được chọn
  if (!activeAttempt && selectedProductIds.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 flex items-center justify-center mx-auto text-amber-600">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">
            Chưa Chọn Sản Phẩm Nào Để Thanh Toán
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            Bạn chưa chọn sản phẩm nào từ giỏ hàng để tiến hành thanh toán. Hãy quay lại giỏ hàng và chọn các món bạn muốn mua nhé!
          </p>
        </div>
        <div>
          <Link
            to="/cart"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay Lại Giỏ Hàng</span>
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
          Vui lòng kiểm tra địa chỉ nhận hàng, phương thức thanh toán và danh mục linh kiện đã chọn ({selectedProductIds.length} sản phẩm).
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
            onRetry={handleRetryAddresses}
          />

          <CheckoutPaymentSelector
            paymentMethod={paymentMethod}
            onChangePaymentMethod={setPaymentMethod}
            notes={notes}
            onChangeNotes={setNotes}
            disabled={isSubmitting || Boolean(activeAttempt)}
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
            attemptStatus={activeAttempt?.status ?? 'idle'}
            unresolvedMessage={activeAttempt?.unresolvedMessage}
            knownOrder={activeAttempt?.knownOrder}
            paymentMethod={paymentMethod}
            canCreateNew={canCreate}
            canReplay={canReplay}
            onSubmit={async () => {
              await handleCheckout()
            }}
            onRetryQuote={refetchQuote}
            onRetryStorageAndRedirect={handleRetryStorageAndRedirect}
          />
        </div>
      </div>

      {/* Blocker Modal when attempt is active/unresolved */}
      {blocker.state === 'blocked' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-leave-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3
                  id="confirm-leave-title"
                  className="text-base font-bold text-slate-900"
                >
                  Xác nhận rời khỏi trang
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Giao dịch đặt hàng của bạn hiện chưa xác định xong kết quả từ máy chủ hoặc đơn hàng đang được xử lý.
                </p>
                <p className="text-xs text-amber-800 font-medium">
                  Nếu tiếp tục rời trang, vui lòng kiểm tra danh sách <strong>"Đơn hàng của tôi"</strong> trước khi đặt mua lại để tránh bị tạo 2 đơn.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Ở lại trang này
              </button>
              <button
                type="button"
                onClick={() => blocker.proceed()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Rời khỏi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
