import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  ChevronLeft,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
  Zap,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Trash2,
  Loader2,
  ArrowRight,
  ShieldAlert,
  ImageOff,
  Check,
  PackageCheck,
  PackageX,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { UserRole } from '../features/auth/authTypes'
import { useCart } from '../features/cart/CartContext'
import { formatVnd, COMPONENT_TYPE_LABELS } from '../features/products/productConstants'
import { getMyPCBuildById, deleteMyPCBuild } from '../features/pcBuilder/pcBuilderApi'
import {
  type MyPCBuild,
  type MyPCBuildItem,
  PCBuildStatus,
  getPCBuildStatusLabel,
  isOrderedBuild,
} from '../features/pcBuilder/pcBuilderTypes'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

interface ComponentRowProps {
  item: MyPCBuildItem
}

const ComponentRow: React.FC<ComponentRowProps> = ({ item }) => {
  const [imgError, setImgError] = useState(false)
  const isPriceChanged = item.currentPrice !== item.unitPrice
  const priceDiff = item.currentPrice - item.unitPrice

  const typeLabel =
    COMPONENT_TYPE_LABELS[item.componentType] ?? item.componentType

  return (
    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70 transition-colors">
      {/* Product Image & Info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {item.productImageUrl && !imgError ? (
            <img
              src={item.productImageUrl}
              alt={item.productName}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <ImageOff className="w-6 h-6 text-slate-400" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
              {typeLabel}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              SKU: {item.productSku}
            </span>
          </div>

          <Link
            to={`/products/${item.productSlug}`}
            className="text-xs sm:text-sm font-bold text-slate-900 hover:text-red-600 transition-colors line-clamp-2 block"
            title={item.productName}
          >
            {item.productName}
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Số lượng: <strong className="text-slate-900">{item.quantity}</strong>
            </span>
            <span>•</span>
            {item.canPurchase && item.isActive ? (
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Còn hàng ({item.stockQuantity})</span>
              </span>
            ) : (
              <span className="text-rose-700 font-semibold inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md">
                <PackageX className="w-3.5 h-3.5" />
                <span>{!item.isActive ? 'Ngừng kinh doanh' : 'Hết hàng'}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Columns */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex-shrink-0">
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-slate-400 block font-medium">Đơn giá đã lưu</span>
          <span className="text-xs sm:text-sm font-bold text-slate-900">
            {formatVnd(item.unitPrice)}
          </span>
          <span className="text-[11px] text-slate-500 block font-medium">
            Thành tiền: <strong className="text-slate-900">{formatVnd(item.lineTotal)}</strong>
          </span>
        </div>

        <div className="text-right sm:mt-1.5">
          <span className="text-[10px] text-slate-400 block font-medium">Giá hiện tại</span>
          <span className="text-xs sm:text-sm font-bold text-slate-900">
            {formatVnd(item.currentPrice)}
          </span>
          {isPriceChanged && (
            <span
              className={`text-[10px] font-bold block ${
                priceDiff > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {priceDiff > 0
                ? `(Tăng ${formatVnd(priceDiff)})`
                : `(Giảm ${formatVnd(Math.abs(priceDiff))})`}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const PCBuildDetailPage: React.FC = () => {
  const { buildId } = useParams<{ buildId: string }>()
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const { addFromPCBuild } = useCart()

  const isCustomer = user?.role === UserRole.Customer
  const isUuidValid = Boolean(buildId && UUID_REGEX.test(buildId))

  const [build, setBuild] = useState<MyPCBuild | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const currentQueryKey = `${buildId ?? ''}-${reloadTrigger}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<{
    key: string
    status?: number
    message: string
  } | null>(null)

  const currentError = loadError?.key === currentQueryKey ? loadError : null
  const isLoading =
    isCustomer &&
    isUuidValid &&
    loadedQueryKey !== currentQueryKey &&
    currentError === null

  // Actions states
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [addToCartSuccess, setAddToCartSuccess] = useState(false)
  const [addToCartError, setAddToCartError] = useState<string | null>(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Request sequencing guard
  const requestSeqRef = useRef(0)

  const handleRetryLoad = () => {
    setLoadError(null)
    setReloadTrigger((prev) => prev + 1)
  }

  // Load build details
  useEffect(() => {
    if (!isCustomer || !isUuidValid || !buildId) {
      return
    }

    let cancelled = false
    const currentSeq = ++requestSeqRef.current
    const abortController = new AbortController()

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyPCBuildById(buildId, token, abortController.signal)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          return getAccessToken(true).then((newToken) => {
            if (!newToken) throw err
            return getMyPCBuildById(buildId, newToken, abortController.signal)
          })
        }
        throw err
      })
      .then((res) => {
        if (!cancelled && requestSeqRef.current === currentSeq && res) {
          setBuild(res)
          setLoadError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (cancelled || requestSeqRef.current !== currentSeq) return
        if (err instanceof Error && err.name === 'AbortError') return

        if (err instanceof ApiError) {
          if (err.status === 404) {
            setLoadError({
              key: currentQueryKey,
              status: 404,
              message: 'Không tìm thấy cấu hình này hoặc cấu hình đã bị xóa.',
            })
          } else if (err.status === 403) {
            setLoadError({
              key: currentQueryKey,
              status: 403,
              message: 'Bạn không có quyền truy cập cấu hình PC này.',
            })
          } else {
            setLoadError({
              key: currentQueryKey,
              status: err.status,
              message: err.description || 'Không thể tải chi tiết cấu hình. Vui lòng thử lại.',
            })
          }
        } else {
          setLoadError({
            key: currentQueryKey,
            message: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
          })
        }
        setLoadedQueryKey(currentQueryKey)
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [buildId, isUuidValid, reloadTrigger, currentQueryKey, isCustomer, getAccessToken])

  // Handle Add To Cart
  const handleAddToCart = async () => {
    if (!build || isAddingToCart || isDeleting || !build.canPurchaseAll) return

    setIsAddingToCart(true)
    setAddToCartError(null)
    setAddToCartSuccess(false)

    try {
      await addFromPCBuild(build.id)
      setAddToCartSuccess(true)
    } catch (err: unknown) {
      let msg = 'Không thể thêm cấu hình vào giỏ hàng. Vui lòng thử lại.'
      if (err instanceof ApiError && err.description) {
        msg = err.description
      } else if (err instanceof Error) {
        msg = err.message
      }
      setAddToCartError(msg)
    } finally {
      setIsAddingToCart(false)
    }
  }

  // Handle Delete PC Build
  const handleConfirmDelete = async () => {
    if (!build || isDeleting || isAddingToCart) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      const token = await getAccessToken(false)
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.')

      try {
        await deleteMyPCBuild(build.id, token)
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          const freshToken = await getAccessToken(true)
          if (!freshToken) throw err
          await deleteMyPCBuild(build.id, freshToken)
        } else {
          throw err
        }
      }

      // 204 Thành công: Đóng modal và chuyển hướng về danh sách cấu hình
      setShowDeleteModal(false)
      navigate('/pc-builds', { replace: true })
    } catch (err: unknown) {
      let msg = 'Không thể xóa cấu hình này. Vui lòng thử lại.'
      if (err instanceof ApiError) {
        if (err.status === 409) {
          msg = 'Cấu hình này đã được đặt hàng hoặc liên kết với đơn hàng nên không thể xóa.'
        } else if (err.description) {
          msg = err.description
        }
      } else if (err instanceof Error) {
        msg = err.message
      }
      setDeleteError(msg)
    } finally {
      setIsDeleting(false)
    }
  }

  // Phân quyền: Staff / Admin
  if (!isCustomer) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Chức năng dành riêng cho Khách hàng
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Chức năng quản lý cấu hình PC cá nhân chỉ áp dụng cho tài khoản Khách hàng (Customer).
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              to="/pc-builder"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <span>Về trang Xây dựng PC</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Invalid UUID guard (Không gọi API)
  if (!isUuidValid) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Mã cấu hình không hợp lệ
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Đường dẫn không đúng định dạng mã định danh cấu hình (UUID). Vui lòng kiểm tra lại đường dẫn.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              to="/pc-builds"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại danh sách cấu hình</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Loading State
  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center"
      >
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Đang tải chi tiết cấu hình...
        </p>
      </div>
    )
  }

  // Load Error State
  if (currentError) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              {currentError.status === 404
                ? 'Không tìm thấy cấu hình'
                : currentError.status === 403
                ? 'Không có quyền truy cập'
                : 'Lỗi tải dữ liệu'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              {currentError.message}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {currentError.status !== 404 && currentError.status !== 403 && (
              <button
                type="button"
                onClick={handleRetryLoad}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            )}
            <Link
              to="/pc-builds"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại danh sách</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!build) return null

  const isOrdered = isOrderedBuild(build.status)
  const isSaved = build.status === PCBuildStatus.Saved || (build.status as unknown) === 'Saved' || (build.status as unknown) === 2

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/pc-builds"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-red-600 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Danh sách cấu hình của tôi</span>
        </Link>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
            isOrdered
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : isSaved
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {getPCBuildStatusLabel(build.status)}
        </span>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Bookmark className="w-6 h-6 text-red-600 flex-shrink-0" />
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight truncate">
                {build.name}
              </h1>
            </div>
            {build.description && (
              <p className="text-xs sm:text-sm text-slate-600">
                {build.description}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              Ngày lưu: {formatDate(build.createdAt)}
              {build.updatedAt && ` • Cập nhật: ${formatDate(build.updatedAt)}`}
            </p>
          </div>

          <div className="text-left sm:text-right flex-shrink-0">
            <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">
              Tổng giá snapshot đã lưu
            </span>
            <span className="text-2xl sm:text-3xl font-extrabold text-red-600">
              {formatVnd(build.totalPrice)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              (Giá thanh toán thực tế sẽ cập nhật theo giỏ hàng)
            </span>
          </div>
        </div>

        {/* Specifications & Compatibility badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Điện năng tiêu thụ
            </span>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-slate-900">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>{build.estimatedWattage} W (Nguồn khuyến nghị: {build.recommendedPsuWattage} W)</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Độ tương thích linh kiện
            </span>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold">
              {build.isCompatible ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tương thích hoàn toàn</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="text-rose-700">Có cảnh báo tương thích</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Trạng thái hệ thống
            </span>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold">
              {build.isCompleteSystem ? (
                <span className="text-emerald-700">Đầy đủ bộ phận chính</span>
              ) : (
                <span className="text-amber-700">Chưa đủ linh kiện bắt buộc</span>
              )}
            </div>
          </div>
        </div>

        {/* Missing Components Alert */}
        {build.missingComponents && build.missingComponents.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Chưa đủ linh kiện bắt buộc cho một dàn máy hoàn chỉnh:</span>
            </div>
            <p className="pl-6 text-amber-800">
              Thiếu: {build.missingComponents.join(', ')}
            </p>
          </div>
        )}

        {/* Compatibility Issues Alert */}
        {build.issues && build.issues.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>Cảnh báo xung đột tương thích do hệ thống phát hiện:</span>
            </div>
            <ul className="pl-6 space-y-1 list-disc text-rose-800">
              {build.issues.map((issue, idx) => (
                <li key={idx}>
                  <strong className="font-semibold">{issue.message}</strong>
                  {issue.ruleId && (
                    <span className="text-[10px] font-mono text-rose-500 ml-1.5">
                      ({issue.ruleId})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Bar: Thêm Giỏ & Xóa */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500 leading-relaxed max-w-xl">
              Thêm cấu hình sẽ cộng dồn các linh kiện này vào giỏ hàng hiện có của bạn (các sản phẩm đã có trong giỏ không bị thay thế). Giá và tồn kho thực tế sẽ được xác nhận khi thanh toán.
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Delete Button */}
              <button
                type="button"
                disabled={isOrdered || isDeleting || isAddingToCart}
                onClick={() => setShowDeleteModal(true)}
                title={isOrdered ? 'Cấu hình đã đặt hàng không thể xóa' : 'Xóa cấu hình này'}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-colors inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa cấu hình</span>
              </button>

              {/* Add to Cart Button */}
              <button
                type="button"
                disabled={isAddingToCart || isDeleting || !build.canPurchaseAll}
                onClick={handleAddToCart}
                title={
                  !build.canPurchaseAll
                    ? 'Một số linh kiện đã hết hàng hoặc ngừng kinh doanh'
                    : 'Thêm tất cả linh kiện vào giỏ hàng'
                }
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                {isAddingToCart ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang thêm vào giỏ...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Thêm cấu hình vào giỏ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback: Cannot purchase all notice */}
          {!build.canPurchaseAll && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                Một số linh kiện trong cấu hình hiện đã hết hàng hoặc ngừng kinh doanh nên chưa thể thêm toàn bộ vào giỏ hàng.
              </span>
            </div>
          )}

          {/* Feedback: Add to cart error */}
          {addToCartError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{addToCartError}</span>
            </div>
          )}

          {/* Feedback: Add to cart success */}
          {addToCartSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-semibold">
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Đã thêm toàn bộ linh kiện của cấu hình vào giỏ hàng thành công!</span>
              </div>
              <Link
                to="/cart"
                className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 underline text-xs flex-shrink-0"
              >
                <span>Xem giỏ hàng</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Components List Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900">
            Danh sách linh kiện ({build.items.length})
          </h2>
          <span className="text-[11px] text-slate-500 font-medium">
            Phân biệt đơn giá đã lưu và giá hiện tại
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {build.items.map((item) => (
            <ComponentRow key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Xác nhận xóa cấu hình
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Bạn có chắc chắn muốn xóa cấu hình <strong className="text-slate-900 font-bold">"{build.name}"</strong>? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setShowDeleteModal(false)
                    setDeleteError(null)
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <span>Xác nhận xóa</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
