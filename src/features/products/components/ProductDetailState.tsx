import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, PackageX, RotateCcw } from 'lucide-react'
import type { ApiError } from '../../../lib/api'

export const ProductDetailSkeleton: React.FC = () => {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-pulse space-y-8"
    >
      {/* Breadcrumb Skeleton */}
      <div className="h-4 bg-slate-200 rounded w-48" />

      {/* Main 2-column Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Gallery Stage */}
        <div className="space-y-4">
          <div className="w-full aspect-square bg-slate-200 rounded-2xl" />
          <div className="flex gap-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-200 rounded-xl" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-200 rounded-xl" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-200 rounded-xl" />
          </div>
        </div>

        {/* Info Stage */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-28" />
            <div className="h-8 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-36" />
          </div>

          <div className="h-12 bg-slate-200 rounded-xl w-48" />

          <div className="space-y-3 pt-6 border-t border-slate-100">
            <div className="h-4 bg-slate-200 rounded w-full" />
            <div className="h-4 bg-slate-200 rounded w-2/3" />
          </div>
        </div>
      </div>

      {/* Specifications Skeleton */}
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  )
}

interface ProductDetailNotFoundProps {
  message?: string
}

export const ProductDetailNotFound: React.FC<ProductDetailNotFoundProps> = ({
  message = 'Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đã bị gỡ bỏ khỏi hệ thống.',
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
        <PackageX className="w-8 h-8 text-slate-400" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
        Không tìm thấy sản phẩm
      </h1>
      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
        {message}
      </p>

      <div className="flex justify-center">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh mục sản phẩm</span>
        </Link>
      </div>
    </div>
  )
}

interface ProductDetailErrorProps {
  error: ApiError | Error | null
  onRetry: () => void
}

export const ProductDetailError: React.FC<ProductDetailErrorProps> = ({
  error,
  onRetry,
}) => {
  const errorMessage =
    error && 'message' in error && error.message
      ? error.message
      : 'Không thể kết nối tới máy chủ hoặc đã xảy ra lỗi tải thông tin sản phẩm.'

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-600">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
        Đã xảy ra lỗi tải sản phẩm
      </h1>
      <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto mb-8 leading-relaxed">
        {errorMessage}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Thử lại</span>
        </button>

        <Link
          to="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về danh mục sản phẩm</span>
        </Link>
      </div>
    </div>
  )
}
