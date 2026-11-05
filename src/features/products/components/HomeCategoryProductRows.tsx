import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import type { Category, ProductSummary } from '../productTypes'
import { getProducts } from '../productApi'
import { ProductCard } from './ProductCard'

interface HomeCategoryProductRowsProps {
  rootCategories: Category[]
  isLoadingCategories?: boolean
  categoriesError?: Error | null
  onRetryCategories?: () => void
}

interface RowData {
  products: ProductSummary[]
  isLoading: boolean
  error: Error | null
}

const MAX_ROOT_ROWS = 8
const MAX_CONCURRENT_REQUESTS = 3

export const HomeCategoryProductRows: React.FC<HomeCategoryProductRowsProps> = ({
  rootCategories,
  isLoadingCategories = false,
  categoriesError = null,
  onRetryCategories,
}) => {
  // Lọc và sắp xếp tối đa 8 root categories ưu tiên theo componentType numeric rồi id ổn định
  const targetRoots = useMemo(() => {
    if (!Array.isArray(rootCategories) || rootCategories.length === 0) {
      return []
    }
    const filtered = rootCategories.filter((cat) => !cat.parentId || cat.parentId.trim() === '')
    const sorted = [...filtered].sort((a, b) => {
      const typeDiff = (a.componentType ?? 99) - (b.componentType ?? 99)
      if (typeDiff !== 0) return typeDiff
      return a.id.localeCompare(b.id)
    })
    return sorted.slice(0, MAX_ROOT_ROWS)
  }, [rootCategories])

  // Trạng thái sản phẩm theo từng categoryId
  const [rowStates, setRowStates] = useState<Record<string, RowData>>({})
  const [retryMap, setRetryMap] = useState<Record<string, number>>({})

  // Lifecycle ref để ngăn chặn ghi đè khi unmount hoặc đổi roots
  const isMountedRef = useRef(true)
  const activeReqSeqRef = useRef<Record<string, number>>({})

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Nạp sản phẩm cho các rows với concurrency pool tối đa 3 requests đồng thời
  useEffect(() => {
    if (targetRoots.length === 0) {
      setRowStates({})
      return
    }

    const abortController = new AbortController()
    const { signal } = abortController

    // Khởi tạo trạng thái ban đầu cho các root chưa có dữ liệu
    setRowStates((prev) => {
      const next: Record<string, RowData> = {}
      for (const root of targetRoots) {
        if (prev[root.id]) {
          next[root.id] = prev[root.id]
        } else {
          next[root.id] = { products: [], isLoading: true, error: null }
        }
      }
      return next
    })

    // Queue xử lý tối đa 3 requests đồng thời
    let queueIndex = 0
    const queueRoots = [...targetRoots]

    const processNext = async (): Promise<void> => {
      while (queueIndex < queueRoots.length) {
        if (!isMountedRef.current || signal.aborted) return

        const currentRoot = queueRoots[queueIndex++]
        const rootId = currentRoot.id
        const seq = (activeReqSeqRef.current[rootId] ?? 0) + 1
        activeReqSeqRef.current[rootId] = seq

        if (isMountedRef.current) {
          setRowStates((prev) => ({
            ...prev,
            [rootId]: {
              products: prev[rootId]?.products ?? [],
              isLoading: true,
              error: null,
            },
          }))
        }

        try {
          const res = await getProducts(
            {
              pageIndex: 1,
              pageSize: 5,
              categoryId: currentRoot.id,
              componentType: currentRoot.componentType,
              sortBy: 1, // Mới nhất
            },
            signal
          )

          if (!isMountedRef.current || signal.aborted || activeReqSeqRef.current[rootId] !== seq) {
            return
          }

          setRowStates((prev) => ({
            ...prev,
            [rootId]: {
              products: res?.items ?? [],
              isLoading: false,
              error: null,
            },
          }))
        } catch (err: unknown) {
          if (!isMountedRef.current || signal.aborted || activeReqSeqRef.current[rootId] !== seq) {
            return
          }
          if (err instanceof DOMException && err.name === 'AbortError') return

          setRowStates((prev) => ({
            ...prev,
            [rootId]: {
              products: prev[rootId]?.products ?? [],
              isLoading: false,
              error: err instanceof Error ? err : new Error(String(err)),
            },
          }))
        }
      }
    }

    const poolSize = Math.min(MAX_CONCURRENT_REQUESTS, targetRoots.length)
    const workers = Array.from({ length: poolSize }, () => processNext())

    return () => {
      abortController.abort()
      void Promise.all(workers)
    }
  }, [targetRoots, retryMap])

  const handleRetrySingleRow = (root: Category) => {
    setRetryMap((prev) => ({
      ...prev,
      [root.id]: (prev[root.id] ?? 0) + 1,
    }))
  }

  // 1. Trạng thái Loading ban đầu của Category tree
  if (isLoadingCategories && targetRoots.length === 0) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-7 w-48 bg-slate-200 rounded-lg" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="h-72 bg-slate-100 rounded-2xl border border-slate-200/60" />
              ))}
            </div>
          </div>
        ))}
      </section>
    )
  }

  // 2. Trạng thái lỗi toàn bộ Categories
  if (categoriesError && targetRoots.length === 0) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Không thể tải danh mục sản phẩm
          </h3>
          <p className="text-xs text-slate-500 mb-5 leading-relaxed">
            Đã có sự cố khi tải danh sách phân loại linh kiện từ máy chủ. Bạn có thể thử lại hoặc truy cập trực tiếp danh mục sản phẩm.
          </p>
          <div className="flex items-center justify-center gap-3">
            {onRetryCategories && (
              <button
                type="button"
                onClick={onRetryCategories}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            )}
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              <span>Xem danh mục</span>
            </Link>
          </div>
        </div>
      </section>
    )
  }

  // Đếm số rows hiển thị hợp lệ (đang load, có lỗi hoặc có > 0 sản phẩm)
  const visibleRoots = targetRoots.filter((root) => {
    const state = rowStates[root.id]
    if (!state) return true // Chưa load xong
    if (state.isLoading) return true
    if (state.error) return true
    return state.products.length > 0
  })

  // 3. Không có root nào có sản phẩm
  if (visibleRoots.length === 0 && !isLoadingCategories) {
    return (
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-10 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Xem Toàn Bộ Danh Mục Linh Kiện
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Khám phá đầy đủ các linh kiện máy tính, dễ dàng lọc theo thông số kỹ thuật và chọn mua sản phẩm phù hợp.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition-colors shadow-md shadow-red-600/25"
          >
            <span>Xem tất cả linh kiện</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
      {visibleRoots.map((root) => {
        const rowState = rowStates[root.id]
        const isLoadingRow = rowState?.isLoading ?? true
        const rowError = rowState?.error ?? null
        const products = rowState?.products ?? []

        // Lấy danh mục con để hiển thị link nhanh ở header (tối đa 4 mục)
        const subCategories = Array.isArray(root.subCategories)
          ? root.subCategories.slice(0, 4)
          : []

        return (
          <section key={root.id} className="w-full">
            {/* Row Header: Category Name + Child Links + Xem Tất Cả */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-3 pb-3 border-b border-slate-200/80">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block mb-0.5">
                  Linh Kiện Phần Cứng
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
                  {root.name}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                {subCategories.map((sub) => (
                  <Link
                    key={sub.id}
                    to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors font-medium text-[11px] truncate max-w-[140px]"
                  >
                    {sub.name}
                  </Link>
                ))}

                <Link
                  to={`/products?categoryId=${root.id}&componentType=${root.componentType}`}
                  className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 transition-colors ml-1"
                >
                  <span>Xem tất cả</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Row Content: Loading Skeleton, Row Error hoặc Product Cards */}
            {isLoadingRow ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="h-72 bg-slate-100 rounded-2xl border border-slate-200/60"
                  />
                ))}
              </div>
            ) : rowError ? (
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-slate-600 text-xs">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <span>
                    Không thể tải danh sách sản phẩm cho nhóm{' '}
                    <strong className="text-slate-900">{root.name}</strong>.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetrySingleRow(root)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại nhóm này</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
