import React, { useState } from 'react'
import {
  Search,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Layers,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import type { ApiError } from '../../../lib/api'
import {
  COMPONENT_TYPE_LABELS,
} from '../productConstants'
import {
  ComponentType,
  type Category,
  type ProductFilterOptionsResponse,
  type ProductFilterParams,
} from '../productTypes'
import {
  TECHNICAL_GROUPS_BY_TYPE,
  BOOLEAN_FILTER_KEYS,
  PRICE_PRESETS,
  getGroupTitle,
  type ParsedProductCatalogFilters,
} from '../productFilterHelper'
import { ProductCheckboxGroup } from './ProductCheckboxGroup'
import { ProductBooleanFilterGroup } from './ProductBooleanFilterGroup'

export interface ProductFiltersProps {
  filters: ParsedProductCatalogFilters
  effectiveComponentType?: ComponentType
  categories: Category[]
  isCategoriesLoading?: boolean
  categoriesError?: ApiError | Error | null
  priceError: string | null
  overflowError?: string | null
  limitWarning?: string | null
  filterOptions: ProductFilterOptionsResponse | null
  isFilterOptionsLoading?: boolean
  filterOptionsError?: Error | null
  onUpdateFilters: (
    newParams: Partial<ProductFilterParams>,
    resetPage?: boolean
  ) => void
  onToggleChoice: (groupKey: string, value: string | number) => void
  onClearGroup: (groupKey: string) => void
  onResetFilters: () => void
  onRetryFilterOptions?: () => void
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  filters,
  effectiveComponentType,
  categories,
  isCategoriesLoading = false,
  categoriesError = null,
  priceError,
  overflowError,
  limitWarning,
  filterOptions,
  isFilterOptionsLoading = false,
  filterOptionsError = null,
  onUpdateFilters,
  onToggleChoice,
  onClearGroup,
  onResetFilters,
  onRetryFilterOptions,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchTerm)
  const [minPriceInput, setMinPriceInput] = useState(filters.minPrice?.toString() ?? '')
  const [maxPriceInput, setMaxPriceInput] = useState(filters.maxPrice?.toString() ?? '')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Điều chỉnh local inputs khi filters từ props thay đổi trong quá trình render (React pattern)
  const [prevSearchTerm, setPrevSearchTerm] = useState(filters.searchTerm)
  if (filters.searchTerm !== prevSearchTerm) {
    setPrevSearchTerm(filters.searchTerm)
    setSearchInput(filters.searchTerm)
  }

  const [prevMinPrice, setPrevMinPrice] = useState(filters.minPrice)
  const [prevMaxPrice, setPrevMaxPrice] = useState(filters.maxPrice)
  if (filters.minPrice !== prevMinPrice || filters.maxPrice !== prevMaxPrice) {
    setPrevMinPrice(filters.minPrice)
    setPrevMaxPrice(filters.maxPrice)
    setMinPriceInput(filters.minPrice?.toString() ?? '')
    setMaxPriceInput(filters.maxPrice?.toString() ?? '')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateFilters({ searchTerm: searchInput.trim() || undefined })
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

  // Kiểm tra preset giá nào đang khớp
  const activePricePreset = PRICE_PRESETS.find((p) => {
    const minMatch = p.minPrice === undefined ? filters.minPrice === undefined : filters.minPrice === p.minPrice
    const maxMatch = p.maxPrice === undefined ? filters.maxPrice === undefined : filters.maxPrice === p.maxPrice
    return minMatch && maxMatch && (filters.minPrice !== undefined || filters.maxPrice !== undefined)
  })

  const handleTogglePricePreset = (preset: typeof PRICE_PRESETS[0]) => {
    if (activePricePreset?.id === preset.id) {
      // Đang chọn -> bỏ chọn
      onUpdateFilters({ minPrice: undefined, maxPrice: undefined })
    } else {
      onUpdateFilters({ minPrice: preset.minPrice, maxPrice: preset.maxPrice })
    }
  }

  // Danh mục phân cấp
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
          className={`w-full text-left flex items-center justify-between text-xs py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
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

  // Nội dung toàn bộ sidebar bộ lọc
  const renderFilterContent = (idPrefix: 'desktop' | 'mobile') => (
    <div className="space-y-5 text-sm">
      {/* Cảnh báo vượt giới hạn URL hoặc lỗi giá */}
      {overflowError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{overflowError}</p>
            <button
              type="button"
              onClick={onResetFilters}
              className="text-amber-900 underline font-bold hover:text-red-600"
            >
              Khôi phục bộ lọc mặc định
            </button>
          </div>
        </div>
      )}

      {limitWarning && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{limitWarning}</span>
        </div>
      )}

      {priceError && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{priceError}</span>
        </div>
      )}

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
            placeholder="Nhập tên sản phẩm, mã SKU..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                onUpdateFilters({ searchTerm: undefined })
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* 2. Loại Linh Kiện (Component Type) */}
      <div className="border-b border-slate-200/80 pb-4 pt-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-red-600" />
            <span>Loại linh kiện</span>
          </span>
          {filters.componentType && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ componentType: undefined })}
              className="text-xs text-red-600 hover:underline font-semibold"
            >
              Bỏ chọn
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(COMPONENT_TYPE_LABELS).map(([value, label]) => {
            const typeNum = parseInt(value, 10) as ComponentType
            const isSelected = filters.componentType === typeNum
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  onUpdateFilters({
                    componentType: isSelected ? undefined : typeNum,
                  })
                }
                className={`text-left text-xs py-1.5 px-2 rounded-lg transition-all border ${
                  isSelected
                    ? 'bg-red-600 text-white font-bold border-red-600 shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="truncate block">{label.split('(')[0].trim()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Danh Mục Sản Phẩm (Category Tree) */}
      <div className="border-b border-slate-200/80 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Danh Mục
          </span>
          {filters.categoryId && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ categoryId: undefined })}
              className="text-xs text-red-600 hover:underline font-semibold"
            >
              Bỏ chọn
            </button>
          )}
        </div>

        {isCategoriesLoading && (
          <div className="space-y-2 py-2">
            <div className="h-4 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-slate-100 rounded animate-pulse w-5/6" />
          </div>
        )}

        {categoriesError && (
          <div className="text-xs text-red-600 py-1 bg-red-50 p-2 rounded-lg">
            Không tải được danh mục
          </div>
        )}

        {!isCategoriesLoading && !categoriesError && (
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {categories.map((cat) => renderCategoryItem(cat))}
          </div>
        )}
      </div>

      {/* 4. Hãng Sản Xuất (Brands Checkbox Group từ API) */}
      {isFilterOptionsLoading ? (
        <div className="border-b border-slate-200/80 pb-4 pt-2 space-y-2">
          <div className="h-3.5 bg-slate-200 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse" />
        </div>
      ) : filterOptionsError ? (
        <div className="border-b border-slate-200/80 pb-4 pt-2">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <p className="text-slate-600">Không nạp được danh sách hãng.</p>
            {onRetryFilterOptions && (
              <button
                type="button"
                onClick={onRetryFilterOptions}
                className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Thử lại</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <ProductCheckboxGroup
          title="Thương hiệu"
          groupKey="brands"
          options={filterOptions?.brands ?? []}
          selectedValues={filters.brands}
          onToggle={(val) => onToggleChoice('brands', val)}
          onClear={() => onClearGroup('brands')}
          emptyMessage="Chưa có dữ liệu thương hiệu"
        />
      )}

      {/* 5. Khoảng Giá (Presets Checkbox Single-Choice + Custom Inputs) */}
      <div className="border-b border-slate-200/80 pb-4 pt-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Khoảng Giá
          </span>
          {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
            <button
              type="button"
              onClick={() => onUpdateFilters({ minPrice: undefined, maxPrice: undefined })}
              className="text-xs text-red-600 hover:underline font-semibold"
            >
              Xóa giá
            </button>
          )}
        </div>

        {/* Presets single choice */}
        <div className="space-y-1.5 mb-3">
          <div className="text-[11px] text-slate-500 font-medium">Chọn nhanh một khoảng giá:</div>
          {PRICE_PRESETS.map((preset) => {
            const isChecked = activePricePreset?.id === preset.id
            return (
              <label
                key={preset.id}
                className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer text-xs select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleTogglePricePreset(preset)}
                  className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                />
                <span className={isChecked ? 'font-bold text-red-600' : 'text-slate-700'}>
                  {preset.label}
                </span>
              </label>
            )
          })}
        </div>

        {/* Custom Price Form */}
        <form onSubmit={handlePriceApply} className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-[11px] text-slate-500 font-medium">Hoặc nhập khoảng tùy chỉnh (VNĐ):</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${idPrefix}-min-price`} className="sr-only">
                Giá tối thiểu
              </label>
              <input
                id={`${idPrefix}-min-price`}
                type="number"
                min="0"
                step="50000"
                value={minPriceInput}
                onChange={(e) => setMinPriceInput(e.target.value)}
                placeholder="Từ (VNĐ)"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-max-price`} className="sr-only">
                Giá tối đa
              </label>
              <input
                id={`${idPrefix}-max-price`}
                type="number"
                min="0"
                step="50000"
                value={maxPriceInput}
                onChange={(e) => setMaxPriceInput(e.target.value)}
                placeholder="Đến (VNĐ)"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Áp dụng khoảng giá
          </button>
        </form>
      </div>

      {/* 6. Technical Groups theo ComponentType hiện tại */}
      {effectiveComponentType && (
        <div className="space-y-1">
          {TECHNICAL_GROUPS_BY_TYPE[effectiveComponentType]?.map((groupKey) => {
            const isBoolean = (BOOLEAN_FILTER_KEYS as readonly string[]).includes(groupKey)
            const title = getGroupTitle(groupKey, effectiveComponentType)

            if (isBoolean) {
              const currentVal = filters[groupKey as keyof ParsedProductCatalogFilters] as boolean | undefined
              return (
                <ProductBooleanFilterGroup
                  key={groupKey}
                  title={title}
                  value={currentVal}
                  onChange={(val) => onUpdateFilters({ [groupKey]: val })}
                />
              )
            }

            // Numeric hoặc Enum group từ filterOptions
            const groupMetadata = filterOptions?.groups?.find((g) => g.key === groupKey)
            const options = groupMetadata ? groupMetadata.values : []
            const currentSelected = (filters[groupKey as keyof ParsedProductCatalogFilters] as (string | number)[]) ?? []

            return (
              <ProductCheckboxGroup
                key={groupKey}
                title={title}
                groupKey={groupKey}
                options={options}
                selectedValues={currentSelected}
                onToggle={(val) => onToggleChoice(groupKey, val)}
                onClear={() => onClearGroup(groupKey)}
                componentType={effectiveComponentType}
                emptyMessage="Không có thông số tương ứng"
              />
            )
          })}
        </div>
      )}

      {/* 7. Trạng Thái & Tồn Kho */}
      <div className="border-b border-slate-200/80 pb-4 pt-1 space-y-3">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
          Tình Trạng Hàng
        </span>

        {/* Còn hàng */}
        <div className="space-y-1">
          <span className="text-[11px] text-slate-500 font-medium">Tồn kho:</span>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStock === undefined}
                onChange={() => onUpdateFilters({ inStock: undefined })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Tất cả</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStock === true}
                onChange={() => onUpdateFilters({ inStock: filters.inStock === true ? undefined : true })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Còn hàng</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStock === false}
                onChange={() => onUpdateFilters({ inStock: filters.inStock === false ? undefined : false })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Hết hàng</span>
            </label>
          </div>
        </div>

        {/* Kinh doanh */}
        <div className="space-y-1">
          <span className="text-[11px] text-slate-500 font-medium">Kinh doanh:</span>
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.isActive === undefined}
                onChange={() => onUpdateFilters({ isActive: undefined })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Tất cả</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.isActive === true}
                onChange={() => onUpdateFilters({ isActive: filters.isActive === true ? undefined : true })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Đang bán</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.isActive === false}
                onChange={() => onUpdateFilters({ isActive: filters.isActive === false ? undefined : false })}
                className="w-3.5 h-3.5 text-red-600 rounded"
              />
              <span>Ngừng bán</span>
            </label>
          </div>
        </div>
      </div>

      {/* 8. Reset Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onResetFilters}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Đặt lại toàn bộ bộ lọc</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Nút bấm mở bộ lọc trên Mobile */}
      <div className="lg:hidden w-full mb-4">
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4 text-red-600" />
          <span>Bộ Lọc Sản Phẩm &amp; Thông Số</span>
        </button>
      </div>

      {/* Sidebar Desktop */}
      <aside
        aria-label="Bộ lọc danh mục"
        className="hidden lg:block w-72 flex-shrink-0 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm uppercase tracking-wider">
            <SlidersHorizontal className="w-4 h-4 text-red-600" />
            <span>Bộ Lọc</span>
          </div>
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs text-slate-500 hover:text-red-600 font-medium"
            title="Xóa tất cả các lựa chọn"
          >
            Đặt lại
          </button>
        </div>
        {renderFilterContent('desktop')}
      </aside>

      {/* Drawer Mobile */}
      {mobileFiltersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileFiltersOpen(false)}
            aria-hidden="true"
          />

          <div className="relative ml-auto w-full max-w-xs sm:max-w-sm h-full bg-white shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <SlidersHorizontal className="w-4 h-4 text-red-600" />
                <span>Bộ Lọc Sản Phẩm</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">{renderFilterContent('mobile')}</div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={onResetFilters}
                className="flex-1 py-2.5 px-3 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Đặt lại
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1 py-2.5 px-3 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700"
              >
                Xem kết quả
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
