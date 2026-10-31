import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Package,
  CheckCircle2,
} from 'lucide-react'
import { formatVnd } from '../features/products/productConstants'
import { useCart } from '../features/cart/CartContext'
import { CartItemRow } from '../features/cart/components/CartItemRow'

export const CartPage: React.FC = () => {
  const {
    cart,
    status,
    error,
    isMutating,
    itemCount,
    loadCart,
    setQuantity,
    removeItem,
    clearCart,
    toggleSelectProduct,
    toggleSelectAll,
    isProductSelected,
    selectedTotals,
    prunedNotification,
    clearPrunedNotification,
  } = useCart()

  const [confirmingClear, setConfirmingClear] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const selectAllInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (selectAllInputRef.current) {
      selectAllInputRef.current.indeterminate = selectedTotals.isIndeterminate
    }
  }, [selectedTotals.isIndeterminate])

  const handleRetryLoad = async () => {
    try {
      await loadCart()
    } catch {
      // Lỗi đã được ghi nhận vào state error/status của Cart Provider
    }
  }

  const handleUpdateQuantity = async (productId: string, quantity: number) => {
    setActionError(null)
    try {
      await setQuantity(productId, quantity)
    } catch (err) {
      if (err instanceof Error) {
        setActionError(err.message)
      }
    }
  }

  const handleRemoveItem = async (productId: string) => {
    setActionError(null)
    try {
      await removeItem(productId)
    } catch (err) {
      if (err instanceof Error) {
        setActionError(err.message)
      }
    }
  }

  const handleClearCart = async () => {
    setActionError(null)
    try {
      await clearCart()
      setConfirmingClear(false)
    } catch (err) {
      if (err instanceof Error) {
        setActionError(err.message)
      }
    }
  }

  // 1. Loading State
  if (status === 'loading' && !cart) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-9 h-9 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-700">Đang tải giỏ hàng...</p>
        <p className="text-xs text-slate-400 mt-1">Vui lòng chờ trong giây lát.</p>
      </div>
    )
  }

  // 2. Error State (Initial load error)
  if (status === 'error' && !cart) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Không thể tải giỏ hàng</h2>
        <p className="text-xs sm:text-sm text-slate-600">
          {error ?? 'Đã xảy ra sự cố kết nối tới máy chủ. Vui lòng thử lại.'}
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={handleRetryLoad}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    )
  }

  // 3. Empty Cart State
  const hasItems = cart && cart.items && cart.items.length > 0
  if (!hasItems) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-5">
        <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          <ShoppingCart className="w-10 h-10" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
            Giỏ Hàng Của Bạn Đang Trống
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            Khám phá các linh kiện máy tính và lựa chọn sản phẩm phù hợp với cấu hình của bạn.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-red-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <Package className="w-4 h-4" />
            <span>Tiếp Tục Mua Sắm</span>
          </Link>
        </div>
      </div>
    )
  }

  // 4. Cart Has Items
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Giỏ Hàng
            </h1>
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100">
              {itemCount} sản phẩm
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Kiểm tra các linh kiện phần cứng đã chọn trước khi tiếp tục.
          </p>
        </div>

        {/* Clear Cart Button / Confirmation */}
        <div>
          {confirmingClear ? (
            <div className="flex items-center gap-2 p-1 bg-rose-50 border border-rose-200 rounded-xl">
              <span className="text-xs font-semibold text-rose-800 px-2">
                Xóa tất cả?
              </span>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={isMutating}
                className="px-2.5 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                Xác nhận
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                disabled={isMutating}
                className="px-2.5 py-1 bg-white text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              disabled={isMutating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-slate-200 hover:border-rose-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa Giỏ Hàng</span>
            </button>
          )}
        </div>
      </div>

      {/* Pruned Notification Alert */}
      {prunedNotification && (
        <div
          role="status"
          className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm rounded-2xl flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>{prunedNotification}</span>
          </div>
          <button
            type="button"
            onClick={clearPrunedNotification}
            className="text-xs font-bold text-amber-800 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Action / Conflict Error Alert */}
      {actionError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-xs font-bold text-rose-700 hover:underline"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main Grid: Item List & Order Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Items Column */}
        <div className="lg:col-span-8 space-y-3">
          {/* Select All Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                ref={selectAllInputRef}
                type="checkbox"
                checked={selectedTotals.isAllSelected}
                disabled={isMutating || cart.items.filter((i) => i.canPurchase).length === 0}
                onChange={toggleSelectAll}
                aria-label="Chọn tất cả sản phẩm có thể mua"
                className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 focus:ring-offset-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                Chọn tất cả ({cart.items.filter((i) => i.canPurchase).length} sản phẩm khả dụng)
              </span>
            </label>
            {selectedTotals.selectedLineCount > 0 && (
              <span className="text-xs font-semibold text-slate-500">
                Đã chọn {selectedTotals.selectedLineCount} dòng / {selectedTotals.selectedItemCount} sản phẩm
              </span>
            )}
          </div>

          {cart.items.map((item) => (
            <CartItemRow
              key={item.productId}
              item={item}
              isMutating={isMutating}
              isSelected={isProductSelected(item.productId)}
              onToggleSelect={toggleSelectProduct}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemoveItem}
            />
          ))}

          {/* Safe Link Back to Products */}
          <div className="pt-4">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tiếp tục chọn thêm linh kiện</span>
            </Link>
          </div>
        </div>

        {/* Summary Column */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5 sticky top-28">
            <h3 className="text-base font-bold text-slate-950 pb-3 border-b border-slate-100">
              Tổng Quan Đơn Hàng
            </h3>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span>Đã chọn:</span>
                <span className="font-semibold text-slate-900">
                  {selectedTotals.selectedLineCount} dòng / {selectedTotals.selectedItemCount} sản phẩm
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Tạm tính các món đã chọn:</span>
                <span className="font-bold text-slate-900">
                  {formatVnd(selectedTotals.selectedSubtotal)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
              <div>
                <span className="text-sm font-extrabold text-slate-950">Tổng tiền</span>
                <p className="text-[10px] text-slate-400">Tạm tính theo các sản phẩm đã chọn</p>
              </div>
              <span className="text-xl sm:text-2xl font-black text-red-600">
                {formatVnd(selectedTotals.selectedSubtotal)}
              </span>
            </div>

            {/* Warning if no selection or error */}
            {selectedTotals.selectedLineCount === 0 ? (
              <div
                role="status"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-center gap-2"
              >
                <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>Vui lòng chọn ít nhất 1 sản phẩm để tiến hành thanh toán.</span>
              </div>
            ) : !selectedTotals.canCheckoutSelected ? (
              <div
                role="alert"
                className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1"
              >
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Chưa thể thanh toán lựa chọn này</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Một trong các sản phẩm bạn chọn hiện không đủ điều kiện mua. Vui lòng bỏ chọn sản phẩm đó.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="font-semibold">
                  {selectedTotals.selectedLineCount} sản phẩm đã chọn sẵn sàng để thanh toán.
                </span>
              </div>
            )}

            {/* Checkout CTA */}
            {selectedTotals.canCheckoutSelected ? (
              <Link
                to="/checkout"
                className="w-full py-3.5 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm sm:text-base font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span>Tiến Hành Thanh Toán ({selectedTotals.selectedLineCount})</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="w-full py-3.5 px-6 bg-slate-200 text-slate-400 rounded-2xl text-sm sm:text-base font-bold cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>Tiến Hành Thanh Toán</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
