import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  Check,
  ArrowRight,
  X,
} from 'lucide-react'
import { ApiError } from '../../../lib/api'
import { useAuth } from '../../auth/AuthContext'
import { UserRole } from '../../auth/authTypes'
import { useCart } from '../../cart/CartContext'
import { formatVnd } from '../../products/productConstants'
import { createPCBuild } from '../pcBuilderApi'
import {
  PC_BUILDER_ERROR_MESSAGES,
  PC_BUILDER_GUEST_STORAGE_KEY,
} from '../pcBuilderConstants'
import type {
  MyPCBuild,
  PCBuildItemInput,
  PCBuildPreviewResult,
  SelectedPCBuildItem,
} from '../pcBuilderTypes'

interface PCBuilderSummaryProps {
  selectedItems: SelectedPCBuildItem[]
  previewResult: PCBuildPreviewResult | null
  isLoading: boolean
  error: string | null
  onRetry: () => void
  hasItems: boolean
  itemCount: number
  onClearAll: () => void
}

interface SavedBuildState {
  build: MyPCBuild
  configKeyAtSave: string
  ownerUserId: string
}

export const PCBuilderSummary: React.FC<PCBuilderSummaryProps> = ({
  selectedItems,
  previewResult,
  isLoading,
  error,
  onRetry,
  hasItems,
  itemCount,
  onClearAll,
}) => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const { addFromPCBuild } = useCart()
  const navigate = useNavigate()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [buildName, setBuildName] = useState('')
  const [buildDescription, setBuildDescription] = useState('')
  const [saveValidationErrors, setSaveValidationErrors] = useState<{
    name?: string
    description?: string
  }>({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // State lưu trữ bản build vừa tạo thành công
  const [savedBuildInfo, setSavedBuildInfo] = useState<SavedBuildState | null>(null)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [addToCartError, setAddToCartError] = useState<string | null>(null)
  const [addToCartSuccess, setAddToCartSuccess] = useState(false)
  const [guestSaveError, setGuestSaveError] = useState<string | null>(null)

  const userRef = useRef(user)
  const authStatusRef = useRef(authStatus)

  // Reset toàn bộ state saved build, form và thông báo khi đăng xuất hoặc đổi tài khoản
  const previousUserIdRef = useRef(user?.id)
  useEffect(() => {
    userRef.current = user
    authStatusRef.current = authStatus

    if (previousUserIdRef.current !== user?.id || authStatus !== 'authenticated') {
      previousUserIdRef.current = user?.id
      setSavedBuildInfo(null)
      setAddToCartSuccess(false)
      setAddToCartError(null)
      setShowSaveModal(false)
      setSaveError(null)
    }
  }, [user, user?.id, authStatus])

  // Config key hiện tại của selectedItems
  const currentConfigKey = useMemo(() => {
    if (selectedItems.length === 0) return ''
    return selectedItems
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(';')
  }, [selectedItems])

  // Kiểm tra quyền sở hữu và khớp snapshot cấu hình lúc save
  const isCurrentBuildSaved =
    savedBuildInfo !== null &&
    authStatus === 'authenticated' &&
    user?.role === UserRole.Customer &&
    user?.id === savedBuildInfo.ownerUserId &&
    savedBuildInfo.configKeyAtSave === currentConfigKey &&
    hasItems

  // Phân nhóm issues theo severity
  const issues = previewResult?.issues ?? []
  const errorIssues = issues.filter((i) => i.severity === 'Error')
  const warningIssues = issues.filter((i) => i.severity === 'Warning')
  const infoIssues = issues.filter(
    (i) => i.severity !== 'Error' && i.severity !== 'Warning'
  )

  // Mở form lưu cấu hình
  const handleOpenSaveModal = () => {
    if (!hasItems) return
    setGuestSaveError(null)

    // 1. Nếu là khách vãng lai (hoặc chưa đăng nhập): lưu tối thiểu { savedAt, items: [{ productId, quantity }] }
    if (authStatus === 'anonymous') {
      try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
          throw new Error('Trình duyệt không hỗ trợ sessionStorage.')
        }

        const guestData = {
          savedAt: Date.now(),
          items: selectedItems.slice(0, 30).map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }
        sessionStorage.setItem(
          PC_BUILDER_GUEST_STORAGE_KEY,
          JSON.stringify(guestData)
        )
        navigate('/login', { state: { from: '/pc-builder' } })
        return
      } catch {
        // Storage bị chặn: GIỮ NGUYÊN cấu hình, KHÔNG điều hướng làm mất lựa chọn
        setGuestSaveError(
          'Không thể lưu tạm cấu hình vào bộ nhớ trình duyệt (sessionStorage bị tắt hoặc đầy). Vui lòng đăng nhập trước khi xây dựng cấu hình để tránh mất dữ liệu.'
        )
        return
      }
    }

    // 2. Nếu auth đang checking hoặc unavailable
    if (authStatus === 'checking') {
      return
    }
    if (authStatus === 'unavailable') {
      setSaveError('Dịch vụ xác thực tạm thời không khả dụng. Vui lòng thử lại sau.')
      return
    }

    // 3. Nếu là Staff hoặc Admin: Backend không cho phép lưu
    if (user && user.role !== UserRole.Customer) {
      setSaveError('Chỉ tài khoản khách hàng (Customer) mới có thể lưu và quản lý cấu hình PC.')
      setShowSaveModal(true)
      return
    }

    // 4. Customer: Khởi tạo giá trị mặc định cho form
    const defaultName = `Cấu hình PC - ${new Date().toLocaleDateString('vi-VN')}`
    setBuildName(defaultName)
    setBuildDescription('')
    setSaveValidationErrors({})
    setSaveError(null)
    setAddToCartError(null)
    setAddToCartSuccess(false)
    setShowSaveModal(true)
  }

  // Submit lưu cấu hình
  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving || !hasItems || !user || user.role !== UserRole.Customer) {
      return
    }

    const trimmedName = buildName.trim()
    const trimmedDesc = buildDescription.trim()

    const errors: { name?: string; description?: string } = {}
    if (!trimmedName) {
      errors.name = 'Tên cấu hình PC không được để trống.'
    } else if (trimmedName.length > 200) {
      errors.name = 'Tên cấu hình PC không được vượt quá 200 ký tự.'
    }

    if (trimmedDesc.length > 1000) {
      errors.description = 'Mô tả không được vượt quá 1000 ký tự.'
    }

    if (Object.keys(errors).length > 0) {
      setSaveValidationErrors(errors)
      return
    }

    setSaveValidationErrors({})
    setIsSaving(true)
    setSaveError(null)

    const expectedOwnerId = user.id

    try {
      const token = await getAccessToken(false)
      if (!token) {
        throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      }

      const payloadItems: PCBuildItemInput[] = selectedItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      const result = await createPCBuild(
        {
          name: trimmedName,
          description: trimmedDesc || null,
          items: payloadItems,
        },
        token
      )

      // Guard: Chỉ cập nhật state nếu user vẫn đang là chủ sở hữu lúc request bắt đầu
      if (
        userRef.current?.id === expectedOwnerId &&
        authStatusRef.current === 'authenticated' &&
        userRef.current?.role === UserRole.Customer
      ) {
        setSavedBuildInfo({
          build: result,
          configKeyAtSave: currentConfigKey,
          ownerUserId: expectedOwnerId,
        })
        setShowSaveModal(false)
        setAddToCartSuccess(false)
        setAddToCartError(null)
      }
    } catch (err: unknown) {
      let msg = 'Không thể lưu cấu hình lúc này. Vui lòng thử lại.'
      if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
        msg = PC_BUILDER_ERROR_MESSAGES[err.code]
      } else if (err instanceof ApiError && err.description) {
        msg = err.description
      } else if (err instanceof Error) {
        msg = err.message
      }
      if (userRef.current?.id === expectedOwnerId && authStatusRef.current === 'authenticated') {
        setSaveError(msg)
      }
    } finally {
      if (userRef.current?.id === expectedOwnerId) {
        setIsSaving(false)
      }
    }
  }

  // Thêm cấu hình đã lưu vào giỏ hàng
  const handleAddToCart = async () => {
    // Kiểm tra tính hợp lệ và quyền sở hữu trước khi gọi API
    if (
      !savedBuildInfo ||
      isAddingToCart ||
      authStatus !== 'authenticated' ||
      user?.role !== UserRole.Customer ||
      user?.id !== savedBuildInfo.ownerUserId
    ) {
      return
    }

    const currentOwnerId = user.id
    const targetBuildId = savedBuildInfo.build.id
    setIsAddingToCart(true)
    setAddToCartError(null)
    setAddToCartSuccess(false)

    try {
      await addFromPCBuild(targetBuildId)
      // Guard: Chỉ hiển thị success nếu user vẫn là chủ sở hữu
      if (
        userRef.current?.id === currentOwnerId &&
        authStatusRef.current === 'authenticated' &&
        userRef.current?.role === UserRole.Customer
      ) {
        setAddToCartSuccess(true)
      }
    } catch (err: unknown) {
      let msg = 'Không thể thêm cấu hình vào giỏ hàng. Vui lòng thử lại.'
      if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
        msg = PC_BUILDER_ERROR_MESSAGES[err.code]
      } else if (err instanceof Error) {
        msg = err.message
      }
      if (userRef.current?.id === currentOwnerId && authStatusRef.current === 'authenticated') {
        setAddToCartError(msg)
      }
    } finally {
      if (userRef.current?.id === currentOwnerId) {
        setIsAddingToCart(false)
      }
    }
  }

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
                  {previewResult.missingComponents.map((comp, idx) => (
                    <span
                      key={`${comp}-${idx}`}
                      className="px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-lg text-[11px] font-semibold"
                    >
                      {comp}
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
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-relaxed">
                          {issue.message}
                        </p>
                        {(issue.componentA || issue.componentB) && (
                          <p className="text-[10px] text-rose-700 opacity-80">
                            {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
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
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-relaxed">
                          {issue.message}
                        </p>
                        {(issue.componentA || issue.componentB) && (
                          <p className="text-[10px] text-amber-700 opacity-80">
                            {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
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
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-relaxed">
                          {issue.message}
                        </p>
                        {(issue.componentA || issue.componentB) && (
                          <p className="text-[10px] text-blue-700 opacity-80">
                            {[issue.componentA, issue.componentB].filter(Boolean).join(' • ')}
                          </p>
                        )}
                      </div>
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
        {/* Saved Build Banner & Add to Cart Action */}
        {isCurrentBuildSaved && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-emerald-900 truncate">
                  Đã lưu: {savedBuildInfo.build.name}
                </p>
                <p className="text-[10px] text-emerald-700">
                  Mã cấu hình: <span className="font-mono">{savedBuildInfo.build.id}</span>
                </p>
              </div>
            </div>

            {addToCartSuccess ? (
              <div className="p-2.5 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-800 space-y-1 text-center">
                <p className="font-bold flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Đã thêm cấu hình vào giỏ hàng thành công!</span>
                </p>
                <Link
                  to="/cart"
                  className="inline-flex items-center gap-1 font-bold text-red-600 hover:text-red-700 underline text-xs"
                >
                  <span>Xem giỏ hàng</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <button
                type="button"
                disabled={isAddingToCart || !previewResult?.canPurchaseAll}
                onClick={handleAddToCart}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-2xs"
              >
                {isAddingToCart ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang thêm vào giỏ hàng...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Thêm cấu hình vào giỏ hàng</span>
                  </>
                )}
              </button>
            )}

            {addToCartError && (
              <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                {addToCartError}
              </p>
            )}
          </div>
        )}

        {/* Guest Storage Error Alert */}
        {guestSaveError && (
          <div
            role="alert"
            className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{guestSaveError}</p>
            </div>
            <button
              type="button"
              onClick={() => setGuestSaveError(null)}
              className="text-amber-500 hover:text-amber-800 p-0.5"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Nút Lưu Cấu Hình */}
        <div className="space-y-1 text-center">
          <button
            type="button"
            disabled={!hasItems || isLoading || isSaving}
            onClick={handleOpenSaveModal}
            className="w-full py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-2xs"
          >
            <Bookmark className="w-4 h-4" />
            <span>
              {isCurrentBuildSaved
                ? 'Lưu lại thành bản mới'
                : 'Lưu Cấu Hình Vào Tài Khoản'}
            </span>
          </button>
          <p className="text-[10px] text-slate-400">
            {authStatus === 'anonymous'
              ? 'Khách vãng lai sẽ được bảo toàn cấu hình và chuyển hướng đăng nhập để lưu.'
              : 'Lưu cấu hình giúp bạn xem lại sau. Không tự thêm giỏ hay tạo đơn hàng.'}
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

      {/* Save Build Modal */}
      {showSaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bookmark className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-sm sm:text-base">Lưu cấu hình PC</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Đóng form lưu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {user && user.role !== UserRole.Customer ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                  <p className="font-bold flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span>Không hỗ trợ tài khoản {user.role === UserRole.Admin ? 'Quản trị viên' : 'Nhân viên'}</span>
                  </p>
                  <p>
                    Theo quy định nghiệp vụ, chỉ tài khoản Khách hàng (Customer) mới có thể lưu và quản lý cấu hình PC cá nhân.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveSubmit} className="p-6 space-y-4">
                {saveError && (
                  <div
                    role="alert"
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="pc-build-name" className="text-xs font-bold text-slate-700 block">
                    Tên cấu hình <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="pc-build-name"
                    type="text"
                    maxLength={200}
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                    placeholder="VD: Dàn máy Gaming RTX 4070..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  {saveValidationErrors.name && (
                    <p className="text-[11px] font-semibold text-rose-600">
                      {saveValidationErrors.name}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 text-right">
                    {buildName.length}/200 ký tự
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="pc-build-desc" className="text-xs font-bold text-slate-700 block">
                    Mô tả (tùy chọn)
                  </label>
                  <textarea
                    id="pc-build-desc"
                    rows={3}
                    maxLength={1000}
                    value={buildDescription}
                    onChange={(e) => setBuildDescription(e.target.value)}
                    placeholder="Ghi chú về nhu cầu nâng cấp, mục đích sử dụng..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  {saveValidationErrors.description && (
                    <p className="text-[11px] font-semibold text-rose-600">
                      {saveValidationErrors.description}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 text-right">
                    {buildDescription.length}/1000 ký tự
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p>
                    Lưu {itemCount} linh kiện đã chọn với tổng tạm tính:{' '}
                    <span className="font-bold text-slate-900">
                      {previewResult ? formatVnd(previewResult.totalPrice) : '---'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>Lưu cấu hình</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
