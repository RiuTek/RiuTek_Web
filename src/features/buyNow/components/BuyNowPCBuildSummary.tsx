import React from 'react'
import { Link } from 'react-router-dom'
import {
  Package,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Cpu,
  Layers,
  Tv,
  HardDrive,
  Database,
  Zap,
  Box,
  Fan,
  Sparkles,
  PackageCheck,
  PackageX,
  CreditCard,
  Banknote,
  ShieldCheck,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import type { MyPCBuild, MyPCBuildItem } from '../../pcBuilder/pcBuilderTypes'
import { ComponentType } from '../../products/productTypes'
import { COMPONENT_TYPE_LABELS, formatVnd } from '../../products/productConstants'
import { getComponentStockDisplay } from '../../pcBuilder/pcBuilderStockHelper'
import type {
  AttemptStatus,
  KnownOrderState,
} from '../pcBuildBuyNowHelper'
import type { PaymentMethod } from '../../orders/orderTypes'

const SLOT_ICONS: Record<ComponentType, React.ElementType> = {
  [ComponentType.CPU]: Cpu,
  [ComponentType.Motherboard]: Layers,
  [ComponentType.GPU]: Tv,
  [ComponentType.RAM]: HardDrive,
  [ComponentType.Storage]: Database,
  [ComponentType.PSU]: Zap,
  [ComponentType.Case]: Box,
  [ComponentType.Cooler]: Fan,
  [ComponentType.Accessory]: Sparkles,
}

interface ItemThumbnailProps {
  url: string | null
  alt: string
}

const ItemThumbnail: React.FC<ItemThumbnailProps> = ({ url, alt }) => {
  const [hasError, setHasError] = React.useState(false)

  if (!url || hasError) {
    return <Package className="w-6 h-6 text-slate-300" aria-hidden="true" />
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-contain p-0.5"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export type { AttemptStatus, KnownOrderState }

interface BuyNowPCBuildSummaryProps {
  build?: MyPCBuild | null
  buildId: string
  currentTotal: number
  paymentMethod: PaymentMethod
  isSubmitting?: boolean
  submitError?: string | null
  attemptStatus?: AttemptStatus
  unresolvedMessage?: string | null
  knownOrder?: KnownOrderState | null
  canCreateNew?: boolean
  canReplay?: boolean
  onSubmit: () => void
  onRetryStorageAndRedirect?: () => void
}

export const BuyNowPCBuildSummary: React.FC<BuyNowPCBuildSummaryProps> = ({
  build = null,
  buildId,
  currentTotal,
  paymentMethod,
  isSubmitting = false,
  submitError = null,
  attemptStatus = 'idle',
  unresolvedMessage = null,
  knownOrder = null,
  canCreateNew = false,
  canReplay = false,
  onSubmit,
  onRetryStorageAndRedirect,
}) => {
  const isUnresolved = attemptStatus === 'unresolved'
  const isStripeStorageFailed = attemptStatus === 'stripe_storage_failed'
  const isStripeRedirectFailed = attemptStatus === 'stripe_redirect_failed'
  const hasActiveAttempt =
    isUnresolved || isStripeStorageFailed || isStripeRedirectFailed

  // Quyết định nút submit có được bật hay không
  const isButtonEnabled = isUnresolved || isStripeRedirectFailed
    ? canReplay && !isSubmitting
    : hasActiveAttempt
    ? !isSubmitting
    : canCreateNew && !isSubmitting

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6 sticky top-24">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
            <Package className="w-5 h-5 text-red-600" />
            <span>Cấu Hình Đặt Mua</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {build ? `${build.items.length} linh kiện trong cấu hình` : 'Thông tin cấu hình PC'}
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
          Mua ngay trực tiếp
        </span>
      </div>

      {/* Build Info Card (nếu có dữ liệu build) */}
      {build ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tên cấu hình
              </span>
              <h4 className="text-sm font-bold text-slate-900 truncate" title={build.name}>
                {build.name}
              </h4>
              {build.description && (
                <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                  {build.description}
                </p>
              )}
            </div>
            <Link
              to={`/pc-builds/${build.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-red-600 transition-colors p-1"
              title="Xem chi tiết cấu hình gốc (mở tab mới)"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          {/* Compatibility / System Status from BE */}
          <div className="space-y-1.5 pt-1 text-xs">
            {!build.isCompatible && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold text-[11px]">Lưu ý tương thích:</span>
                  <p className="text-[11px] text-amber-800">
                    {build.issues.length > 0
                      ? build.issues.join('; ')
                      : 'Hệ thống ghi nhận cấu hình có thể chưa tương thích hoàn toàn.'}
                  </p>
                </div>
              </div>
            )}

            {!build.isCompleteSystem && build.missingComponents.length > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-100/90 text-slate-700 text-[11px] leading-relaxed">
                <span className="font-semibold text-slate-900">Thiếu linh kiện thiết yếu: </span>
                {build.missingComponents
                  .map((c) => COMPONENT_TYPE_LABELS[c as unknown as ComponentType] || c)
                  .join(', ')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Mã cấu hình
          </span>
          <p className="text-xs font-mono font-bold text-slate-800 break-all">{buildId}</p>
        </div>
      )}

      {/* Unavailable Items Warning (chỉ hiện khi tạo đơn mới và build có item thiếu stock) */}
      {build && !build.canPurchaseAll && !hasActiveAttempt && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs space-y-1"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Không thể hoàn tất đặt mua mới</span>
          </div>
          <p className="text-rose-700 leading-relaxed">
            Một số linh kiện trong cấu hình hiện đã hết hàng hoặc ngừng kinh doanh. Vui lòng quay lại chỉnh sửa hoặc thay thế linh kiện trước khi đặt mua mới.
          </p>
          <div className="pt-1">
            <Link
              to={`/pc-builds/${build.id}/edit`}
              className="text-xs font-bold text-rose-900 underline hover:text-rose-950"
            >
              Chỉnh sửa cấu hình ngay &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Component Items List (nếu có build) */}
      {build && build.items.length > 0 && (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Chi tiết linh kiện ({build.items.length})
          </span>
          {build.items.map((item: MyPCBuildItem) => {
            const SlotIcon = SLOT_ICONS[item.componentType] || Package
            const stock = getComponentStockDisplay({
              isActive: item.isActive,
              stockQuantity: item.stockQuantity,
              quantity: item.quantity,
              canPurchase: item.canPurchase,
            })
            const lineTotal = item.currentPrice * item.quantity

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <ItemThumbnail url={item.productImageUrl} alt={item.productName} />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <SlotIcon className="w-3 h-3 text-slate-500" />
                    <span>{COMPONENT_TYPE_LABELS[item.componentType]}</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900 truncate" title={item.productName}>
                    {item.productName}
                  </h5>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-slate-500 text-[11px]">
                      {formatVnd(item.currentPrice)} × {item.quantity}
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {formatVnd(lineTotal)}
                    </span>
                  </div>
                  <div className="pt-0.5">
                    <span className={`text-[10px] ${stock.badgeClass}`}>
                      {stock.iconType === 'check' && <PackageCheck className="w-3 h-3" />}
                      {stock.iconType === 'cross' && <PackageX className="w-3 h-3" />}
                      {stock.iconType === 'alert' && <AlertTriangle className="w-3 h-3" />}
                      <span>{stock.label}</span>
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pricing Breakdown */}
      <div className="pt-4 border-t border-slate-100 space-y-2.5">
        {build && (
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Tổng số lượng linh kiện:</span>
            <span className="font-bold text-slate-900">
              {build.items.reduce((sum, i) => sum + i.quantity, 0)} món
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Phương thức thanh toán:</span>
          <span className="font-bold text-slate-900 flex items-center gap-1">
            {paymentMethod === 'COD' ? (
              <>
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <span>Khi nhận hàng (COD)</span>
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5 text-red-600" />
                <span>Thẻ / QR qua Stripe</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Phí vận chuyển:</span>
          <span className="text-emerald-700 font-bold">Miễn phí giao hàng</span>
        </div>

        {currentTotal > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-950 block">Tổng tiền ước tính</span>
              <span className="text-[10px] text-slate-400 block font-normal">
                Tính theo giá hiện tại
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black text-red-600">
              {formatVnd(currentTotal)}
            </span>
          </div>
        )}

        <p className="text-[11px] text-slate-500 italic leading-relaxed pt-1">
          * Đơn giá và tình trạng kho thực tế được hệ thống xác nhận chính thức khi gửi yêu cầu đặt mua.
        </p>
      </div>

      {/* Notice about cart isolation */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Đơn hàng mua ngay này được xử lý độc lập. Toàn bộ sản phẩm trong giỏ hàng hiện tại của bạn sẽ được giữ nguyên vẹn.
        </p>
      </div>

      {/* Unresolved Attempt Warning Card */}
      {isUnresolved && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                Chưa thể xác nhận kết quả từ máy chủ
              </span>
              <p className="text-amber-800 leading-relaxed">
                {unresolvedMessage ||
                  'Yêu cầu trước đó bị gián đoạn hoặc phản hồi chậm. Đơn hàng của bạn có thể đã được khởi tạo thành công trên hệ thống.'}
              </p>
              <p className="text-amber-900 font-medium pt-0.5">
                Bạn có thể bấm <strong>"Thử lại an toàn"</strong> để kiểm tra lại với cùng mã giao dịch này (máy chủ sẽ tự nhận diện và không tạo đơn trùng lặp), hoặc kiểm tra mục Đơn hàng của tôi.
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <Link
              to="/orders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-amber-900 hover:text-amber-950 underline text-xs"
            >
              <span>Kiểm tra danh sách Đơn hàng của tôi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Known Order with Storage / Redirect Recovery */}
      {knownOrder && (isStripeStorageFailed || isStripeRedirectFailed) && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">
                Đơn hàng #{knownOrder.orderNumber} đã được tạo thành công!
              </span>
              <p className="text-emerald-800 leading-relaxed">
                {isStripeStorageFailed
                  ? 'Tuy nhiên trình duyệt đang chặn lưu trữ phiên thanh toán (sessionStorage). Để tiếp tục thanh toán, bạn có thể xem chi tiết đơn hàng hoặc thử lưu lại.'
                  : 'Tuy nhiên kết nối chuyển hướng sang Stripe gặp sự cố hoặc phiên thanh toán đã hết hạn. Bạn có thể mở chi tiết đơn hàng để tiếp tục thanh toán.'}
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Link
              to={`/orders/${encodeURIComponent(knownOrder.id)}`}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center justify-center gap-1.5 shadow-xs"
            >
              <span>Xem chi tiết đơn #{knownOrder.orderNumber}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {isStripeStorageFailed && onRetryStorageAndRedirect && (
              <button
                type="button"
                onClick={onRetryStorageAndRedirect}
                disabled={isSubmitting}
                className="px-4 py-2 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 text-center"
              >
                Thử lưu lại và tiếp tục
              </button>
            )}
          </div>
        </div>
      )}

      {/* Standard Submit Error Alert (for definitive errors) */}
      {submitError && !isUnresolved && !knownOrder && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold">Không thể đặt hàng:</span>
            <p>{submitError}</p>
          </div>
        </div>
      )}

      {/* Submit / Replay Button */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          disabled={!isButtonEnabled}
          onClick={onSubmit}
          className={`w-full py-4 px-6 rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isUnresolved
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang xử lý đơn hàng...</span>
            </>
          ) : isUnresolved ? (
            <>
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại an toàn với mã giao dịch này</span>
            </>
          ) : isStripeRedirectFailed ? (
            <>
              <RotateCcw className="w-4 h-4" />
              <span>Thử kết nối lại cổng Stripe</span>
            </>
          ) : (
            <span>
              {paymentMethod === 'Stripe'
                ? 'Tiếp tục thanh toán với Stripe'
                : 'Xác nhận đặt mua cấu hình'}
            </span>
          )}
        </button>

        <Link
          to={`/pc-builds/${buildId}`}
          className="w-full py-2.5 text-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors block"
        >
          Quay lại chi tiết cấu hình
        </Link>
      </div>
    </div>
  )
}
