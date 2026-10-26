import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Package, Tag } from 'lucide-react'
import { formatVnd } from '../features/products/productConstants'
import { useProductDetail } from '../features/products/useProductDetail'
import { ProductGallery } from '../features/products/components/ProductGallery'
import { ProductSpecificationTable } from '../features/products/components/ProductSpecificationTable'
import {
  ProductDetailError,
  ProductDetailNotFound,
  ProductDetailSkeleton,
} from '../features/products/components/ProductDetailState'

export const ProductDetailPage: React.FC = () => {
  const { product, isLoading, error, isNotFound, retry } = useProductDetail()

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (isNotFound) {
    return <ProductDetailNotFound />
  }

  if (error || !product) {
    return <ProductDetailError error={error} onRetry={retry} />
  }

  // Status Precedence theo Section 9:
  // 1. isActive === false -> Ngừng kinh doanh
  // 2. active và stockQuantity <= 0 -> Tạm hết hàng
  // 3. active và stockQuantity > 0 -> Còn hàng
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
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8 sm:space-y-12">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap pb-1">
        <Link to="/" className="hover:text-slate-900 transition-colors">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <Link to="/products" className="hover:text-slate-900 transition-colors">
          Sản phẩm
        </Link>
        {product.categoryName && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-600 truncate">{product.categoryName}</span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-md">
          {product.name}
        </span>
      </nav>

      {/* Main Top Section: Gallery (Left) + Information (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Left: Product Gallery */}
        <section aria-label="Hình ảnh sản phẩm">
          <ProductGallery
            key={product.id}
            productName={product.name}
            imageUrl={product.imageUrl}
            additionalImages={product.additionalImages}
          />
        </section>

        {/* Right: Product Key Information */}
        <section aria-label="Thông tin sản phẩm" className="space-y-6">
          {/* Category & Brand */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {product.brand && (
              <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 font-bold tracking-wider uppercase">
                {product.brand}
              </span>
            )}
            {product.categoryName && (
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                {product.categoryName}
              </span>
            )}
          </div>

          {/* Product Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight leading-tight mb-2">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono">
              <span>SKU: {product.sku}</span>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
                <span className="text-slate-500 font-sans flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kho: {product.stockQuantity}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="text-xs text-slate-500 font-medium">Giá niêm yết:</div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-mono">
                {formatVnd(product.price)}
              </span>
              {hasDiscount && (
                <span className="text-sm sm:text-base text-slate-400 line-through font-mono">
                  {formatVnd(product.originalPrice!)}
                </span>
              )}
            </div>
          </div>

          {/* Business Info / Status Banner */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-600 flex items-start gap-3">
            <Tag className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-slate-800">Thông tin sản phẩm</p>
              <p className="mt-0.5 text-slate-500 leading-relaxed">
                Thông số sản phẩm, giá bán và tình trạng kho được cập nhật từ hệ thống RiuTek.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Specifications Detailed Section */}
      <ProductSpecificationTable specifications={product.specifications} />
    </div>
  )
}
