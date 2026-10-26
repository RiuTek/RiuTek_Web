import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Minus,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useCart } from '../CartContext'
import type { ProductDetail } from '../../products/productTypes'

interface ProductAddToCartProps {
  product: ProductDetail
}

export const ProductAddToCart: React.FC<ProductAddToCartProps> = ({ product }) => {
  const { status: authStatus, isAuthenticated, retryBootstrap } = useAuth()
  const { addItem, isMutating } = useCart()
  const location = useLocation()
  const navigate = useNavigate()

  const [quantity, setQuantity] = useState(1)
  const [prevProductId, setPrevProductId] = useState(product.id)

  // Reset quantity khi product.id thay đổi
  if (product.id !== prevProductId) {
    setPrevProductId(product.id)
    setQuantity(1)
  }

  const [isAdding, setIsAdding] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isOutOfStock = product.stockQuantity <= 0
  const isInactive = !product.isActive
  const isUnavailable = isInactive || isOutOfStock

  const maxQuantity = Math.min(99, Math.max(1, product.stockQuantity))

  const handleDecrease = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1)
      setSuccessMessage(null)
      setErrorMessage(null)
    }
  }

  const handleIncrease = () => {
    if (quantity < maxQuantity) {
      setQuantity((prev) => prev + 1)
      setSuccessMessage(null)
      setErrorMessage(null)
    }
  }

  const handleAddToCart = async () => {
    if (authStatus === 'checking') return

    // Nếu lỗi xác thực phiên, hiển thị thông báo thay vì coi như anonymous
    if (authStatus === 'unavailable') {
      return
    }

    // Nếu chưa đăng nhập, chuyển tới /login với return path an toàn
    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search
      navigate('/login', { state: { from: returnUrl } })
      return
    }

    if (isUnavailable || isAdding || isMutating) return

    setIsAdding(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      await addItem(product.id, quantity)
      setSuccessMessage(`Đã thêm ${quantity} sản phẩm vào giỏ hàng thành công!`)
    } catch (err) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Không thể thêm sản phẩm vào giỏ hàng. Vui lòng thử lại.')
      }
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Session Unavailable Alert */}
      {authStatus === 'unavailable' && (
        <div
          role="alert"
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Không thể xác thực phiên để kiểm tra giỏ hàng.</span>
          </div>
          <button
            type="button"
            onClick={retryBootstrap}
            className="inline-flex items-center gap-1 font-bold text-amber-900 hover:underline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Success Notification */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <Link
            to="/cart"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline whitespace-nowrap"
          >
            Xem giỏ hàng &rarr;
          </Link>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 shadow-xs"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Unavailable Explanation if Out of stock or Inactive */}
      {isUnavailable ? (
        <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 text-center space-y-1">
          <p className="text-sm font-bold text-slate-700">
            {isInactive
              ? 'Sản phẩm đã ngừng kinh doanh'
              : 'Sản phẩm tạm thời hết hàng'}
          </p>
          <p className="text-xs text-slate-500">
            Vui lòng quay lại sau hoặc tham khảo các linh kiện tương đương khác.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={quantity <= 1 || isAdding || isMutating}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Giảm số lượng mua"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="w-12 text-center text-sm font-bold text-slate-900 select-none"
                aria-label={`Số lượng: ${quantity}`}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={handleIncrease}
                disabled={quantity >= maxQuantity || isAdding || isMutating}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label="Tăng số lượng mua"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Main Add to Cart CTA */}
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding || isMutating || authStatus === 'checking'}
              className="flex-1 py-3 px-6 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang thêm vào giỏ...</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>Thêm Vào Giỏ Hàng</span>
                </>
              )}
            </button>
          </div>

          {!isAuthenticated && authStatus !== 'checking' && (
            <p className="text-[11px] text-slate-500 text-center">
              Bạn cần đăng nhập tài khoản để thêm và lưu sản phẩm trong giỏ hàng.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
