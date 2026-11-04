import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Eye,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import {
  ADMIN_ORDERS_PAGE_SIZE,
  applyManagedOrdersFilterChange,
  buildManagedOrdersSearchParams,
  createManagedOrderListCoordinator,
  formatOrderCurrency,
  formatOrderDateTime,
  getContextualPaymentStatusHint,
  getSafePaymentMethodLabel,
  isValidOrderStatus,
  isValidPaymentMethod,
  isValidPaymentStatus,
  MAX_ORDER_SEARCH_LENGTH,
  normalizeManagedOrdersQuery,
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_METHODS,
  VALID_PAYMENT_STATUSES,
  type ManagedOrderListState,
} from '../../features/admin/adminOrderHelper'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../features/orders/components/OrderStatusBadge'
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../../features/orders/orderConstants'
import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../features/orders/orderTypes'

export const AdminOrdersPage: React.FC = () => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const normalizedQuery = useMemo(
    () => normalizeManagedOrdersQuery(searchParams),
    [searchParams]
  )

  const [searchInput, setSearchInput] = useState(normalizedQuery.search)
  const [prevUrlSearch, setPrevUrlSearch] = useState(normalizedQuery.search)
  if (normalizedQuery.search !== prevUrlSearch) {
    setPrevUrlSearch(normalizedQuery.search)
    setSearchInput(normalizedQuery.search)
  }

  const [listState, setListState] = useState<ManagedOrderListState>({
    data: null,
    isLoading: true,
    error: null,
    errorCode: null,
    isForbidden: false,
    loadedQueryKey: null,
  })

  const authRef = useRef({
    authStatus,
    user,
    getAccessToken,
  })

  useEffect(() => {
    authRef.current = {
      authStatus,
      user,
      getAccessToken,
    }
  }, [authStatus, user, getAccessToken])

  const coordinatorRef = useRef<ReturnType<
    typeof createManagedOrderListCoordinator
  > | null>(null)

  const getCoordinator = useCallback(() => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = createManagedOrderListCoordinator({
        getAuthContext: () => authRef.current,
        onStateChange: (nextState) => {
          setListState(nextState)
        },
      })
    }
    return coordinatorRef.current
  }, [])

  useEffect(() => {
    const coord = getCoordinator()
    return () => {
      coord.dispose()
      coordinatorRef.current = null
    }
  }, [getCoordinator])

  const triggerLoad = useCallback(() => {
    void getCoordinator().loadOrders(normalizedQuery)
  }, [getCoordinator, normalizedQuery])

  useEffect(() => {
    authRef.current = {
      authStatus,
      user,
      getAccessToken,
    }
    const coord = getCoordinator()
    coord.syncAuthOwner()
    void Promise.resolve().then(() => {
      void coord.loadOrders(normalizedQuery)
    })
  }, [authStatus, user, getAccessToken, normalizedQuery, getCoordinator])

  const updateUrlQuery = (next: typeof normalizedQuery) => {
    const params = buildManagedOrdersSearchParams(next)
    setSearchParams(params, { replace: false })
  }

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const next = applyManagedOrdersFilterChange(normalizedQuery, {
      search: searchInput,
    })
    updateUrlQuery(next)
  }

  const handleClearSearchInput = () => {
    setSearchInput('')
    if (normalizedQuery.search) {
      const next = applyManagedOrdersFilterChange(normalizedQuery, {
        search: '',
      })
      updateUrlQuery(next)
    }
  }

  const handleStatusFilterChange = (raw: string) => {
    const next = applyManagedOrdersFilterChange(normalizedQuery, {
      status: isValidOrderStatus(raw) ? (raw as OrderStatus) : undefined,
    })
    updateUrlQuery(next)
  }

  const handlePaymentMethodFilterChange = (raw: string) => {
    const next = applyManagedOrdersFilterChange(normalizedQuery, {
      paymentMethod: isValidPaymentMethod(raw)
        ? (raw as PaymentMethod)
        : undefined,
    })
    updateUrlQuery(next)
  }

  const handlePaymentStatusFilterChange = (raw: string) => {
    const next = applyManagedOrdersFilterChange(normalizedQuery, {
      paymentStatus: isValidPaymentStatus(raw)
        ? (raw as PaymentStatus)
        : undefined,
    })
    updateUrlQuery(next)
  }

  const handleResetAllFilters = () => {
    setSearchInput('')
    setSearchParams(new URLSearchParams(), { replace: false })
  }

  const handlePageChange = (nextPage: number) => {
    const safePage = Math.max(1, Math.trunc(nextPage))
    updateUrlQuery({
      ...normalizedQuery,
      pageIndex: safePage,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasActiveFilters =
    Boolean(normalizedQuery.search) ||
    Boolean(normalizedQuery.status) ||
    Boolean(normalizedQuery.paymentMethod) ||
    Boolean(normalizedQuery.paymentStatus)

  const orders = listState.data?.items ?? []
  const totalCount = listState.data?.totalCount ?? 0
  const totalPages = Math.max(1, listState.data?.totalPages ?? 1)
  const currentPageIndex =
    listState.data?.pageIndex ?? normalizedQuery.pageIndex
  const hasPreviousPage = Boolean(listState.data?.hasPreviousPage)
  const hasNextPage = Boolean(listState.data?.hasNextPage)

  return (
    <div className="space-y-6">
      {/* Header trang */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl flex items-center gap-2.5">
            <ClipboardList className="h-6 w-6 text-red-600 flex-shrink-0" />
            <span>Quản Lý Đơn Hàng</span>
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Tra cứu, lọc và xử lý giao nhận đơn hàng COD &amp; Stripe trên toàn hệ thống
            (sắp xếp mới nhất trước).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerLoad}
            disabled={listState.isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${listState.isLoading ? 'animate-spin' : ''}`}
            />
            <span>Tải lại dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Khối Tìm kiếm & Bộ lọc */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              maxLength={MAX_ORDER_SEARCH_LENGTH}
              onChange={(e) =>
                setSearchInput(e.target.value.slice(0, MAX_ORDER_SEARCH_LENGTH))
              }
              placeholder="Tìm theo mã đơn hàng, tên người nhận, email hoặc số điện thoại..."
              aria-label="Từ khóa tìm kiếm đơn hàng"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-8 pl-9 text-xs text-slate-900 outline-none focus:border-blue-600"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearchInput}
                aria-label="Xóa từ khóa tìm kiếm"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={listState.isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Tìm kiếm</span>
          </button>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* Lọc trạng thái đơn hàng */}
          <div>
            <label
              htmlFor="admin-orders-status-filter"
              className="mb-1 block text-[11px] font-bold text-slate-600"
            >
              Trạng thái đơn hàng
            </label>
            <select
              id="admin-orders-status-filter"
              value={normalizedQuery.status ?? ''}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả trạng thái đơn</option>
              {VALID_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc phương thức thanh toán */}
          <div>
            <label
              htmlFor="admin-orders-method-filter"
              className="mb-1 block text-[11px] font-bold text-slate-600"
            >
              Phương thức thanh toán
            </label>
            <select
              id="admin-orders-method-filter"
              value={normalizedQuery.paymentMethod ?? ''}
              onChange={(e) => handlePaymentMethodFilterChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả phương thức</option>
              {VALID_PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {PAYMENT_METHOD_LABELS[pm]}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc trạng thái thanh toán */}
          <div>
            <label
              htmlFor="admin-orders-paystatus-filter"
              className="mb-1 block text-[11px] font-bold text-slate-600"
            >
              Trạng thái thanh toán
            </label>
            <select
              id="admin-orders-paystatus-filter"
              value={normalizedQuery.paymentStatus ?? ''}
              onChange={(e) => handlePaymentStatusFilterChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả trạng thái thanh toán</option>
              {VALID_PAYMENT_STATUSES.map((ps) => (
                <option key={ps} value={ps}>
                  {PAYMENT_STATUS_LABELS[ps]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Tổng số:{' '}
              <strong className="text-slate-900">
                {listState.data ? totalCount : '—'}
              </strong>{' '}
              đơn hàng
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] text-slate-500">
              Hiển thị tối đa {ADMIN_ORDERS_PAGE_SIZE} đơn/trang
            </span>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200"
            >
              <X className="h-3 w-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Bảng / Danh sách đơn hàng */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {listState.error ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center gap-3 p-10 text-center"
          >
            {listState.isForbidden ? (
              <ShieldAlert className="h-9 w-9 text-rose-600" />
            ) : (
              <AlertCircle className="h-9 w-9 text-rose-600" />
            )}
            <div className="max-w-md space-y-1">
              <p className="text-sm font-bold text-slate-900">
                {listState.isForbidden
                  ? 'Không có quyền truy cập danh sách đơn hàng'
                  : 'Không thể tải danh sách đơn hàng'}
              </p>
              <p className="text-xs text-rose-700">{listState.error}</p>
            </div>
            <button
              type="button"
              onClick={triggerLoad}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : listState.isLoading || !listState.data ? (
          <div
            aria-busy="true"
            aria-label="Đang tải danh sách đơn hàng quản trị"
            className="divide-y divide-slate-100 p-4 space-y-3"
          >
            {[1, 2, 3, 4, 5].map((skeletonId) => (
              <div
                key={skeletonId}
                className="flex flex-wrap items-center justify-between gap-4 py-3 animate-pulse"
              >
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-slate-200" />
                  <div className="h-3 w-32 rounded bg-slate-100" />
                </div>
                <div className="h-5 w-28 rounded-full bg-slate-200" />
                <div className="h-8 w-24 rounded-lg bg-slate-200" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 px-4 text-center">
            <ClipboardList className="h-10 w-10 text-slate-300" />
            <div className="space-y-1 max-w-md">
              <p className="text-sm font-bold text-slate-800">
                {hasActiveFilters
                  ? 'Không tìm thấy đơn hàng phù hợp với bộ lọc'
                  : 'Chưa có đơn hàng nào trên hệ thống'}
              </p>
              <p className="text-xs text-slate-500">
                {hasActiveFilters
                  ? 'Hãy thử điều chỉnh từ khóa tìm kiếm hoặc xóa bộ lọc để xem toàn bộ đơn hàng.'
                  : 'Các đơn đặt hàng COD và Stripe của khách hàng sẽ xuất hiện tại đây.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetAllFilters}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                  <th className="px-4 py-3">Mã đơn hàng</th>
                  <th className="px-3 py-3">Khách hàng</th>
                  <th className="px-3 py-3">Phương thức</th>
                  <th className="px-3 py-3 text-right">Tổng thanh toán</th>
                  <th className="px-3 py-3 text-center">Trạng thái đơn</th>
                  <th className="px-3 py-3 text-center">Thanh toán</th>
                  <th className="px-3 py-3">Thời gian</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const detailHref = `/admin/orders/${encodeURIComponent(order.id)}`
                  const paymentHint = getContextualPaymentStatusHint(order)

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 align-top">
                        <Link
                          to={detailHref}
                          state={{ fromOrdersSearch: location.search }}
                          className="font-mono font-bold text-slate-900 hover:text-blue-600"
                        >
                          #{order.orderNumber}
                        </Link>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {order.itemCount} dòng sản phẩm
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span>{order.customerName}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-600 flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          <span>{order.customerPhone}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 flex items-center gap-1.5 break-all">
                          <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                          <span>{order.customerEmail}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 align-top">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-800">
                          <CreditCard className="h-3 w-3 text-slate-500 flex-shrink-0" />
                          <span>
                            {getSafePaymentMethodLabel(order.paymentMethod)}
                          </span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                        <div className="font-mono font-bold text-slate-900">
                          {formatOrderCurrency(
                            order.finalAmount,
                            order.currency
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                          {order.currency || 'VND'}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center align-top">
                        <OrderStatusBadge status={order.status} />
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center align-top">
                        <div className="flex flex-col items-center gap-1">
                          <PaymentStatusBadge status={order.paymentStatus} />
                          {paymentHint && (
                            <span className="text-[10px] font-semibold text-amber-700">
                              {paymentHint}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 align-top text-[11px] text-slate-600">
                        <div>Tạo: {formatOrderDateTime(order.createdAt)}</div>
                        {order.updatedAt && (
                          <div className="mt-0.5 text-slate-400">
                            Cập nhật: {formatOrderDateTime(order.updatedAt)}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                        <Link
                          to={detailHref}
                          state={{ fromOrdersSearch: location.search }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Xem chi tiết</span>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang Server */}
        {listState.data && (totalPages > 1 || currentPageIndex > 1) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang <strong>{currentPageIndex}</strong> /{' '}
              <strong>{totalPages}</strong> (Tổng cộng{' '}
              <strong>{totalCount}</strong> đơn hàng)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={
                  listState.isLoading ||
                  (!hasPreviousPage && currentPageIndex <= 1)
                }
                onClick={() => handlePageChange(currentPageIndex - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Trang trước</span>
              </button>
              <button
                type="button"
                disabled={
                  listState.isLoading ||
                  !hasNextPage ||
                  currentPageIndex >= totalPages
                }
                onClick={() => handlePageChange(currentPageIndex + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                <span>Trang sau</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
