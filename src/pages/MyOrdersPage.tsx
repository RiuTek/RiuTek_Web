import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Package,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Filter,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { getMyOrders } from '../features/orders/orderApi'
import { ORDER_STATUS_LABELS } from '../features/orders/orderConstants'
import type {
  OrderStatus,
  OrderSummaryDto,
  PagedResult,
} from '../features/orders/orderTypes'
import { OrderSummaryCard } from '../features/orders/components/OrderSummaryCard'

const VALID_STATUSES: OrderStatus[] = [
  'PendingPayment',
  'Confirmed',
  'Processing',
  'Shipping',
  'Completed',
  'Cancelled',
  'Refunded',
]

export const MyOrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { getAccessToken } = useAuth()

  // Parse and normalize query params
  const rawPage = searchParams.get('page')
  const rawStatus = searchParams.get('status')

  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1
  const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage
  const currentStatus =
    rawStatus && VALID_STATUSES.includes(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : undefined

  const [data, setData] = useState<PagedResult<OrderSummaryDto> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Track the query key currently being fetched / displayed
  const currentQueryKey = `${currentPage}-${currentStatus ?? ''}-${reloadKey}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)

  const isLoading = loadedQueryKey !== currentQueryKey && error === null

  // Handle filter changes
  const handleStatusChange = (status?: OrderStatus) => {
    const nextParams = new URLSearchParams()
    if (status) {
      nextParams.set('status', status)
    }
    // Changing filter always resets to page 1
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('page', String(newPage))
    setSearchParams(nextParams)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRetry = () => {
    setError(null)
    setReloadKey((prev) => prev + 1)
  }

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyOrders(
          {
            pageIndex: currentPage,
            pageSize: 10,
            status: currentStatus,
          },
          token,
          abortController.signal
        )
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          return getAccessToken(true).then((newToken) => {
            if (!newToken) throw err
            return getMyOrders(
              {
                pageIndex: currentPage,
                pageSize: 10,
                status: currentStatus,
              },
              newToken,
              abortController.signal
            )
          })
        }
        throw err
      })
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return
        setError(
          'Không thể tải danh sách đơn hàng. Vui lòng kiểm tra kết nối mạng và thử lại.'
        )
        setLoadedQueryKey(currentQueryKey)
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [currentPage, currentStatus, currentQueryKey, getAccessToken])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-red-600" />
            <span>Đơn Hàng Của Tôi</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Theo dõi, tra cứu trạng thái và lịch sử tất cả các đơn hàng bạn đã đặt.
          </p>
        </div>

        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs self-start sm:self-auto"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Mua sắm linh kiện</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => handleStatusChange(undefined)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            currentStatus === undefined
              ? 'bg-slate-950 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>Tất cả</span>
        </button>

        {VALID_STATUSES.map((statusKey) => (
          <button
            key={statusKey}
            type="button"
            onClick={() => handleStatusChange(statusKey)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              currentStatus === statusKey
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {ORDER_STATUS_LABELS[statusKey]}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          className="space-y-4"
          aria-busy="true"
          aria-label="Đang tải danh sách đơn hàng"
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="h-5 bg-slate-200 rounded-md w-36" />
                <div className="h-5 bg-slate-200 rounded-full w-24" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="h-4 bg-slate-100 rounded w-28" />
                <div className="h-4 bg-slate-100 rounded w-32" />
                <div className="h-4 bg-slate-100 rounded w-24" />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <div className="h-6 bg-slate-200 rounded w-32" />
                <div className="h-8 bg-slate-200 rounded-xl w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty States */}
      {!isLoading && !error && data && data.items.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              {currentStatus
                ? `Không có đơn hàng nào ở trạng thái "${ORDER_STATUS_LABELS[currentStatus]}"`
                : 'Bạn chưa có đơn hàng nào'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              {currentStatus
                ? 'Hãy thử chọn trạng thái khác hoặc xem toàn bộ danh sách đơn hàng.'
                : 'Khám phá ngay hàng trăm linh kiện máy tính chính hãng và tạo cấu hình mơ ước cùng RiuTek.'}
            </p>
          </div>

          <div className="pt-2">
            {currentStatus ? (
              <button
                type="button"
                onClick={() => handleStatusChange(undefined)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition-colors"
              >
                <span>Xem tất cả đơn hàng</span>
              </button>
            ) : (
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold transition-colors shadow-xs"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Khám phá sản phẩm ngay</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Order List */}
      {!isLoading && !error && data && data.items.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-4">
            {data.items.map((order) => (
              <OrderSummaryCard key={order.id} order={order} />
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 text-xs sm:text-sm text-slate-600">
            <div>
              <span>
                Hiển thị trang <strong>{data.pageIndex}</strong> /{' '}
                <strong>{data.totalPages || 1}</strong> (Tổng cộng{' '}
                <strong>{data.totalCount}</strong> đơn hàng)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(data.pageIndex - 1)}
                disabled={!data.hasPreviousPage || data.pageIndex <= 1}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>

              <button
                type="button"
                onClick={() => handlePageChange(data.pageIndex + 1)}
                disabled={!data.hasNextPage || data.pageIndex >= data.totalPages}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
