import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import {
  createManagedOrderDetailCoordinator,
  formatOrderCurrency,
  formatOrderDateTime,
  getContextualPaymentStatusHint,
  getSafeOrderStatusLabel,
  getSafePaymentMethodLabel,
  resolveBackToOrdersHref,
  resolveManagedOrderActions,
  type ManagedOrderDetailState,
} from '../../features/admin/adminOrderHelper'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../features/orders/components/OrderStatusBadge'

interface LocationRouteState {
  fromOrdersSearch?: string
}

export const AdminOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const location = useLocation()
  const { status: authStatus, user, getAccessToken } = useAuth()

  const routeState = (location.state as LocationRouteState | null) ?? null
  const backToOrdersHref = useMemo(
    () => resolveBackToOrdersHref(routeState?.fromOrdersSearch),
    [routeState?.fromOrdersSearch]
  )

  const [detailState, setDetailState] = useState<ManagedOrderDetailState>({
    orderId: orderId ?? null,
    order: null,
    isLoading: true,
    loadError: null,
    loadErrorCode: null,
    isNotFound: false,
    isUserNotFound: false,
    isForbidden: false,
    isStale: false,
    isOutcomeAmbiguous: false,
    isSubmitting: false,
    confirmSnapshot: null,
    mutationError: null,
    mutationErrorCode: null,
    mutationSuccessMessage: null,
  })

  const contextRef = useRef({
    authStatus,
    user,
    getAccessToken,
    orderId: orderId ?? null,
  })

  useEffect(() => {
    contextRef.current = {
      authStatus,
      user,
      getAccessToken,
      orderId: orderId ?? null,
    }
  }, [authStatus, user, getAccessToken, orderId])

  const coordinatorRef = useRef<ReturnType<
    typeof createManagedOrderDetailCoordinator
  > | null>(null)

  const getCoordinator = useCallback(() => {
    if (!coordinatorRef.current) {
      coordinatorRef.current = createManagedOrderDetailCoordinator({
        getContext: () => contextRef.current,
        onStateChange: (nextState) => {
          setDetailState(nextState)
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

  useEffect(() => {
    contextRef.current = {
      authStatus,
      user,
      getAccessToken,
      orderId: orderId ?? null,
    }
    const coord = getCoordinator()
    coord.syncContext()
    void Promise.resolve().then(() => {
      void coord.loadOrderDetail()
    })
  }, [authStatus, user, getAccessToken, orderId, getCoordinator])

  const confirmSubmitBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (detailState.confirmSnapshot && confirmSubmitBtnRef.current) {
      confirmSubmitBtnRef.current.focus()
    }
  }, [detailState.confirmSnapshot])

  useEffect(() => {
    if (!detailState.confirmSnapshot) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !detailState.isSubmitting) {
        getCoordinator().closeConfirmDialog()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [detailState.confirmSnapshot, detailState.isSubmitting, getCoordinator])

  const handleReloadOrder = useCallback(() => {
    void getCoordinator().recoverOrderState()
  }, [getCoordinator])

  const handleConfirmSubmit = () => {
    void getCoordinator().submitConfirmedStatusChange()
  }

  const handleCloseConfirm = () => {
    getCoordinator().closeConfirmDialog()
  }

  const order =
    detailState.order && detailState.order.id === orderId
      ? detailState.order
      : null

  const actionResolution = useMemo(
    () => (order ? resolveManagedOrderActions(order) : null),
    [order]
  )

  const actionsLocked =
    detailState.isLoading ||
    detailState.isSubmitting ||
    detailState.isStale ||
    detailState.isOutcomeAmbiguous ||
    detailState.isForbidden

  if (detailState.isLoading && !order) {
    return (
      <div
        aria-busy="true"
        aria-label="Đang tải chi tiết đơn hàng quản trị"
        className="space-y-6"
      >
        <div className="h-5 w-40 rounded bg-slate-200 animate-pulse" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-7 w-52 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded-full bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-28 rounded-xl bg-slate-100" />
            <div className="h-28 rounded-xl bg-slate-100" />
          </div>
          <div className="h-44 rounded-xl bg-slate-100" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            to={backToOrdersHref}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại danh sách đơn hàng</span>
          </Link>
        </div>

        <div
          role="alert"
          className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center space-y-4 max-w-xl mx-auto shadow-xs"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-200">
            {detailState.isForbidden ? (
              <ShieldAlert className="h-7 w-7" />
            ) : (
              <AlertCircle className="h-7 w-7" />
            )}
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-black text-slate-900">
              {detailState.isNotFound
                ? 'Không tìm thấy đơn hàng'
                : detailState.isUserNotFound
                  ? 'Không tìm thấy tài khoản quản trị'
                  : detailState.isForbidden
                    ? 'Không có quyền truy cập đơn hàng'
                    : 'Không thể tải chi tiết đơn hàng'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {detailState.loadError ??
                'Đơn hàng không tồn tại hoặc đã xảy ra lỗi khi truy xuất dữ liệu.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {!detailState.isNotFound && (
              <button
                type="button"
                onClick={handleReloadOrder}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Thử lại</span>
              </button>
            )}
            <Link
              to={backToOrdersHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Về danh sách đơn hàng</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const paymentHint = getContextualPaymentStatusHint(order)
  const confirmSnapshot = detailState.confirmSnapshot

  return (
    <div className="space-y-6">
      {/* Thanh điều hướng trên cùng */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={backToOrdersHref}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại danh sách đơn hàng</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            Ngày tạo: <strong>{formatOrderDateTime(order.createdAt)}</strong>
          </span>
          <button
            type="button"
            onClick={handleReloadOrder}
            disabled={detailState.isLoading || detailState.isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                detailState.isLoading ? 'animate-spin' : ''
              }`}
            />
            <span>Tải lại dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Thông báo thành công sau khi cập nhật trạng thái */}
      {detailState.mutationSuccessMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm font-medium text-emerald-800 shadow-xs"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <span>{detailState.mutationSuccessMessage}</span>
        </div>
      )}

      {/* Cảnh báo lỗi hoặc trạng thái chưa xác định (409 / timeout / mạng / reload lỗi) */}
      {(detailState.mutationError || detailState.loadError) && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 shadow-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              {detailState.mutationError && (
                <p className="font-semibold">{detailState.mutationError}</p>
              )}
              {detailState.loadError && (
                <p className="text-rose-700">{detailState.loadError}</p>
              )}
            </div>
          </div>

          {(detailState.isOutcomeAmbiguous ||
            detailState.isStale ||
            Boolean(detailState.loadError)) && (
            <button
              type="button"
              onClick={handleReloadOrder}
              disabled={detailState.isLoading || detailState.isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 self-start sm:self-auto whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>
                {detailState.isOutcomeAmbiguous
                  ? 'Kiểm tra lại đơn hàng'
                  : 'Tải lại đơn hàng'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Khối thông tin chính của đơn hàng */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs">
        {/* Header đơn hàng */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100 flex-shrink-0">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Đơn hàng quản trị
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                #{order.orderNumber}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            {paymentHint && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {paymentHint}
              </span>
            )}
          </div>
        </div>

        {/* Khối Xử lý Giao nhận (Fulfillment Actions) */}
        {actionResolution && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-blue-600" />
                  <span>Xử Lý Giao Nhận &amp; Trạng Thái Đơn Hàng</span>
                </h2>
                <p className="text-xs text-slate-600">
                  {actionResolution.statusGuidance}
                </p>
              </div>

              {/* Các nút thao tác theo đúng ma trận */}
              {actionResolution.actions.length > 0 && !confirmSnapshot && (
                <div className="flex flex-wrap items-center gap-2">
                  {actionResolution.actions.map((action) => {
                    const btnColorClass =
                      action.variant === 'success'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : action.variant === 'danger'
                          ? 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'

                    return (
                      <button
                        key={action.targetStatus}
                        type="button"
                        disabled={actionsLocked}
                        onClick={() =>
                          getCoordinator().openConfirmDialog(
                            action.targetStatus
                          )
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed ${btnColorClass}`}
                      >
                        <span>{action.buttonLabel}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Thông báo ngữ cảnh COD / Stripe / Paid Online */}
            {actionResolution.stripePendingNotice && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span className="font-semibold">
                    {actionResolution.stripePendingNotice}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleReloadOrder}
                  disabled={detailState.isLoading || detailState.isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 self-start sm:self-auto"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Tải lại dữ liệu</span>
                </button>
              </div>
            )}

            {actionResolution.codPendingNotice && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2.5 text-xs text-blue-900">
                {actionResolution.codPendingNotice}
              </div>
            )}

            {actionResolution.paidOnlineCancelNotice && (
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700">
                {actionResolution.paidOnlineCancelNotice}
              </div>
            )}

            {(detailState.isOutcomeAmbiguous || detailState.isStale) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                <span>
                  Các nút chuyển trạng thái đang tạm khóa cho đến khi đồng bộ lại
                  trạng thái mới nhất từ máy chủ.
                </span>
                <button
                  type="button"
                  onClick={handleReloadOrder}
                  disabled={detailState.isLoading || detailState.isSubmitting}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white hover:bg-amber-800 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Kiểm tra lại đơn hàng</span>
                </button>
              </div>
            )}

            {/* Hộp xác nhận thao tác chuyển trạng thái */}
            {confirmSnapshot && (
              <div
                role="dialog"
                aria-modal="false"
                aria-labelledby="admin-order-confirm-title"
                aria-describedby="admin-order-confirm-desc"
                className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
                  confirmSnapshot.newStatus === 'Cancelled'
                    ? 'border-rose-200 bg-rose-50'
                    : 'border-blue-200 bg-blue-50/70'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {confirmSnapshot.newStatus === 'Cancelled' ? (
                    <XCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1.5 flex-1">
                    <h3
                      id="admin-order-confirm-title"
                      className="text-xs sm:text-sm font-black text-slate-900"
                    >
                      {confirmSnapshot.confirmTitle} (#{confirmSnapshot.orderNumber})
                    </h3>

                    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 border border-slate-200/80">
                      <span>
                        {getSafeOrderStatusLabel(confirmSnapshot.expectedStatus)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-blue-700">
                        {getSafeOrderStatusLabel(confirmSnapshot.newStatus)}
                      </span>
                    </div>

                    <p
                      id="admin-order-confirm-desc"
                      className="text-xs text-slate-800 font-medium"
                    >
                      {confirmSnapshot.confirmDescription}
                    </p>
                    <p className="text-xs text-slate-600">
                      {confirmSnapshot.confirmConsequenceNote}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    ref={confirmSubmitBtnRef}
                    type="button"
                    onClick={handleConfirmSubmit}
                    disabled={detailState.isSubmitting}
                    aria-busy={detailState.isSubmitting}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 ${
                      confirmSnapshot.newStatus === 'Cancelled'
                        ? 'bg-rose-600 hover:bg-rose-700'
                        : confirmSnapshot.newStatus === 'Completed'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {detailState.isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang cập nhật...</span>
                      </>
                    ) : (
                      <span>{confirmSnapshot.confirmSubmitLabel}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseConfirm}
                    disabled={detailState.isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <span>Hủy bỏ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Thông tin Khách hàng & Nhận hàng */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <User className="h-4 w-4 text-slate-400" />
              <span>Thông Tin Người Nhận</span>
            </h2>
            <div className="space-y-1.5 text-slate-700">
              <p className="text-sm font-bold text-slate-900">
                {order.customerName}
              </p>
              <p className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>{order.customerPhone}</span>
              </p>
              <p className="flex items-center gap-1.5 break-all">
                <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>{order.customerEmail}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5 text-xs">
            <h2 className="font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>Địa Chỉ Giao Hàng &amp; Thanh Toán</span>
            </h2>
            <div className="space-y-1.5 text-slate-700">
              <p className="font-medium text-slate-900">
                {order.shippingAddress}
              </p>
              <p className="flex items-center gap-1.5 pt-1">
                <CreditCard className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                <span>
                  Phương thức:{' '}
                  <strong className="text-slate-900">
                    {getSafePaymentMethodLabel(order.paymentMethod)}
                  </strong>
                </span>
              </p>
              {order.notes && (
                <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600">
                  <span className="font-bold text-slate-800">
                    Ghi chú đơn hàng:{' '}
                  </span>
                  <span className="whitespace-pre-wrap break-words">
                    {order.notes}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bảng Snapshot Sản phẩm trong đơn hàng */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-red-600" />
              <span>
                Danh Sách Sản Phẩm Snapshot ({order.items.length} dòng sản phẩm)
              </span>
            </h2>
            <span className="text-[11px] text-slate-500">
              Đơn vị tiền tệ: <strong>{order.currency || 'VND'}</strong>
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5">Sản phẩm (Snapshot lúc đặt)</th>
                  <th className="px-3 py-2.5">Mã SKU</th>
                  <th className="px-3 py-2.5 text-right">Đơn giá</th>
                  <th className="px-3 py-2.5 text-center">Số lượng</th>
                  <th className="px-4 py-2.5 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item) => (
                  <tr key={item.productId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {item.productName}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-700">
                      {item.productSku}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-slate-700">
                      {formatOrderCurrency(item.unitPrice, order.currency)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-center font-mono font-bold text-slate-900">
                      {item.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono font-bold text-slate-900">
                      {formatOrderCurrency(item.totalPrice, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tổng kết tiền hàng / giảm giá / thành tiền */}
        <div className="border-t border-slate-100 pt-4">
          <div className="ml-auto max-w-sm space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Tổng tiền hàng:</span>
              <span className="font-mono font-semibold text-slate-900">
                {formatOrderCurrency(order.totalAmount, order.currency)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Giảm giá:</span>
              <span className="font-mono font-semibold text-emerald-700">
                {order.discountAmount > 0
                  ? `-${formatOrderCurrency(order.discountAmount, order.currency)}`
                  : formatOrderCurrency(0, order.currency)}
              </span>
            </div>

            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2.5 text-sm sm:text-base font-black">
              <span className="text-slate-900">Tổng thanh toán:</span>
              <span className="font-mono text-base sm:text-lg text-red-600">
                {formatOrderCurrency(order.finalAmount, order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
