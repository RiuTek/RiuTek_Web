import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Minus, Plus, Trash2, Package } from 'lucide-react'
import { formatVnd } from '../../products/productConstants'
import { getCartIssueLabel, type CartItemDto } from '../cartTypes'

interface CartItemRowProps {
  item: CartItemDto
  isMutating: boolean
  isSelected: boolean
  onToggleSelect: (productId: string) => void
  onUpdateQuantity: (productId: string, quantity: number) => Promise<void>
  onRemove: (productId: string) => Promise<void>
}

export const CartItemRow: React.FC<CartItemRowProps> = ({
  item,
  isMutating,
  isSelected,
  onToggleSelect,
  onUpdateQuantity,
  onRemove,
}) => {
  const [imageError, setImageError] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const canIncrease =
    item.isActive &&
    item.quantity < 99 &&
    item.quantity < item.stockQuantity &&
    !isMutating &&
    !isUpdating

  const canDecrease = item.quantity > 1 && !isMutating && !isUpdating

  const handleDecrease = async () => {
    if (!canDecrease) return
    setIsUpdating(true)
    try {
      await onUpdateQuantity(item.productId, item.quantity - 1)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleIncrease = async () => {
    if (!canIncrease) return
    setIsUpdating(true)
    try {
      await onUpdateQuantity(item.productId, item.quantity + 1)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemove = async () => {
    if (isMutating || isUpdating) return
    setIsUpdating(true)
    try {
      await onRemove(item.productId)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition-colors ${
        item.canPurchase
          ? 'bg-white border-slate-200 hover:border-slate-300'
          : 'bg-rose-50/40 border-rose-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Selection Checkbox */}
        <div className="flex items-center sm:self-center flex-shrink-0">
          <input
            type="checkbox"
            id={`cart-item-select-${item.productId}`}
            checked={isSelected}
            disabled={!item.canPurchase || isMutating}
            onChange={() => onToggleSelect(item.productId)}
            aria-label={`Chọn sản phẩm ${item.name} để thanh toán`}
            className="w-5 h-5 rounded border-slate-300 text-red-600 focus:ring-red-500 focus:ring-offset-0 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
          />
        </div>

        {/* Product Image */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-200 relative">
          {item.imageUrl && !imageError ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-contain p-1"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <Package className="w-8 h-8 text-slate-400" />
          )}
          {!item.canPurchase && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded">
                Lỗi
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              {item.slug ? (
                <Link
                  to={`/products/${encodeURIComponent(item.slug)}`}
                  className="text-sm sm:text-base font-bold text-slate-900 hover:text-red-600 transition-colors line-clamp-2"
                >
                  {item.name}
                </Link>
              ) : (
                <h4 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2">
                  {item.name}
                </h4>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span>SKU: {item.sku}</span>
                <span>•</span>
                <span>Tồn kho: {item.stockQuantity}</span>
              </div>
            </div>

            {/* Remove Button Desktop */}
            <button
              type="button"
              onClick={handleRemove}
              disabled={isMutating || isUpdating}
              className="hidden sm:inline-flex p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
              aria-label={`Xóa sản phẩm ${item.name} khỏi giỏ hàng`}
              title="Xóa sản phẩm"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Issue Alert if cannot purchase */}
          {!item.canPurchase && (
            <div
              role="alert"
              className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-semibold"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{getCartIssueLabel(item.issueCode)}</span>
            </div>
          )}

          {/* Unit Price & Line Total (Mobile/Tablet view) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">
                {formatVnd(item.unitPrice)}
              </span>
              <span className="text-xs text-slate-400">× {item.quantity}</span>
              <span className="text-sm font-extrabold text-red-600 ml-1">
                = {formatVnd(item.lineTotal)}
              </span>
            </div>

            {/* Quantity Controls & Mobile Delete */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={handleDecrease}
                  disabled={!canDecrease}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label={`Giảm số lượng của ${item.name}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span
                  className="w-9 text-center text-xs font-bold text-slate-900 select-none"
                  aria-label={`Số lượng hiện tại: ${item.quantity}`}
                >
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={!canIncrease}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                  aria-label={`Tăng số lượng của ${item.name}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mobile Remove Button */}
              <button
                type="button"
                onClick={handleRemove}
                disabled={isMutating || isUpdating}
                className="sm:hidden p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50"
                aria-label={`Xóa sản phẩm ${item.name} khỏi giỏ hàng`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
