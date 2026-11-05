import React from 'react'
import { AlertCircle, PackageSearch, RotateCcw } from 'lucide-react'
import { ApiError } from '../../../lib/api'

export const ProductGridSkeleton: React.FC = () => {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <span className="sr-only">Đang tải danh sách sản phẩm...</span>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 animate-pulse"
        >
          <div className="w-full aspect-square bg-slate-100 rounded-xl" />
          <div className="h-3 bg-slate-100 rounded-md w-1/3" />
          <div className="h-4 bg-slate-100 rounded-md w-4/5" />
          <div className="h-3 bg-slate-100 rounded-md w-1/2" />
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <div className="h-5 bg-slate-100 rounded-md w-2/5" />
            <div className="h-3 bg-slate-100 rounded-md w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface ProductGridErrorProps {
  error?: ApiError | Error | null
  title?: string
  message?: string
  actionLabel?: string
  onRetry: () => void
}

export const ProductGridError: React.FC<ProductGridErrorProps> = ({
  error,
  title,
  message,
  actionLabel = 'Thử Lại',
  onRetry,
}) => {
  const displayTitle = title || 'Không Thể Tải Dữ Liệu'
  const displayMessage =
    message ||
    (error instanceof ApiError
      ? error.message
      : error?.message || 'Không thể tải danh sách sản phẩm lúc này. Vui lòng thử lại.')

  return (
    <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-slate-900 mb-2">
        {displayTitle}
      </h3>
      <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
        {displayMessage}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{actionLabel}</span>
      </button>
    </div>
  )
}

interface ProductGridEmptyProps {
  hasActiveFilters: boolean
  onResetFilters: () => void
}

export const ProductGridEmpty: React.FC<ProductGridEmptyProps> = ({
  hasActiveFilters,
  onResetFilters,
}) => {
  return (
    <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 border border-slate-200 flex items-center justify-center mx-auto mb-4">
        <PackageSearch className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-slate-900 mb-2">
        {hasActiveFilters
          ? 'Chưa Có Sản Phẩm Phù Hợp'
          : 'Danh Mục Đang Được Cập Nhật'}
      </h3>

      <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
        {hasActiveFilters
          ? 'Chưa có sản phẩm phù hợp. Thử đổi bộ lọc hoặc xem tất cả linh kiện.'
          : 'Hiện tại chưa có sản phẩm nào trong danh mục này. Vui lòng quay lại sau.'}
      </p>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Xóa Bộ Lọc</span>
        </button>
      )}
    </div>
  )
}
