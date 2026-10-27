import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  RotateCcw,
  Package,
  Plus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { getProducts } from '../../products/productApi'
import { COMPONENT_TYPE_LABELS, formatVnd } from '../../products/productConstants'
import type { ComponentType, ProductSummary } from '../../products/productTypes'
import { isSingleChoiceComponent } from '../pcBuilderConstants'

interface PCBuilderProductPickerProps {
  activeSlot: ComponentType
  onSelectProduct: (product: ProductSummary) => void
  onClose?: () => void
  selectedItemIds: Set<string>
}

interface ProductPickerImageProps {
  url: string | null
  alt: string
}

const ProductPickerImage: React.FC<ProductPickerImageProps> = ({ url, alt }) => {
  const [hasError, setHasError] = useState(false)

  if (!url || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
        <Package className="w-8 h-8" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-contain p-2"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export const PCBuilderProductPicker: React.FC<PCBuilderProductPickerProps> = ({
  activeSlot,
  onSelectProduct,
  onClose,
  selectedItemIds,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(1)
  const pageSize = 12

  const [products, setProducts] = useState<ProductSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const requestKey = `${activeSlot}|${debouncedSearch}|${pageIndex}|${retryTrigger}`
  const isLoading = completedKey !== requestKey

  // Debounce search term 350ms
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val.trim())
      setPageIndex(1)
    }, 350)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setDebouncedSearch('')
    setPageIndex(1)
  }

  // Fetch products qua useEffect với AbortController
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const currentKey = requestKey
    getProducts(
      {
        componentType: activeSlot,
        pageIndex,
        pageSize,
        searchTerm: debouncedSearch || undefined,
      },
      controller.signal
    )
      .then((res) => {
        setProducts(res.items)
        setTotalCount(res.totalCount)
        setTotalPages(Math.max(1, Math.ceil(res.totalCount / pageSize)))
        setError(null)
        setCompletedKey(currentKey)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        setError('Không thể tải danh sách sản phẩm. Vui lòng thử lại.')
        setCompletedKey(currentKey)
      })

    return () => {
      controller.abort()
    }
  }, [activeSlot, pageIndex, pageSize, debouncedSearch, requestKey])

  const slotTitle = COMPONENT_TYPE_LABELS[activeSlot] || 'Linh kiện'
  const isSingle = isSingleChoiceComponent(activeSlot)

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
            Chọn linh kiện
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-950 flex items-center gap-2">
            <span>{slotTitle}</span>
            {!isLoading && (
              <span className="text-xs font-normal text-slate-400">
                ({totalCount} sản phẩm)
              </span>
            )}
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            title="Đóng bảng chọn"
            aria-label="Đóng bảng chọn linh kiện"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <label htmlFor="pc-builder-product-search" className="sr-only">
          Tìm kiếm sản phẩm trong nhóm này
        </label>
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          id="pc-builder-product-search"
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder={`Tìm kiếm trong ${slotTitle}...`}
          className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            aria-label="Xóa nội dung tìm kiếm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-16 text-center space-y-3" aria-busy="true">
          <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
          <p className="text-xs sm:text-sm text-slate-500">
            Đang tải danh sách linh kiện...
          </p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="p-6 text-center space-y-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800"
        >
          <p className="text-xs sm:text-sm font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => setRetryTrigger((r) => r + 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="py-12 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            Không tìm thấy linh kiện phù hợp
          </p>
          <p className="text-xs text-slate-400">
            Hãy thử tìm bằng từ khóa khác hoặc xóa bộ lọc tìm kiếm.
          </p>
        </div>
      ) : (
        /* Products Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {products.map((product) => {
            const isSelected = selectedItemIds.has(product.id)
            const isUnavailable = !product.isActive || product.stockQuantity <= 0

            return (
              <div
                key={product.id}
                className={`flex flex-col justify-between p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400/40'
                    : isUnavailable
                    ? 'border-slate-200 bg-slate-50/60 opacity-70'
                    : 'border-slate-200/90 hover:border-slate-300 bg-white hover:shadow-xs'
                }`}
              >
                <div className="space-y-3">
                  {/* Thumbnail */}
                  <div className="w-full aspect-square max-h-36 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                    <ProductPickerImage
                      key={product.imageUrl ?? product.id}
                      url={product.imageUrl}
                      alt={product.name}
                    />
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                      <span>{product.brand}</span>
                      <span>SKU: {product.sku}</span>
                    </div>

                    <h3
                      className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug"
                      title={product.name}
                    >
                      {product.name}
                    </h3>

                    {/* Stock Status Tag */}
                    <div className="pt-0.5">
                      {!product.isActive ? (
                        <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                          Ngừng kinh doanh
                        </span>
                      ) : product.stockQuantity <= 0 ? (
                        <span className="inline-block text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                          Tạm hết hàng
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Còn hàng ({product.stockQuantity})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Price and CTA */}
                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Đơn giá</span>
                    <span className="text-xs sm:text-sm font-black text-slate-950">
                      {formatVnd(product.price)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isUnavailable}
                    onClick={() => onSelectProduct(product)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs ${
                      isUnavailable
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : isSelected && isSingle
                        ? 'bg-slate-900 hover:bg-slate-800 text-white'
                        : isSelected
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    {isUnavailable ? (
                      <span>Hết hàng</span>
                    ) : isSelected && isSingle ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã chọn</span>
                      </>
                    ) : isSelected ? (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm tiếp</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Chọn</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && totalPages > 1 && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm">
          <button
            type="button"
            disabled={pageIndex <= 1}
            onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Trang trước</span>
          </button>

          <span className="text-xs text-slate-500 font-medium">
            Trang <span className="font-bold text-slate-900">{pageIndex}</span> / {totalPages}
          </span>

          <button
            type="button"
            disabled={pageIndex >= totalPages}
            onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <span>Trang sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
