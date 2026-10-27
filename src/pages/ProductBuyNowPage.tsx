import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { useProductBuyNow } from '../features/buyNow/useProductBuyNow'
import { CheckoutAddressSelector } from '../features/checkout/components/CheckoutAddressSelector'
import { CheckoutPaymentSelector } from '../features/checkout/components/CheckoutPaymentSelector'
import { BuyNowProductSummary } from '../features/buyNow/components/BuyNowProductSummary'
import {
  ProductDetailSkeleton,
  ProductDetailNotFound,
  ProductDetailError,
} from '../features/products/components/ProductDetailState'

export const ProductBuyNowPage: React.FC = () => {
  const {
    slug,
    quantity,
    product,
    isProductLoading,
    productError,
    isProductNotFound,
    retryProduct,
    isProductUnavailable,
    isOutOfStock,
    isInactive,
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
    isSubmitting,
    submitError,
    canSubmit,
    handleBuyNowSubmit,
  } = useProductBuyNow()

  const handleRetryAddresses = () => {
    loadAddresses().catch(() => {})
  }

  if (isProductLoading) {
    return <ProductDetailSkeleton />
  }

  if (isProductNotFound) {
    return <ProductDetailNotFound />
  }

  if (productError || !product) {
    return <ProductDetailError error={productError} onRetry={retryProduct} />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="space-y-3 pb-4 border-b border-slate-200">
        <Link
          to={`/products/${encodeURIComponent(slug || product.slug)}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-red-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang sản phẩm</span>
        </Link>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Xác Nhận Đặt Mua Ngay
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Đặt hàng trực tiếp một sản phẩm nhanh chóng mà không cần thêm qua giỏ hàng.
          </p>
        </div>
      </div>

      {/* Unavailable Product Warning */}
      {isProductUnavailable && (
        <div
          role="alert"
          className="p-4 sm:p-5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs sm:text-sm space-y-2"
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              {isInactive
                ? 'Sản phẩm này hiện đã ngừng kinh doanh'
                : isOutOfStock
                ? 'Sản phẩm này tạm thời hết hàng'
                : 'Sản phẩm hiện không khả dụng để đặt mua'}
            </span>
          </div>
          <p className="text-amber-800">
            Vui lòng quay lại danh mục để lựa chọn các sản phẩm linh kiện tương đương khác.
          </p>
          <div className="pt-1">
            <Link
              to="/products"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <span>Xem các sản phẩm khác</span>
            </Link>
          </div>
        </div>
      )}

      {/* Main Checkout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Address + Payment */}
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
            disabled={isSubmitting || isProductUnavailable}
          />
        </div>

        {/* Right Sticky Column: Order Summary */}
        <div className="lg:col-span-5">
          <BuyNowProductSummary
            product={product}
            quantity={quantity}
            isSubmitting={isSubmitting}
            submitError={submitError}
            canSubmit={canSubmit}
            paymentMethod={paymentMethod}
            onSubmit={handleBuyNowSubmit}
          />
        </div>
      </div>
    </div>
  )
}
