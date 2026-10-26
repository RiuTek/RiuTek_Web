import React, { useState } from 'react'
import { Package, ImageOff } from 'lucide-react'
import { formatVnd } from '../productConstants'
import type { ProductSummary } from '../productTypes'

interface ProductCardProps {
  product: ProductSummary
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const [imgError, setImgError] = useState(false)

  // Status Precedence theo Section 8:
  // 1. isActive == false -> Ngừng kinh doanh
  // 2. active & stockQuantity <= 0 -> Tạm hết hàng
  // 3. active & stockQuantity > 0 -> Còn hàng
  let statusBadge: { label: string; className: string }
  if (!product.isActive) {
    statusBadge = {
      label: 'Ngừng kinh doanh',
      className: 'bg-slate-100 text-slate-700 border-slate-300',
    }
  } else if (product.stockQuantity <= 0) {
    statusBadge = {
      label: 'Tạm hết hàng',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    }
  } else {
    statusBadge = {
      label: 'Còn hàng',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }
  }

  const hasDiscount =
    product.originalPrice !== null && product.originalPrice > product.price

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-red-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
      {/* Product Image Stage */}
      <div className="p-4 pb-0">
        <div className="relative w-full aspect-square bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-100">
          {product.imageUrl && !imgError ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <ImageOff className="w-8 h-8 mb-1.5 text-slate-300" />
              <span className="text-xs">Chưa có hình ảnh</span>
            </div>
          )}

          {/* Status Badge */}
          <span
            className={`absolute top-2.5 left-2.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-xs ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1 gap-2">
            <span className="font-semibold text-red-600 uppercase tracking-wider truncate">
              {product.brand}
            </span>
            <span className="text-[11px] text-slate-400 truncate">
              {product.categoryName}
            </span>
          </div>

          <h3
            className="text-sm font-bold text-slate-900 group-hover:text-red-600 transition-colors line-clamp-2 mb-1.5 leading-snug"
            title={product.name}
          >
            {product.name}
          </h3>

          <div className="text-[11px] text-slate-500 font-mono mb-3">
            SKU: {product.sku}
          </div>
        </div>

        {/* Pricing */}
        <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between gap-2">
          <div>
            <div className="text-base font-extrabold text-slate-950 font-mono">
              {formatVnd(product.price)}
            </div>
            {hasDiscount && (
              <div className="text-xs text-slate-400 line-through font-mono">
                {formatVnd(product.originalPrice!)}
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            <span>Kho: {product.stockQuantity}</span>
          </div>
        </div>
      </div>
    </article>
  )
}
