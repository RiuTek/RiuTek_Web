import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  Zap,
  Loader2,
  Trash2,
  Save,
  ArrowLeft,
  Info,
  RefreshCw,
} from 'lucide-react'
import { formatVnd } from '../../products/productConstants'
import type { PCBuildPreviewResult, SelectedPCBuildItem } from '../pcBuilderTypes'

interface PCBuilderEditSummaryProps {
  buildId: string
  name: string
  onNameChange: (name: string) => void
  description: string
  onDescriptionChange: (desc: string) => void
  selectedItems: SelectedPCBuildItem[]
  previewResult: PCBuildPreviewResult | null
  isPreviewLoading: boolean
  previewError: string | null
  onRetryPreview: () => void
  isDirty: boolean
  isSubmitting: boolean
  submitError: string | null
  isConflict: boolean
  onReloadFromServer: () => void
  onSubmit: () => void
  onCancel: () => void
  onClearSelection: () => void
}

export const PCBuilderEditSummary: React.FC<PCBuilderEditSummaryProps> = ({
  buildId,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  selectedItems,
  previewResult,
  isPreviewLoading,
  previewError,
  onRetryPreview,
  isDirty,
  isSubmitting,
  submitError,
  isConflict,
  onReloadFromServer,
  onSubmit,
  onCancel,
  onClearSelection,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const hasItems = selectedItems.length > 0
  const isNameEmpty = !name.trim()

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-6 sticky top-24">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Chế độ chỉnh sửa
          </span>
          <h2 className="text-lg font-black text-slate-950">Cập Nhật Cấu Hình</h2>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
          {buildId.slice(0, 8)}
        </span>
      </div>

      {/* Unsaved changes notice banner */}
      <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl text-xs text-blue-900 flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          Thay đổi chỉ được lưu khi bạn chọn <strong>Cập nhật cấu hình</strong>. Đơn giá lưu sẽ được làm mới theo giá hiện hành.
        </p>
      </div>

      {/* Name and Description Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="edit-build-name" className="text-xs font-bold text-slate-700 block">
            Tên cấu hình <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-build-name"
            type="text"
            maxLength={200}
            disabled={isSubmitting}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="VD: Dàn máy Gaming RTX 4070..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 disabled:opacity-60"
          />
          {isNameEmpty && (
            <p className="text-[11px] text-rose-600 font-medium">
              Tên cấu hình không được để trống.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="edit-build-desc" className="text-xs font-bold text-slate-700 block">
            Mô tả cấu hình <span className="text-slate-400 font-normal">(tùy chọn)</span>
          </label>
          <textarea
            id="edit-build-desc"
            rows={2}
            maxLength={1000}
            disabled={isSubmitting}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Ghi chú mục đích sử dụng hoặc nâng cấp..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none disabled:opacity-60"
          />
        </div>
      </div>

      {/* Specifications & Price */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-bold text-slate-500">Ước tính giá linh kiện</span>
          <div className="text-right">
            <span className="text-xl font-extrabold text-red-600">
              {formatVnd(previewResult?.totalPrice ?? 0)}
            </span>
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Công suất ước tính:</span>
          </span>
          <span className="font-extrabold text-slate-900">
            {previewResult ? `${previewResult.estimatedWattage} W` : '--'}
            {previewResult?.recommendedPsuWattage
              ? ` (Nguồn: ${previewResult.recommendedPsuWattage} W)`
              : ''}
          </span>
        </div>

        {/* Compatibility Status */}
        {previewResult && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              {previewResult.isCompatible ? (
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

            {/* Issues list */}
            {previewResult.issues && previewResult.issues.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                <span className="font-bold block">Vấn đề tương thích:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
                  {previewResult.issues.map((issue, idx) => (
                    <li key={idx}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing components */}
            {previewResult.missingComponents && previewResult.missingComponents.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold block">Chưa đủ dàn máy hoàn chỉnh:</span>
                <p className="text-[11px] text-amber-800">
                  Thiếu: {previewResult.missingComponents.join(', ')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Preview Loading or Error */}
        {isPreviewLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
            <span>Đang kiểm tra tương thích và tính giá...</span>
          </div>
        )}

        {previewError && !isPreviewLoading && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
            <span>{previewError}</span>
            <button
              type="button"
              onClick={onRetryPreview}
              className="text-red-700 font-bold hover:underline ml-2"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>

      {/* Submit Error & Concurrency Conflict */}
      {submitError && (
        <div
          role="alert"
          className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs space-y-2"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span className="font-semibold">{submitError}</span>
          </div>
          {isConflict && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onReloadFromServer}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tải lại dữ liệu từ máy chủ</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          disabled={!isDirty || isSubmitting || isNameEmpty || !hasItems || isPreviewLoading}
          onClick={onSubmit}
          className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-2xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang cập nhật...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Cập Nhật Cấu Hình</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onCancel}
          className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Hủy chỉnh sửa</span>
        </button>

        {/* Clear Selection in form */}
        {hasItems && (
          <div className="pt-2">
            {!showClearConfirm ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowClearConfirm(true)}
                className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa lựa chọn trong form</span>
              </button>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl space-y-2 text-center">
                <p className="text-[11px] font-bold text-rose-900 leading-tight">
                  Xóa tất cả linh kiện trong form? Thao tác này chỉ xóa lựa chọn đang chỉnh sửa, cấu hình trên máy chủ chưa bị thay đổi.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (!isSubmitting) {
                        onClearSelection()
                        setShowClearConfirm(false)
                      }
                    }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link to Detail */}
      <div className="text-center pt-2 border-t border-slate-100">
        <Link
          to={`/pc-builds/${buildId}`}
          className="text-xs text-slate-500 hover:text-red-600 font-medium transition-colors"
        >
          &larr; Xem lại cấu hình gốc
        </Link>
      </div>
    </div>
  )
}
