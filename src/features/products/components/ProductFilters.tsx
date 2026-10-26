import React, { useState } from 'react'
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  X,
} from 'lucide-react'
import type { ApiError } from '../../../lib/api'
import {
  COMPONENT_TYPE_LABELS,
  SORT_OPTION_LABELS,
} from '../productConstants'
import {
  ComponentType,
  ProductSortOption,
  type Category,
} from '../productTypes'
import type { ParsedFilters } from '../useProductCatalog'

interface ProductFiltersProps {
  filters: ParsedFilters
  categories: Category[]
  isCategoriesLoading?: boolean
  categoriesError?: ApiError | Error | null
  priceError: string | null
  onUpdateFilters: (
    newParams: Partial<Record<keyof ParsedFilters, string | number | boolean | undefined | null>>,
    resetPage?: boolean
  ) => void
  onResetFilters: () => void
}

const ProductFiltersInner: React.FC<ProductFiltersProps> = ({
  filters,
  categories,
  isCategoriesLoading = false,
  categoriesError = null,
  priceError,
  onUpdateFilters,
  onResetFilters,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchTerm)
  const [brandInput, setBrandInput] = useState(filters.brand)
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice?.toString() ?? '')
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice?.toString() ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateFilters({ searchTerm: searchInput.trim() || undefined })
  }

  const handleBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateFilters({ brand: brandInput.trim() || undefined })
  }

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedMin = minPriceInput.trim() ? parseFloat(minPriceInput) : undefined
    const parsedMax = maxPriceInput.trim() ? parseFloat(maxPriceInput) : undefined
    onUpdateFilters({
      minPrice:
        parsedMin !== undefined && !Number.isNaN(parsedMin) && parsedMin >= 0
          ? parsedMin
          : undefined,
      maxPrice:
        parsedMax !== undefined && !Number.isNaN(parsedMax) && parsedMax >= 0
          ? parsedMax
          : undefined,
    })
  }

  const renderCategoryItem = (cat: Category, level = 0) => {
    const isSelected = filters.categoryId === cat.id
    return (
      <div key={cat.id} className="space-y-1">
        <button
          type="button"
          onClick={() => {
            onUpdateFilters({
              categoryId: isSelected ? undefined : cat.id,
            })
          }}
          className={`w-full text-left flex items-center justify-between text-xs py-1.5 px-2 rounded-lg transition-colors ${
            isSelected
              ? 'bg-red-50 text-red-600 font-bold'
              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
          }`}
          style={{ paddingLeft: `${Math.max(8, level * 16 + 8)}px` }}
        >
          <span className="truncate">{cat.name}</span>
          {isSelected && <ChevronRight className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
        </button>

        {cat.subCategories && cat.subCategories.length > 0 && (
          <div className="space-y-0.5">
            {cat.subCategories.map((sub) => renderCategoryItem(sub, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderFilterContent = (idPrefix: 'desktop' | 'mobile') => (
    <div className="space-y-6 text-sm">
      {/* 1. Keyword Search */}
      <div>
        <label
          htmlFor={`${idPrefix}-search-input`}
          className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2"
        >
          Tìm Kiếm Tên Linh Kiện
        </label>
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            id={`${idPrefix}-search-input`}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nhập tên sản phẩm..."
            maxLength={100}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
          />
          <button
            type="submit"
            aria-label="Thực hiện tìm kiếm"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* 2. Category Tree */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-red-600" />
            <span>Danh Mục</span>
          </label>
          {filters.categoryId && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ categoryId: undefined })}
              className="text-[11px] text-red-600 hover:underline"
            >
              Bỏ chọn
            </button>
          )}
        </div>

        {isCategoriesLoading ? (
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 space-y-2">
            <div className="h-4 bg-slate-200/70 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-slate-200/70 rounded animate-pulse w-1/2" />
            <div className="h-4 bg-slate-200/70 rounded animate-pulse w-2/3" />
          </div>
        ) : categoriesError ? (
          <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 text-xs text-slate-500">
            <p>Không thể tải danh mục.</p>
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-0.5 border border-slate-200/80 rounded-xl p-2 bg-slate-50/50">
            <button
              type="button"
              onClick={() => onUpdateFilters({ categoryId: undefined })}
              className={`w-full text-left text-xs py-1.5 px-2 rounded-lg transition-colors ${
                !filters.categoryId
                  ? 'bg-red-50 text-red-600 font-bold'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tất cả danh mục
            </button>
            {categories.map((cat) => renderCategoryItem(cat, 0))}
          </div>
        )}
      </div>

      {/* 3. Component Type */}
      <div>
        <label
          htmlFor={`${idPrefix}-component-type-select`}
          className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2"
        >
          Loại Phần Cứng
        </label>
        <select
          id={`${idPrefix}-component-type-select`}
          value={filters.componentType ?? ''}
          onChange={(e) => {
            const val = e.target.value ? parseInt(e.target.value, 10) : undefined
            onUpdateFilters({ componentType: val as ComponentType })
          }}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
        >
          <option value="">Tất cả loại phần cứng</option>
          {Object.entries(COMPONENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Brand Input */}
      <div>
        <label
          htmlFor={`${idPrefix}-brand-input`}
          className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2"
        >
          Thương Hiệu
        </label>
        <form onSubmit={handleBrandSubmit} className="flex gap-2">
          <input
            id={`${idPrefix}-brand-input`}
            type="text"
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            placeholder="ASUS, Intel, MSI..."
            maxLength={100}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            Lọc
          </button>
        </form>
      </div>

      {/* 5. Price Range Filter */}
      <div>
        <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
          Khoảng Giá (VND)
        </label>
        <form onSubmit={handlePriceApply} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${idPrefix}-min-price-input`} className="sr-only">
                Giá tối thiểu
              </label>
              <input
                id={`${idPrefix}-min-price-input`}
                type="number"
                min="0"
                step="50000"
                placeholder="Từ"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                aria-label="Giá tối thiểu"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-max-price-input`} className="sr-only">
                Giá tối đa
              </label>
              <input
                id={`${idPrefix}-max-price-input`}
                type="number"
                min="0"
                step="50000"
                placeholder="Đến"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
                aria-label="Giá tối đa"
              />
            </div>
          </div>
          {priceError && (
            <p className="text-[11px] text-rose-600 font-medium">{priceError}</p>
          )}
          <button
            type="submit"
            className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition-colors"
          >
            Áp dụng khoảng giá
          </button>
        </form>
      </div>

      {/* 6. Stock Status */}
      <div>
        <label
          htmlFor={`${idPrefix}-stock-status-select`}
          className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2"
        >
          Tình Trạng Kho
        </label>
        <select
          id={`${idPrefix}-stock-status-select`}
          value={
            filters.inStock === undefined
              ? 'all'
              : filters.inStock
              ? 'true'
              : 'false'
          }
          onChange={(e) => {
            const val = e.target.value
            onUpdateFilters({
              inStock: val === 'all' ? undefined : val === 'true',
            })
          }}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
        >
          <option value="all">Tất cả trạng thái kho</option>
          <option value="true">Còn hàng trong kho</option>
          <option value="false">Tạm hết hàng</option>
        </select>
      </div>

      {/* 7. Active Business Status */}
      <div>
        <label
          htmlFor={`${idPrefix}-active-status-select`}
          className="block text-xs font-bold text-slate-900 uppercase tracking-wider mb-2"
        >
          Trạng Thái Kinh Doanh
        </label>
        <select
          id={`${idPrefix}-active-status-select`}
          value={
            filters.isActive === undefined
              ? 'all'
              : filters.isActive
              ? 'true'
              : 'false'
          }
          onChange={(e) => {
            const val = e.target.value
            onUpdateFilters({
              isActive: val === 'all' ? undefined : val === 'true',
            })
          }}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
        >
          <option value="all">Tất cả sản phẩm</option>
          <option value="true">Đang kinh doanh</option>
          <option value="false">Ngừng kinh doanh</option>
        </select>
      </div>

      {/* 8. Reset Filters */}
      <button
        type="button"
        onClick={onResetFilters}
        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Đặt Lại Bộ Lọc</span>
      </button>
    </div>
  )

  return (
    <div>
      {/* Mobile Toggle Button */}
      <div className="lg:hidden mb-4 flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-colors"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Bộ Lọc Sản Phẩm</span>
        </button>

        {/* Mobile Sort Dropdown */}
        <select
          aria-label="Sắp xếp sản phẩm"
          value={filters.sortBy}
          onChange={(e) =>
            onUpdateFilters({
              sortBy: parseInt(e.target.value, 10) as ProductSortOption,
            })
          }
          className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-900 font-medium"
        >
          {Object.entries(SORT_OPTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm self-start sticky top-24">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-red-600" />
            <span>Bộ Lọc Tìm Kiếm</span>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs text-slate-400 hover:text-red-600 transition-colors"
          >
            Xóa hết
          </button>
        </div>
        {renderFilterContent('desktop')}
      </aside>

      {/* Mobile Filters Drawer Modal */}
      {mobileFiltersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filter-title"
          className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-xs bg-white h-full ml-auto p-5 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                <h3 id="mobile-filter-title" className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="w-4 h-4 text-red-600" />
                  <span>Bộ Lọc Sản Phẩm</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Đóng bộ lọc"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderFilterContent('mobile')}
            </div>

            <div className="pt-4 border-t border-slate-100 mt-6">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
              >
                Xem Kết Quả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const ProductFilters: React.FC<ProductFiltersProps> = (props) => {
  const filterKey = `${props.filters.searchTerm}|${props.filters.brand}|${props.filters.minPrice ?? ''}|${props.filters.maxPrice ?? ''}`

  return <ProductFiltersInner key={filterKey} {...props} />
}
