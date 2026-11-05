import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Download, Loader2, AlertCircle, RefreshCw, X } from 'lucide-react'
import type { PCBuildExportSnapshot } from '../pcBuildExportTypes'
import {
  exportPCBuildToPngBlob,
  downloadBlob,
  generateExportFilename,
} from '../pcBuildCanvasRenderer'

export interface PCBuildExportImageButtonProps {
  /**
   * Hàm callback đồng bộ trả về snapshot tại thời điểm nhấn nút.
   * Nếu trả về null hoặc điều kiện không thỏa mãn, quá trình xuất ảnh sẽ dừng lại.
   */
  onGetSnapshot: () => PCBuildExportSnapshot | null
  disabled?: boolean
  disabledTooltip?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'outline'
  buttonText?: string
  /**
   * Khóa định danh ngữ cảnh (vd: buildId hoặc currentConfigKey).
   * Khi khóa này thay đổi, mọi thao tác render ảnh đang chạy dở sẽ bị hủy tự động.
   */
  contextKey?: string
}

interface ActiveExportOperation {
  id: number
  controller: AbortController
  contextKey?: string
}

export const PCBuildExportImageButton: React.FC<PCBuildExportImageButtonProps> = ({
  onGetSnapshot,
  disabled = false,
  disabledTooltip,
  className = '',
  variant = 'outline',
  buttonText = 'Tải ảnh cấu hình',
  contextKey,
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [activeContextKey, setActiveContextKey] = useState(contextKey)

  // Điều chỉnh state khi contextKey thay đổi mà không gây cascading render trong effect
  if (contextKey !== activeContextKey) {
    setActiveContextKey(contextKey)
    setIsExporting(false)
    setExportError(null)
  }

  // Ref quản lý operation đang chạy độc quyền
  const activeOperationRef = useRef<ActiveExportOperation | null>(null)
  const operationSeqRef = useRef(0)
  const isMountedRef = useRef(true)

  // Quản lý lifecycle unmount và hủy operation cũ
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (activeOperationRef.current) {
        activeOperationRef.current.controller.abort()
        activeOperationRef.current = null
      }
    }
  }, [])

  // Khi contextKey thay đổi (người dùng đổi cấu hình hoặc chuyển trang), hủy bỏ tác vụ cũ
  useEffect(() => {
    if (activeOperationRef.current) {
      activeOperationRef.current.controller.abort()
      activeOperationRef.current = null
    }
  }, [contextKey])

  const handleExport = useCallback(async () => {
    // 1. Kiểm tra disabled
    if (disabled) {
      return
    }

    // 2. Double-click guard trong cùng context
    if (
      activeOperationRef.current &&
      activeOperationRef.current.contextKey === contextKey
    ) {
      return
    }

    // Nếu có operation cũ từ context trước còn sót lại, hủy ngay lập tức
    if (activeOperationRef.current) {
      activeOperationRef.current.controller.abort()
      activeOperationRef.current = null
    }

    setExportError(null)

    // 3. Chụp snapshot tại thời điểm nhấn nút
    const snapshot = onGetSnapshot()
    if (!snapshot) {
      return
    }

    // 4. Khởi tạo identity operation mới độc quyền
    const operationId = ++operationSeqRef.current
    const controller = new AbortController()
    const operation: ActiveExportOperation = {
      id: operationId,
      controller,
      contextKey,
    }

    activeOperationRef.current = operation
    setIsExporting(true)

    try {
      // 5. Render Canvas và chuyển thành Blob PNG
      const blob = await exportPCBuildToPngBlob(snapshot, controller.signal)

      // Kiểm tra tính sở hữu trước khi tải file:
      // Phải còn mounted, signal chưa bị abort, và operation này vẫn là active
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeOperationRef.current !== operation
      ) {
        return
      }

      // 6. Kích hoạt tải file
      const filename = generateExportFilename(snapshot.buildName, snapshot.exportedAt)
      downloadBlob(blob, filename)
    } catch (err: unknown) {
      // Catch: chỉ hiển thị lỗi nếu operation này vẫn là active và không bị abort
      if (
        !isMountedRef.current ||
        controller.signal.aborted ||
        activeOperationRef.current !== operation
      ) {
        return
      }

      const message =
        err instanceof Error ? err.message : 'Không thể xuất ảnh cấu hình lúc này.'
      setExportError(message)
    } finally {
      // Finally: chỉ giải phóng lock và reset isExporting nếu operation này vẫn sở hữu slot active
      if (activeOperationRef.current === operation) {
        activeOperationRef.current = null
        if (isMountedRef.current) {
          setIsExporting(false)
        }
      }
    }
  }, [contextKey, disabled, onGetSnapshot])

  // Style theo variant
  let variantClasses: string
  if (variant === 'primary') {
    variantClasses =
      'bg-red-600 hover:bg-red-700 text-white border-transparent disabled:bg-slate-100 disabled:text-slate-400'
  } else if (variant === 'secondary') {
    variantClasses =
      'bg-slate-900 hover:bg-slate-800 text-white border-transparent disabled:bg-slate-200 disabled:text-slate-400'
  } else {
    // Outline
    variantClasses =
      'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200'
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={disabled || isExporting}
        title={disabledTooltip}
        className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors inline-flex items-center justify-center gap-2 shadow-2xs disabled:cursor-not-allowed select-none ${variantClasses} ${className}`}
        aria-label={buttonText}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" />
            <span>Đang tạo ảnh...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4 text-current" />
            <span>{buttonText}</span>
          </>
        )}
      </button>

      {/* Thông báo lỗi khi xuất ảnh kèm nút Thử lại */}
      {exportError && (
        <div
          role="alert"
          className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 max-w-sm animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-medium leading-relaxed">{exportError}</p>
            <button
              type="button"
              onClick={handleExport}
              disabled={disabled || isExporting}
              className="mt-1.5 inline-flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900 underline text-[11px]"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Thử lại</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-rose-400 hover:text-rose-700 p-0.5"
            aria-label="Đóng thông báo lỗi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
