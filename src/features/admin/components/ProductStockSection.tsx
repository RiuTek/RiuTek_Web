import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  PackagePlus,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import {
  adjustProductStock,
  getAdminProductById,
  getProductStockMovements,
} from '../adminApi'
import {
  STOCK_MOVEMENT_REASON_LABELS,
  STOCK_MOVEMENT_REASON_OPTIONS,
  mapAdminApiError,
} from '../adminConstants'
import { executeWithAdminAuth } from '../adminGuardHelper'
import {
  executeStockAdjustmentMutation,
  validateStockAdjustmentDraft,
} from '../adminProductHelper'
import type { StockMovementDto, StockMovementReason } from '../adminTypes'

interface ProductStockSectionProps {
  productId: string
  sku: string
  expectedStockQuantity: number
  isSavingProduct: boolean
  isAdjustingStock: boolean
  onAdjustingStockChange: (adjusting: boolean) => void
  onExpectedStockQuantityChange: (newStock: number) => void
}

const MOVEMENTS_PAGE_SIZE = 10

function formatDateTimeVi(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

export const ProductStockSection: React.FC<ProductStockSectionProps> = ({
  productId,
  sku,
  expectedStockQuantity,
  isSavingProduct,
  isAdjustingStock,
  onAdjustingStockChange,
  onExpectedStockQuantityChange,
}) => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? null

  const [quantityDeltaRaw, setQuantityDeltaRaw] = useState('')
  const [noteRaw, setNoteRaw] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>(
    {}
  )
  const [adjustmentApiError, setAdjustmentApiError] = useState<string | null>(
    null
  )
  const [adjustmentSuccess, setAdjustmentSuccess] = useState<string | null>(
    null
  )

  const [movements, setMovements] = useState<StockMovementDto[]>([])
  const [pageIndex, setPageIndex] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [reasonFilter, setReasonFilter] = useState<StockMovementReason | ''>('')
  const [isLoadingMovements, setIsLoadingMovements] = useState(true)
  const [movementsError, setMovementsError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  const ownerIdRef = useRef<string | null>(ownerId)
  const productIdRef = useRef<string>(productId)
  const isAdjustingRef = useRef(false)
  const movementsSeqRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    ownerIdRef.current = ownerId
    productIdRef.current = productId
    return () => {
      mountedRef.current = false
      movementsSeqRef.current += 1
    }
  }, [ownerId, productId])

  const fetchMovements = useCallback(
    async (
      targetPage: number,
      targetReason: StockMovementReason | '',
      signal?: AbortSignal
    ) => {
      const seq = ++movementsSeqRef.current
      const activeOwner = ownerIdRef.current
      const activeProduct = productIdRef.current
      const isTicketCurrent = () =>
        mountedRef.current &&
        movementsSeqRef.current === seq &&
        ownerIdRef.current === activeOwner &&
        productIdRef.current === activeProduct

      await Promise.resolve()
      if (!isTicketCurrent()) return
      setIsLoadingMovements(true)
      setMovementsError(null)

      try {
        const result = await executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: isTicketCurrent,
          operation: (token) =>
            getProductStockMovements(
              productId,
              {
                pageIndex: targetPage,
                pageSize: MOVEMENTS_PAGE_SIZE,
                reason: targetReason || undefined,
              },
              token,
              signal
            ),
        })

        if (!isTicketCurrent()) return
        setMovements(result.items ?? [])
        setTotalPages(Math.max(1, result.totalPages ?? 1))
        setTotalCount(result.totalCount ?? 0)
      } catch (err: unknown) {
        if (!isTicketCurrent()) return
        if (err instanceof Error && err.name === 'AbortError') return
        setMovementsError(
          mapAdminApiError(
            err,
            'Không thể tải lịch sử biến động tồn kho. Vui lòng thử lại.'
          )
        )
      } finally {
        if (isTicketCurrent()) {
          setIsLoadingMovements(false)
        }
      }
    },
    [authStatus, user, getAccessToken, productId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchMovements(pageIndex, reasonFilter, controller.signal)
    return () => {
      controller.abort()
    }
  }, [fetchMovements, pageIndex, reasonFilter])

  const liveDraftPreview = validateStockAdjustmentDraft({
    expectedStockQuantity,
    quantityDeltaRaw,
    noteRaw: noteRaw || 'preview',
  })

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isAdjustingRef.current || isAdjustingStock || isSavingProduct) return

    const activeOwner = ownerIdRef.current
    const activeProduct = productIdRef.current
    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      productIdRef.current === activeProduct

    isAdjustingRef.current = true
    try {
      await executeStockAdjustmentMutation({
        productId,
        expectedStockQuantity,
        quantityDeltaRaw,
        noteRaw,
        isAdjustingStock,
        isSavingProduct,
        isContextCurrent: checkCurrent,
        adjustStock: (id, payload) =>
          executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) => adjustProductStock(id, payload, token),
          }),
        reloadLatestProductStock: async (id) => {
          const detail = await executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) => getAdminProductById(id, token),
          })
          return detail.stockQuantity
        },
        reloadStockMovements: async () => {
          setPageIndex(1)
          await fetchMovements(1, reasonFilter)
        },
        onValidationError: setValidationErrors,
        onAdjustingChange: onAdjustingStockChange,
        onApiError: setAdjustmentApiError,
        onSuccessMessage: setAdjustmentSuccess,
        onExpectedStockUpdated: onExpectedStockQuantityChange,
        onResetAdjustmentInputs: () => {
          setQuantityDeltaRaw('')
          setNoteRaw('')
        },
      })
    } finally {
      isAdjustingRef.current = false
    }
  }

  return (
    <div className="space-y-6">
      {/* Khu vực 1: Điều chỉnh tồn kho thủ công */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Điều Chỉnh Tồn Kho (Kiểm Kê / Nhập Xuất Lẻ)
              </h3>
              <p className="text-xs text-slate-500">
                Thao tác tồn kho tách biệt với biểu mẫu thông tin sản phẩm để đảm bảo lưu vết
                kiểm toán chính xác cho SKU <span className="font-mono font-bold">{sku}</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2">
            <span className="text-xs font-medium text-blue-800">
              Tồn kho hiện tại:
            </span>
            <span className="font-mono text-base font-black text-blue-700">
              {expectedStockQuantity}
            </span>
          </div>
        </div>

        <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-4">
          {adjustmentApiError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div className="font-medium">{adjustmentApiError}</div>
            </div>
          )}

          {adjustmentSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="font-medium">{adjustmentSuccess}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="stock-delta-input"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Số lượng biến động (+/-) <span className="text-rose-600">*</span>
              </label>
              <input
                id="stock-delta-input"
                type="number"
                step={1}
                value={quantityDeltaRaw}
                disabled={isAdjustingStock || isSavingProduct}
                onChange={(e) => {
                  setQuantityDeltaRaw(e.target.value)
                  setAdjustmentSuccess(null)
                }}
                placeholder="VD: 10 (nhập thêm) hoặc -2 (xuất/hỏng)"
                className={`w-full rounded-lg border px-3 py-2 font-mono text-xs text-slate-900 transition outline-none ${
                  validationErrors.quantityDelta
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                    : 'border-slate-300 bg-white focus:border-blue-600'
                } disabled:bg-slate-100`}
              />
              {validationErrors.quantityDelta && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {validationErrors.quantityDelta}
                </p>
              )}

              {liveDraftPreview.previewStockAfter !== null && (
                <p className="mt-1.5 text-xs text-slate-600">
                  Tồn kho dự kiến sau điều chỉnh:{' '}
                  <strong
                    className={`font-mono ${
                      liveDraftPreview.previewStockAfter < 0
                        ? 'text-rose-600'
                        : 'text-slate-900'
                    }`}
                  >
                    {liveDraftPreview.previewStockAfter}
                  </strong>
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor="stock-note-input"
                  className="text-xs font-bold text-slate-700"
                >
                  Ghi chú lý do điều chỉnh (3 - 500 ký tự){' '}
                  <span className="text-rose-600">*</span>
                </label>
                <span className="font-mono text-[11px] text-slate-400">
                  {noteRaw.trim().length}/500
                </span>
              </div>
              <input
                id="stock-note-input"
                type="text"
                maxLength={500}
                value={noteRaw}
                disabled={isAdjustingStock || isSavingProduct}
                onChange={(e) => {
                  setNoteRaw(e.target.value)
                  setAdjustmentSuccess(null)
                }}
                placeholder="Nhập lý do kiểm kê, nhập bổ sung lô hàng, hoặc xuất bảo hành..."
                className={`w-full rounded-lg border px-3 py-2 text-xs text-slate-900 transition outline-none ${
                  validationErrors.note
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                    : 'border-slate-300 bg-white focus:border-blue-600'
                } disabled:bg-slate-100`}
              />
              {validationErrors.note && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {validationErrors.note}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isAdjustingStock || isSavingProduct}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdjustingStock && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Xác nhận điều chỉnh tồn kho
            </button>
          </div>
        </form>
      </section>

      {/* Khu vực 2: Lịch sử biến động tồn kho (Audit Log) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-700" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Lịch Sử Biến Động Tồn Kho ({totalCount})
              </h3>
              <p className="text-xs text-slate-500">
                 Nhật ký kiểm toán mọi thay đổi tồn kho (tạo mới, điều chỉnh thủ công, đặt hàng,
                hủy đơn).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Lọc theo nguyên nhân biến động"
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value as StockMovementReason | '')
                setPageIndex(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-600"
            >
              <option value="">Tất cả nguyên nhân</option>
              {STOCK_MOVEMENT_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void fetchMovements(pageIndex, reasonFilter)}
              disabled={isLoadingMovements}
              title="Làm mới lịch sử"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isLoadingMovements ? 'animate-spin' : ''}`}
              />
              Làm mới
            </button>
          </div>
        </div>

        {movementsError ? (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700">
            <span>{movementsError}</span>
            <button
              type="button"
              onClick={() => void fetchMovements(pageIndex, reasonFilter)}
              className="rounded bg-rose-600 px-2.5 py-1 font-semibold text-white hover:bg-rose-700"
            >
              Thử lại
            </button>
          </div>
        ) : isLoadingMovements ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
            Đang tải lịch sử biến động kho...
          </div>
        ) : movements.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Chưa có bản ghi biến động tồn kho nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-600 uppercase">
                  <th className="px-3 py-2.5">Thời gian</th>
                  <th className="px-3 py-2.5">Nguyên nhân</th>
                  <th className="px-3 py-2.5 text-right">Trước</th>
                  <th className="px-3 py-2.5 text-right">Biến động</th>
                  <th className="px-3 py-2.5 text-right">Sau</th>
                  <th className="px-3 py-2.5">Người thực hiện</th>
                  <th className="px-3 py-2.5">Ghi chú / Đơn hàng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((mv) => {
                  const isPositive = mv.quantityDelta > 0
                  const reasonLabel =
                    STOCK_MOVEMENT_REASON_LABELS[mv.reason] ?? mv.reason

                  return (
                    <tr key={mv.id} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-slate-600">
                        {formatDateTimeVi(mv.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                          {reasonLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                        {mv.stockBefore}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono font-bold ${
                          isPositive ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isPositive ? `+${mv.quantityDelta}` : mv.quantityDelta}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        {mv.stockAfter}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {mv.actorUserName || 'Hệ thống'}
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-slate-600">
                        {mv.note && <p className="break-words">{mv.note}</p>}
                        {mv.orderId && (
                          <span className="mt-0.5 inline-block font-mono text-[11px] text-blue-600">
                            Đơn hàng: #{mv.orderId.slice(0, 8).toUpperCase()}
                          </span>
                        )}
                        {!mv.note && !mv.orderId && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
            <span>
              Trang <strong>{pageIndex}</strong> / <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={pageIndex <= 1 || isLoadingMovements}
                onClick={() => setPageIndex((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Trước
              </button>
              <button
                type="button"
                disabled={pageIndex >= totalPages || isLoadingMovements}
                onClick={() => setPageIndex((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
