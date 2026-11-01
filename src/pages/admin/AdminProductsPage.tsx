import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  FolderTree,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { flattenCategoryTree, isValidComponentType } from '../../features/admin/adminCategoryHelper'
import { mapAdminApiError } from '../../features/admin/adminConstants'
import type { FlattenedCategoryNode } from '../../features/admin/adminTypes'
import { getCategories, getProducts } from '../../features/products/productApi'
import {
  COMPONENT_TYPE_LABELS,
  SORT_OPTION_LABELS,
  formatVnd,
} from '../../features/products/productConstants'
import {
  ComponentType,
  ProductSortOption,
  type ProductFilterParams,
  type ProductSummary,
} from '../../features/products/productTypes'

const ADMIN_PRODUCTS_PAGE_SIZE = 12

const COMPONENT_TYPE_OPTIONS = Object.entries(COMPONENT_TYPE_LABELS).map(
  ([val, label]) => ({
    value: Number(val) as ComponentType,
    label,
  })
)

const SORT_OPTIONS = Object.entries(SORT_OPTION_LABELS).map(([val, label]) => ({
  value: Number(val) as ProductSortOption,
  label,
}))

export const AdminProductsPage: React.FC = () => {
  const { user } = useAuth()
  const ownerId = user?.id ?? null
  const [searchParams, setSearchParams] = useSearchParams()

  // Đọc filter khởi tạo từ URL query params
  const pageFromUrl = Math.max(1, Number(searchParams.get('page')) || 1)
  const searchFromUrl = searchParams.get('q') ?? ''
  const categoryFromUrl = searchParams.get('categoryId') ?? ''
  const rawTypeFromUrl = Number(searchParams.get('componentType'))
  const typeFromUrl: ComponentType | '' = isValidComponentType(rawTypeFromUrl)
    ? rawTypeFromUrl
    : ''
  const statusFromUrl =
    (searchParams.get('status') as 'all' | 'active' | 'inactive') || 'all'
  const stockFromUrl =
    (searchParams.get('stock') as 'all' | 'in_stock' | 'out_of_stock') || 'all'
  const rawSortFromUrl = Number(searchParams.get('sortBy'))
  const sortFromUrl: ProductSortOption =
    rawSortFromUrl >= 1 && rawSortFromUrl <= 5
      ? (rawSortFromUrl as ProductSortOption)
      : ProductSortOption.Newest

  const [searchInput, setSearchInput] = useState(searchFromUrl)
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl)
  const [componentType, setComponentType] = useState<ComponentType | ''>(
    typeFromUrl
  )
  const [categoryId, setCategoryId] = useState(categoryFromUrl)
  const [isActiveFilter, setIsActiveFilter] = useState<
    'all' | 'active' | 'inactive'
  >(
    statusFromUrl === 'active' || statusFromUrl === 'inactive'
      ? statusFromUrl
      : 'all'
  )
  const [inStockFilter, setInStockFilter] = useState<
    'all' | 'in_stock' | 'out_of_stock'
  >(
    stockFromUrl === 'in_stock' || stockFromUrl === 'out_of_stock'
      ? stockFromUrl
      : 'all'
  )
  const [sortBy, setSortBy] = useState<ProductSortOption>(sortFromUrl)
  const [pageIndex, setPageIndex] = useState(pageFromUrl)

  const [flatCategories, setFlatCategories] = useState<FlattenedCategoryNode[]>(
    []
  )
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const ownerIdRef = useRef<string | null>(ownerId)
  const listSeqRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    ownerIdRef.current = ownerId
    return () => {
      mountedRef.current = false
      listSeqRef.current += 1
    }
  }, [ownerId])

  // Debounce thanh tìm kiếm 350ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim().slice(0, 100)
      setDebouncedSearch((prev) => {
        if (prev !== trimmed) {
          setPageIndex(1)
        }
        return trimmed
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // Tải cây danh mục cho bộ lọc
  useEffect(() => {
    const controller = new AbortController()
    getCategories(controller.signal)
      .then((tree) => {
        if (!mountedRef.current) return
        setFlatCategories(flattenCategoryTree(tree))
      })
      .catch(() => {
        // Bộ lọc danh mục là tùy chọn trên trang danh sách
      })
    return () => controller.abort()
  }, [])

  // Đồng bộ URL searchParams
  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedSearch) next.set('q', debouncedSearch)
    if (componentType !== '') next.set('componentType', String(componentType))
    if (categoryId) next.set('categoryId', categoryId)
    if (isActiveFilter !== 'all') next.set('status', isActiveFilter)
    if (inStockFilter !== 'all') next.set('stock', inStockFilter)
    if (sortBy !== ProductSortOption.Newest) next.set('sortBy', String(sortBy))
    if (pageIndex > 1) next.set('page', String(pageIndex))
    setSearchParams(next, { replace: true })
  }, [
    debouncedSearch,
    componentType,
    categoryId,
    isActiveFilter,
    inStockFilter,
    sortBy,
    pageIndex,
    setSearchParams,
  ])

  const filteredCategoryOptions = useMemo(() => {
    if (componentType === '') return flatCategories
    return flatCategories.filter((c) => c.componentType === componentType)
  }, [flatCategories, componentType])

  const fetchAdminProductList = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++listSeqRef.current
      const activeOwner = ownerIdRef.current
      const isTicketCurrent = () =>
        mountedRef.current &&
        listSeqRef.current === seq &&
        ownerIdRef.current === activeOwner

      await Promise.resolve()
      if (!isTicketCurrent()) return
      setIsLoading(true)
      setError(null)

      const filterParams: ProductFilterParams = {
        pageIndex,
        pageSize: ADMIN_PRODUCTS_PAGE_SIZE,
        searchTerm: debouncedSearch || undefined,
        componentType: componentType !== '' ? componentType : undefined,
        categoryId: categoryId || undefined,
        sortBy,
      }

      // Mặc định 'all' -> bỏ qua isActive để hiển thị cả sản phẩm đang bán & sản phẩm đã ẩn
      if (isActiveFilter === 'active') {
        filterParams.isActive = true
      } else if (isActiveFilter === 'inactive') {
        filterParams.isActive = false
      }

      if (inStockFilter === 'in_stock') {
        filterParams.inStock = true
      } else if (inStockFilter === 'out_of_stock') {
        filterParams.inStock = false
      }

      try {
        const result = await getProducts(filterParams, signal)
        if (!isTicketCurrent()) return
        setProducts(result.items ?? [])
        setTotalCount(result.totalCount ?? 0)
        setTotalPages(Math.max(1, result.totalPages ?? 1))
      } catch (err: unknown) {
        if (!isTicketCurrent()) return
        if (err instanceof Error && err.name === 'AbortError') return
        setError(
          mapAdminApiError(
            err,
            'Không thể tải danh sách sản phẩm quản trị. Vui lòng thử lại.'
          )
        )
      } finally {
        if (isTicketCurrent()) {
          setIsLoading(false)
        }
      }
    },
    [
      pageIndex,
      debouncedSearch,
      componentType,
      categoryId,
      isActiveFilter,
      inStockFilter,
      sortBy,
    ]
  )

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => fetchAdminProductList(controller.signal))
    return () => controller.abort()
  }, [fetchAdminProductList])

  const handleResetFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setComponentType('')
    setCategoryId('')
    setIsActiveFilter('all')
    setInStockFilter('all')
    setSortBy(ProductSortOption.Newest)
    setPageIndex(1)
  }

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    componentType !== '' ||
    Boolean(categoryId) ||
    isActiveFilter !== 'all' ||
    inStockFilter !== 'all' ||
    sortBy !== ProductSortOption.Newest

  return (
    <div className="space-y-6">
      {/* Header trang */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
            Quản Trị Sản Phẩm & Tồn Kho
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Quản lý toàn bộ danh mục linh kiện phần cứng, thông số kỹ thuật 9 nhóm, trạng
            thái hiển thị và kiểm kê kho.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/admin/categories"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderTree className="h-4 w-4 text-slate-500" />
            Quản lý danh mục
          </Link>
          <Link
            to="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Thêm sản phẩm mới
          </Link>
        </div>
      </div>

      {/* Bộ lọc tìm kiếm */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          {/* Tìm kiếm tên/SKU */}
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              maxLength={100}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên sản phẩm, SKU, thương hiệu..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-9 text-xs text-slate-900 outline-none focus:border-blue-600"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Lọc ComponentType */}
          <div>
            <select
              aria-label="Lọc theo loại linh kiện"
              value={componentType}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : ''
                setComponentType(
                  isValidComponentType(val) ? (val as ComponentType) : ''
                )
                setCategoryId('')
                setPageIndex(1)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả loại linh kiện</option>
              {COMPONENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Category */}
          <div>
            <select
              aria-label="Lọc theo danh mục"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setPageIndex(1)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả danh mục</option>
              {filteredCategoryOptions.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.pathNames.join(' / ')}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc trạng thái Active/Inactive */}
          <div>
            <select
              aria-label="Lọc theo trạng thái kinh doanh"
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(
                  e.target.value as 'all' | 'active' | 'inactive'
                )
                setPageIndex(1)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="all">Mọi trạng thái (Đang bán & Ẩn)</option>
              <option value="active">Đang kinh doanh (Active)</option>
              <option value="inactive">Ngừng kinh doanh / Ẩn</option>
            </select>
          </div>

          {/* Lọc tồn kho */}
          <div>
            <select
              aria-label="Lọc theo tình trạng tồn kho"
              value={inStockFilter}
              onChange={(e) => {
                setInStockFilter(
                  e.target.value as 'all' | 'in_stock' | 'out_of_stock'
                )
                setPageIndex(1)
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="all">Tất cả tồn kho</option>
              <option value="in_stock">Còn hàng (&gt; 0)</option>
              <option value="out_of_stock">Hết hàng (0)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>
              Tổng số: <strong className="text-slate-900">{totalCount}</strong> sản phẩm
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="admin-products-sort"
              className="text-xs font-medium text-slate-600"
            >
              Sắp xếp:
            </label>
            <select
              id="admin-products-sort"
              value={sortBy}
              onChange={(e) => {
                setSortBy(Number(e.target.value) as ProductSortOption)
                setPageIndex(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-600"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void fetchAdminProductList()}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`}
              />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Bảng danh sách sản phẩm */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-rose-600" />
            <p className="text-xs font-medium text-rose-700">{error}</p>
            <button
              type="button"
              onClick={() => void fetchAdminProductList()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Thử lại
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16 text-xs text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
            Đang tải danh sách sản phẩm...
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <Package className="h-10 w-10 text-slate-300" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-800">
                Không tìm thấy sản phẩm nào
              </p>
              <p className="text-xs text-slate-500">
                Hãy thử điều chỉnh bộ lọc hoặc tạo sản phẩm mới cho cửa hàng.
              </p>
            </div>
            <Link
              to="/admin/products/new"
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Thêm sản phẩm mới
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-3 py-3">SKU / Hãng</th>
                  <th className="px-3 py-3">Danh mục & Loại</th>
                  <th className="px-3 py-3 text-right">Giá bán</th>
                  <th className="px-3 py-3 text-center">Tồn kho</th>
                  <th className="px-3 py-3 text-center">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((item) => {
                  const stockBadgeClass =
                    item.stockQuantity <= 0
                      ? 'bg-rose-100 text-rose-800'
                      : item.stockQuantity <= 5
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                ;(e.currentTarget as HTMLImageElement).style.display =
                                  'none'
                              }}
                            />
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <Link
                              to={`/admin/products/${item.id}/edit`}
                              className="line-clamp-2 font-bold text-slate-900 hover:text-blue-600"
                            >
                              {item.name}
                            </Link>
                            {item.isActive && (
                              <Link
                                to={`/products/${item.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 hover:text-blue-600"
                              >
                                /{item.slug}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-mono font-bold text-slate-800">
                          {item.sku}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.brand}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">
                          {item.categoryName}
                        </div>
                        <span className="mt-0.5 inline-block rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {COMPONENT_TYPE_LABELS[item.componentType] ??
                            `Loại #${item.componentType}`}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <div className="font-mono font-bold text-slate-900">
                          {formatVnd(item.price)}
                        </div>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <div className="font-mono text-[11px] text-slate-400 line-through">
                            {formatVnd(item.originalPrice)}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold ${stockBadgeClass}`}
                        >
                          {item.stockQuantity <= 0
                            ? 'Hết hàng (0)'
                            : `Còn ${item.stockQuantity}`}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            item.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.isActive ? 'Đang bán' : 'Đang ẩn'}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          to={`/admin/products/${item.id}/edit`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Sửa & Kho
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang <strong>{pageIndex}</strong> / <strong>{totalPages}</strong> (
              {totalCount} sản phẩm)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageIndex <= 1 || isLoading}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Trang trước
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages || isLoading}
                onClick={() =>
                  setPageIndex((p) => Math.min(totalPages, p + 1))
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                Trang sau
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
