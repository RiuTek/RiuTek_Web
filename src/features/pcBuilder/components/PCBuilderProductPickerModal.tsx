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
  SlidersHorizontal,
  DollarSign,
  ArrowUpDown,
} from 'lucide-react'
import { getProducts } from '../../products/productApi'
import {
  COMPONENT_TYPE_LABELS,
  SORT_OPTION_LABELS,
  formatVnd,
} from '../../products/productConstants'
import {
  ComponentType,
  ProductSortOption,
  type ProductSummary,
} from '../../products/productTypes'
import {
  isSingleChoiceComponent,
  MAX_MULTI_CHOICE_QUANTITY,
} from '../pcBuilderConstants'
import type { SelectedPCBuildItem } from '../pcBuilderTypes'

interface PCBuilderProductPickerModalProps {
  activeSlot: ComponentType
  onSelectProduct: (product: ProductSummary) => void
  onClose: () => void
  selectedItems: SelectedPCBuildItem[]
}

interface ProductPickerImageProps {
  url: string | null
  alt: string
}

const ProductPickerImage: React.FC<ProductPickerImageProps> = ({ url, alt }) => {
  const [hasError, setHasError] = useState(false)

  if (!url || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
        <Package className="w-6 h-6" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-contain p-1"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export const PCBuilderProductPickerModal: React.FC<PCBuilderProductPickerModalProps> = ({
  activeSlot,
  onSelectProduct,
  onClose,
  selectedItems,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState<ProductSortOption>(ProductSortOption.Newest)
  const [inStockFilter, setInStockFilter] = useState<'all' | 'true' | 'false'>('all')
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'true' | 'false'>('all')
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')

  // Pagination states
  const [pageIndex, setPageIndex] = useState(1)
  const pageSize = 12

  // Server response states
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Mobile filter collapse toggle
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Async tracking guards
  const activeFetchIdRef = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Map quantity của các linh kiện đã chọn
  const selectedQuantityMap = new Map<string, number>()
  selectedItems.forEach((item) => {
    selectedQuantityMap.set(item.product.id, item.quantity)
  })

  // Native <dialog> lifecycle & body scroll lock
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus search input on open
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

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

  // Validate price range
  const parsedMinPrice = minPriceInput ? Math.max(0, parseInt(minPriceInput, 10) || 0) : undefined
  const parsedMaxPrice = maxPriceInput ? Math.max(0, parseInt(maxPriceInput, 10) || 0) : undefined

  const priceValidationError =
    parsedMinPrice !== undefined &&
    parsedMaxPrice !== undefined &&
    parsedMinPrice > parsedMaxPrice
      ? 'Giá tối thiểu không được lớn hơn giá tối đa.'
      : null

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('')
    setDebouncedSearch('')
    setSortBy(ProductSortOption.Newest)
    setInStockFilter('all')
    setIsActiveFilter('all')
    setMinPriceInput('')
    setMaxPriceInput('')
    setPageIndex(1)
  }

  // Current request key to derive loading state synchronously
  const requestKey = `${activeSlot}|${debouncedSearch}|${sortBy}|${inStockFilter}|${isActiveFilter}|${parsedMinPrice}|${parsedMaxPrice}|${pageIndex}|${retryTrigger}`
  const isLoading = completedKey !== requestKey

  // Fetch products with latest-request guard
  useEffect(() => {
    // Không gửi request nếu khoảng giá không hợp lệ
    if (
      parsedMinPrice !== undefined &&
      parsedMaxPrice !== undefined &&
      parsedMinPrice > parsedMaxPrice
    ) {
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const fetchId = ++activeFetchIdRef.current
    const currentKey = requestKey

    getProducts(
      {
        componentType: activeSlot,
        pageIndex,
        pageSize,
        searchTerm: debouncedSearch || undefined,
        sortBy,
        inStock:
          inStockFilter === 'true' ? true : inStockFilter === 'false' ? false : undefined,
        isActive:
          isActiveFilter === 'true' ? true : isActiveFilter === 'false' ? false : undefined,
        minPrice: parsedMinPrice,
        maxPrice: parsedMaxPrice,
      },
      controller.signal
    )
      .then((res) => {
        if (activeFetchIdRef.current !== fetchId || controller.signal.aborted) {
          return
        }
        setProducts(res.items)
        setTotalCount(res.totalCount)
        setTotalPages(res.totalPages || Math.max(1, Math.ceil(res.totalCount / pageSize)))
        setError(null)
        setCompletedKey(currentKey)
      })
      .catch((err: unknown) => {
        if (
          controller.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError') ||
          activeFetchIdRef.current !== fetchId
        ) {
          return
        }
        setError('Không thể tải danh sách sản phẩm. Vui lòng thử lại.')
        setCompletedKey(currentKey)
      })

    return () => {
      controller.abort()
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [
    activeSlot,
    pageIndex,
    pageSize,
    debouncedSearch,
    sortBy,
    inStockFilter,
    isActiveFilter,
    parsedMinPrice,
    parsedMaxPrice,
    requestKey,
  ])

  const slotTitle = COMPONENT_TYPE_LABELS[activeSlot] || 'Linh kiện'
  const isSingle = isSingleChoiceComponent(activeSlot)

  // Handle product selection
  const handleSelect = (product: ProductSummary) => {
    onSelectProduct(product)
    if (isSingle) {
      onClose() // Single choice đóng modal sau khi chọn
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Backdrop click detector
        if (e.target === dialogRef.current) {
          onClose()
        }
      }}
      className="backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs p-0 bg-transparent rounded-3xl shadow-2xl max-w-6xl w-[95vw] h-[90vh] max-h-[850px] overflow-hidden m-auto border border-slate-200/80 focus:outline-none"
    >
      <div className="bg-white w-full h-full flex flex-col overflow-hidden text-slate-900">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">
                Chọn linh kiện cấu hình
              </div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                <span>{slotTitle}</span>
                {!isLoading && (
                  <span className="text-xs font-normal text-slate-400">
                    ({totalCount} sản phẩm khả dụng)
                  </span>
                )}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            aria-label="Đóng bảng chọn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Top Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={`Tìm kiếm theo tên, SKU, hãng trong ${slotTitle}...`}
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs"
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

          {/* Sort Selector & Mobile Filter Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobileFilters((prev) => !prev)}
              className="sm:hidden px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Bộ lọc</span>
            </button>

            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <label htmlFor="pc-picker-sort" className="sr-only">
                Sắp xếp theo
              </label>
              <select
                id="pc-picker-sort"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(Number(e.target.value) as ProductSortOption)
                  setPageIndex(1)
                }}
                className="text-xs font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                {Object.entries(SORT_OPTION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Center Layout: Filters Sidebar + Products List */}
        <div className="flex-1 flex overflow-hidden">
          {/* Filters Sidebar */}
          <div
            className={`w-full sm:w-64 bg-slate-50/80 border-r border-slate-200 p-4 space-y-5 overflow-y-auto flex-shrink-0 ${
              showMobileFilters ? 'block' : 'hidden sm:block'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-red-600" />
                <span>Bộ Lọc Server</span>
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 underline"
              >
                Đặt lại
              </button>
            </div>

            {/* Filter: Tình trạng tồn kho */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Tình trạng tồn kho
              </label>
              <div className="space-y-1 text-xs">
                {[
                  { id: 'all', label: 'Tất cả trạng thái' },
                  { id: 'true', label: 'Chỉ sản phẩm còn hàng' },
                  { id: 'false', label: 'Sản phẩm tạm hết hàng' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900"
                  >
                    <input
                      type="radio"
                      name="filter-stock"
                      value={opt.id}
                      checked={inStockFilter === opt.id}
                      onChange={() => {
                        setInStockFilter(opt.id as 'all' | 'true' | 'false')
                        setPageIndex(1)
                      }}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter: Trạng thái kinh doanh */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Trạng thái kinh doanh
              </label>
              <div className="space-y-1 text-xs">
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'true', label: 'Đang kinh doanh' },
                  { id: 'false', label: 'Đã ngừng kinh doanh' },
                ].map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-slate-900"
                  >
                    <input
                      type="radio"
                      name="filter-active"
                      value={opt.id}
                      checked={isActiveFilter === opt.id}
                      onChange={() => {
                        setIsActiveFilter(opt.id as 'all' | 'true' | 'false')
                        setPageIndex(1)
                      }}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Filter: Khoảng giá */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>Khoảng giá (VNĐ)</span>
              </label>
              <div className="space-y-2">
                <input
                  type="number"
                  min="0"
                  step="100000"
                  placeholder="Giá tối thiểu..."
                  value={minPriceInput}
                  onChange={(e) => {
                    setMinPriceInput(e.target.value)
                    setPageIndex(1)
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <input
                  type="number"
                  min="0"
                  step="100000"
                  placeholder="Giá tối đa..."
                  value={maxPriceInput}
                  onChange={(e) => {
                    setMaxPriceInput(e.target.value)
                    setPageIndex(1)
                  }}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                {priceValidationError && (
                  <p className="text-[11px] font-semibold text-rose-600">
                    {priceValidationError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Product Listing Main Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {isLoading ? (
              <div className="py-24 text-center space-y-3" aria-busy="true">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin mx-auto" />
                <p className="text-xs sm:text-sm text-slate-500">
                  Đang tải danh sách linh kiện...
                </p>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="p-8 text-center space-y-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800"
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
              <div className="py-20 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-100">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-700">
                  Không tìm thấy linh kiện phù hợp với bộ lọc
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Hãy thử nới lỏng các điều kiện lọc giá, trạng thái tồn kho hoặc xóa từ khóa tìm kiếm.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                >
                  Thiết lập lại bộ lọc
                </button>
              </div>
            ) : (
              /* Products List Rows/Cards */
              <div className="space-y-3">
                {products.map((product) => {
                  const currentQuantity = selectedQuantityMap.get(product.id) || 0
                  const isSelected = currentQuantity > 0
                  const isMaxedOut = isSelected && currentQuantity >= MAX_MULTI_CHOICE_QUANTITY
                  const isUnavailable = !product.isActive || product.stockQuantity <= 0

                  return (
                    <div
                      key={product.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                        isSelected
                          ? 'border-red-400 bg-red-50/20 ring-1 ring-red-400/40'
                          : isUnavailable
                          ? 'border-slate-200 bg-slate-50/70 opacity-75'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                      }`}
                    >
                      {/* Product Thumbnail & Details */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <ProductPickerImage
                            key={product.imageUrl ?? product.id}
                            url={product.imageUrl}
                            alt={product.name}
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="font-semibold text-slate-600">
                              {product.brand}
                            </span>
                            <span>•</span>
                            <span>SKU: {product.sku}</span>
                          </div>

                          <h3
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                            title={product.name}
                          >
                            {product.name}
                          </h3>

                          {/* Status & Stock Badges */}
                          <div className="flex items-center gap-2">
                            {!product.isActive ? (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                Ngừng kinh doanh
                              </span>
                            ) : product.stockQuantity <= 0 ? (
                              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                Tạm hết hàng
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                Còn hàng ({product.stockQuantity})
                              </span>
                            )}

                            {isSelected && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                                Đã chọn: {currentQuantity}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Price & Action Button */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block">Đơn giá</span>
                          <span className="text-sm sm:text-base font-black text-slate-950">
                            {formatVnd(product.price)}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isUnavailable || (isSingle && isSelected) || isMaxedOut}
                          onClick={() => handleSelect(product)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap ${
                            isUnavailable
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : isSingle && isSelected
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : isMaxedOut
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : isSelected
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {isUnavailable ? (
                            <span>Hết hàng / Ngừng bán</span>
                          ) : isSingle && isSelected ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Đang chọn</span>
                            </>
                          ) : isMaxedOut ? (
                            <span>Đã đạt tối đa (20)</span>
                          ) : isSelected ? (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm tiếp (+1)</span>
                            </>
                          ) : isSingle ? (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Chọn linh kiện</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm vào cấu hình</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          {/* Pagination Controls */}
          {!isLoading && totalPages > 1 ? (
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                disabled={pageIndex <= 1}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trang trước</span>
              </button>

              <span className="text-slate-500 font-medium">
                Trang <span className="font-bold text-slate-900">{pageIndex}</span> / {totalPages}
              </span>

              <button
                type="button"
                disabled={pageIndex >= totalPages}
                onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
              >
                <span>Trang sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              Hiển thị {products.length} trên tổng số {totalCount} sản phẩm
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </dialog>
  )
}
