import React from 'react'
import { SORT_OPTION_LABELS } from '../features/products/productConstants'
import { ProductSortOption } from '../features/products/productTypes'
import { useProductCatalog } from '../features/products/useProductCatalog'
import { ProductCard } from '../features/products/components/ProductCard'
import { ProductFilters } from '../features/products/components/ProductFilters'
import { ProductActiveFilterChips } from '../features/products/components/ProductActiveFilterChips'
import { ProductPagination } from '../features/products/components/ProductPagination'
import {
  ProductGridEmpty,
  ProductGridError,
  ProductGridSkeleton,
} from '../features/products/components/ProductGridState'

export const ProductsPage: React.FC = () => {
  const {
    products,
    pagedResult,
    categories,
    isCategoriesLoading,
    categoriesError,
    isResolvingCategory,
    isLoading,
    error,
    priceError,
    overflowError,
    invalidCategoryError,
    categoryNotFoundError,
    limitWarning,
    filters,
    effectiveComponentType,
    filterOptions,
    isFilterOptionsLoading,
    filterOptionsError,
    updateFilters,
    toggleFilterChoice,
    clearFilterGroup,
    setPage,
    resetFilters,
    retry,
    retryCategories,
    retryFilterOptions,
  } = useProductCatalog()

  const handleRemoveFilterChip = (key: string, value?: string | number) => {
    if (value !== undefined) {
      toggleFilterChoice(key, value)
    } else if (key === 'price') {
      updateFilters({ minPrice: undefined, maxPrice: undefined })
    } else {
      updateFilters({ [key]: undefined })
    }
  }

  const hasActiveFilters = Boolean(
    filters.searchTerm ||
      filters.categoryId ||
      filters.componentType !== undefined ||
      filters.brands.length > 0 ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      filters.inStock !== undefined ||
      filters.isActive !== undefined ||
      filters.sockets.length > 0 ||
      filters.memoryTypes.length > 0 ||
      filters.motherboardFormFactors.length > 0 ||
      filters.ramFormFactors.length > 0 ||
      filters.storageTypes.length > 0 ||
      filters.storageInterfaces.length > 0 ||
      filters.psuEfficiencies.length > 0 ||
      filters.psuModularities.length > 0 ||
      filters.psuFormFactors.length > 0 ||
      filters.coolerTypes.length > 0 ||
      filters.coreCounts.length > 0 ||
      filters.vramGbs.length > 0 ||
      filters.gpuLengthsMm.length > 0 ||
      filters.ramCapacitiesGb.length > 0 ||
      filters.ramSpeedsMhz.length > 0 ||
      filters.storageCapacitiesGb.length > 0 ||
      filters.psuWattages.length > 0 ||
      typeof filters.hasIntegratedGpu === 'boolean' ||
      typeof filters.hasWifi === 'boolean' ||
      typeof filters.hasRgb === 'boolean' ||
      typeof filters.has12VHPWR === 'boolean' ||
      typeof filters.requires12VHPWR === 'boolean'
  )

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8 pb-6 border-b border-slate-200">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight mb-2">
          Danh Mục Linh Kiện Máy Tính
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
          Khám phá danh sách linh kiện PC, máy trạm và phụ kiện với thông số chi tiết, giá bán và tình trạng kho rõ ràng.
        </p>
      </div>

      {/* Main Content Layout: Sidebar Filters + Products Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Filters Sidebar */}
        <ProductFilters
          filters={filters}
          effectiveComponentType={effectiveComponentType}
          categories={categories}
          isCategoriesLoading={isCategoriesLoading}
          categoriesError={categoriesError}
          priceError={priceError}
          overflowError={overflowError}
          limitWarning={limitWarning}
          filterOptions={filterOptions}
          isFilterOptionsLoading={isFilterOptionsLoading}
          filterOptionsError={filterOptionsError}
          onUpdateFilters={updateFilters}
          onToggleChoice={toggleFilterChoice}
          onClearGroup={clearFilterGroup}
          onResetFilters={resetFilters}
          onRetryFilterOptions={retryFilterOptions}
        />

        {/* Catalog Main Viewport */}
        <section aria-label="Danh sách sản phẩm" className="flex-1 w-full">
          {/* Active Filter Chips */}
          <ProductActiveFilterChips
            filters={filters}
            effectiveComponentType={effectiveComponentType}
            categories={categories}
            onRemoveFilter={handleRemoveFilterChip}
            onClearAll={resetFilters}
          />

          {/* Top Results Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="text-xs text-slate-600 font-medium">
              {isLoading || isResolvingCategory ? (
                <span>Đang tải thông tin sản phẩm...</span>
              ) : categoriesError && filters.categoryId ? (
                <span className="text-rose-600 font-semibold">Lỗi tải danh mục</span>
              ) : invalidCategoryError || categoryNotFoundError ? (
                <span className="text-rose-600 font-semibold">Danh mục không hợp lệ</span>
              ) : priceError ? (
                <span className="text-rose-600 font-semibold">Lỗi khoảng giá</span>
              ) : overflowError ? (
                <span className="text-rose-600 font-semibold">Lỗi giới hạn bộ lọc</span>
              ) : error ? (
                <span className="text-rose-600 font-semibold">Không thể tải dữ liệu</span>
              ) : pagedResult ? (
                <span>
                  Tìm thấy{' '}
                  <strong className="text-slate-950 font-bold font-mono">
                    {pagedResult.totalCount}
                  </strong>{' '}
                  sản phẩm
                </span>
              ) : (
                <span>Đang tải thông tin sản phẩm...</span>
              )}
            </div>

            {/* Desktop Sort Dropdown */}
            <div className="hidden lg:flex items-center gap-2">
              <label htmlFor="desktop-sort" className="text-xs text-slate-500 font-medium">
                Sắp xếp theo:
              </label>
              <select
                id="desktop-sort"
                value={filters.sortBy}
                onChange={(e) =>
                  updateFilters({
                    sortBy: parseInt(e.target.value, 10) as ProductSortOption,
                  })
                }
                className="bg-white border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 shadow-2xs"
              >
                {Object.entries(SORT_OPTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Grid State */}
          {isLoading || isResolvingCategory ? (
            <ProductGridSkeleton />
          ) : categoriesError && filters.categoryId ? (
            <ProductGridError
              title="Lỗi Tải Danh Mục"
              message="Không thể tải danh sách danh mục từ máy chủ. Vui lòng thử lại."
              actionLabel="Thử Lại"
              onRetry={retryCategories}
            />
          ) : invalidCategoryError ? (
            <ProductGridError
              title="Mã Danh Mục Không Hợp Lệ"
              message={invalidCategoryError}
              actionLabel="Xóa Danh Mục"
              onRetry={() => updateFilters({ categoryId: undefined })}
            />
          ) : categoryNotFoundError ? (
            <ProductGridError
              title="Không Tìm Thấy Danh Mục"
              message={categoryNotFoundError}
              actionLabel="Xem Tất Cả Sản Phẩm"
              onRetry={() => updateFilters({ categoryId: undefined })}
            />
          ) : priceError ? (
            <ProductGridError
              title="Khoảng Giá Không Hợp Lệ"
              message={priceError}
              actionLabel="Xóa Bộ Lọc Giá"
              onRetry={() => updateFilters({ minPrice: undefined, maxPrice: undefined })}
            />
          ) : overflowError ? (
            <ProductGridError
              title="Giới Hạn Bộ Lọc"
              message={overflowError}
              actionLabel="Đặt Lại Bộ Lọc"
              onRetry={resetFilters}
            />
          ) : error ? (
            <ProductGridError error={error} onRetry={retry} />
          ) : products.length === 0 ? (
            <ProductGridEmpty
              hasActiveFilters={hasActiveFilters}
              onResetFilters={resetFilters}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {pagedResult && (
                <ProductPagination
                  pageIndex={pagedResult.pageIndex}
                  totalPages={pagedResult.totalPages}
                  hasPreviousPage={pagedResult.hasPreviousPage}
                  hasNextPage={pagedResult.hasNextPage}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
