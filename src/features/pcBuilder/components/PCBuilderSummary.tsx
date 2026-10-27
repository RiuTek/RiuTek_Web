import React, { useState } from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Zap,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Trash2,
  Bookmark,
  Layers,
  ShoppingBag,
} from 'lucide-react'
import { COMPONENT_TYPE_LABELS, formatVnd } from '../../products/productConstants'
import type { PCBuildPreviewResult } from '../pcBuilderTypes'

interface PCBuilderSummaryProps {
  previewResult: PCBuildPreviewResult | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  hasItems: boolean
  itemCount: number
  onClearAll: () => void
}

export const PCBuilderSummary: React.FC<PCBuilderSummaryProps> = ({
  previewResult,
  isLoading,
  error,
  onRetry,
  hasItems,
  itemCount,
  onClearAll,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Phân nhóm issues theo severity
  const issues = previewResult?.issues ?? []
  const errorIssues = issues.filter((i) => i.severity === 'Error')
  const warningIssues = issues.filter((i) => i.severity === 'Warning')
  const infoIssues = issues.filter(
    (i) => i.severity !== 'Error' && i.severity !== 'Warning'
  )

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6 sticky top-24">
      {/* Summary Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Tổng quan cấu hình
          </span>
          <h2 className="text-base sm:text-lg font-black text-slate-950">
            Kiểm Tra Tương Thích
          </h2>
        </div>
        {hasItems && (
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
            {itemCount} linh kiện
          </span>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-center gap-3 text-amber-900"
          aria-live="polite"
        >
          <Loader2 className="w-5 h-5 text-amber-600 animate-spin flex-shrink-0" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold">Đang kiểm tra tương thích...</p>
            <p className="text-amber-700 text-[11px]">
              Hệ thống đang tính toán công suất và kiểm tra các chuẩn kết nối.
            </p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && !isLoading && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử kiểm tra lại</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!hasItems && (
        <div className="py-8 text-center space-y-2 text-slate-500">
          <Layers className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700">
            Chưa có linh kiện nào trong cấu hình
          </p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Hãy chọn các linh kiện từ danh sách bên trái để bắt đầu kiểm tra tính tương thích và ước tính công suất.
          </p>
        </div>
      )}

      {/* Preview Details when Available */}
      {previewResult && hasItems && (
        <div className="space-y-5" aria-live="polite">
          {/* Main Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Compatibility Status */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                previewResult.isCompatible
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {previewResult.isCompatible ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                  Tương thích
                </span>
                <span className="text-xs font-bold truncate block">
                  {previewResult.isCompatible
                    ? 'Linh kiện tương thích'
                    : 'Có lỗi tương thích'}
                </span>
              </div>
            </div>

            {/* Complete System Status */}
            <div
              className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                previewResult.isCompleteSystem
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              {previewResult.isCompleteSystem ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider block opacity-75">
                  Độ hoàn chỉnh
                </span>
                <span className="text-xs font-bold truncate block">
                  {previewResult.isCompleteSystem
                    ? 'Đủ linh kiện cơ bản'
                    : 'Chưa đủ linh kiện'}
                </span>
              </div>
            </div>
          </div>

          {/* Missing Components Alert */}
          {!previewResult.isCompleteSystem &&
            previewResult.missingComponents.length > 0 && (
              <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-1.5 text-amber-900 text-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Còn thiếu các linh kiện cơ bản:</span>
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {previewResult.missingComponents.map((comp) => (
                    <span
                      key={comp}
                      className="px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold"
                    >
                      {COMPONENT_TYPE_LABELS[comp] || `Nhóm ${comp}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* Power Specifications */}
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Ước tính tiêu thụ:</span>
              </span>
              <span className="font-bold text-slate-900">
                {previewResult.estimatedWattage} W
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-blue-500" />
                <span>Khuyến nghị bộ nguồn (PSU):</span>
              </span>
              <span className="font-bold text-slate-900">
                ≥ {previewResult.recommendedPsuWattage} W
              </span>
            </div>
          </div>

          {/* Issues List (Errors, Warnings, Infos) */}
          {issues.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Chi tiết lưu ý ({issues.length})
              </h3>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {/* Error issues */}
                {errorIssues.map((issue, idx) => (
                  <div
                    key={`err-${idx}`}
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">
                        {issue.message}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Warning issues */}
                {warningIssues.map((issue, idx) => (
                  <div
                    key={`warn-${idx}`}
                    className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">
                        {issue.message}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Info issues */}
                {infoIssues.map((issue, idx) => (
                  <div
                    key={`info-${idx}`}
                    className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="font-semibold leading-relaxed">
                        {issue.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchase Capability Warning */}
          {!previewResult.canPurchaseAll && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs text-rose-800">
              <ShoppingBag className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>
                Một số linh kiện trong cấu hình hiện tạm hết hàng hoặc ngừng kinh doanh.
              </span>
            </div>
          )}

          {/* Total Price Section */}
          <div className="pt-4 border-t border-slate-100 flex items-baseline justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Tạm tính toàn bộ:</span>
              <span className="text-[10px] text-slate-400">
                Giá niêm yết từ hệ thống
              </span>
            </div>
            <span className="text-xl sm:text-2xl font-black text-red-600">
              {formatVnd(previewResult.totalPrice)}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons Section */}
      <div className="space-y-3 pt-3 border-t border-slate-100">
        {/* Save Build CTA (Informational for this phase) */}
        <div className="space-y-1 text-center">
          <button
            type="button"
            disabled
            className="w-full py-3 px-4 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xs sm:text-sm cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Bookmark className="w-4 h-4" />
            <span>Lưu Cấu Hình (Sắp ra mắt)</span>
          </button>
          <p className="text-[10px] text-slate-400">
            Chức năng lưu cấu hình sẽ yêu cầu đăng nhập và được cập nhật ở phase tiếp theo.
          </p>
        </div>

        {/* Clear All Button with Inline Confirmation */}
        {hasItems && (
          <div className="pt-2">
            {!showClearConfirm ? (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 px-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ lựa chọn</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-center">
                <p className="text-xs font-bold text-rose-900">
                  Xóa tất cả các linh kiện đã chọn?
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll()
                      setShowClearConfirm(false)
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
