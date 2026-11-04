import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Trash2,
  Bookmark,
  Layers,
  ShoppingBag,
  Check,
  ArrowRight,
  ExternalLink,
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
} from '../pcBuilderConstants'
import {
  DRAFT_TTL_MS,
  loadDraft,
  recordSaveIntent,
  saveDraft,
} from '../pcBuilderDraftStorage'
import {
  determineSaveDecision,
  createSaveConfirmationSnapshot,
  isSaveConfirmationValid,
  createSingleFlightLock,
  executePCBuildSaveOperation,
  PCBuildSaveLifecycle,
  type SaveConfirmationSnapshot,
} from '../pcBuildSaveHelper'
import { PCBuildCompatibilityNotice } from './PCBuildCompatibilityNotice'
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
  lastModifiedAt?: number | null
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
  lastModifiedAt,
}) => {
  const { status: authStatus, user, getAccessToken } = useAuth()
  const { addFromPCBuild } = useCart()
  const navigate = useNavigate()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveModalStep, setSaveModalStep] = useState<'form' | 'confirm'>('form')
  const [saveConfirmationSnapshot, setSaveConfirmationSnapshot] =
    useState<SaveConfirmationSnapshot | null>(null)
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

  // Synchronous lock & keyboard focus refs
  const saveLockRef = useRef(createSingleFlightLock())
  const confirmBackBtnRef = useRef<HTMLButtonElement | null>(null)
  const saveDialogRef = useRef<HTMLDialogElement | null>(null)
  const saveTriggerBtnRef = useRef<HTMLButtonElement | null>(null)

  // Định danh phiên xác thực hiện hành
  const currentSessionKey = useMemo(() => {
    return authStatus === 'authenticated' && user?.id
      ? `authenticated:${user.id}`
      : `unauthenticated:${authStatus}`
  }, [authStatus, user?.id])

  const activeSessionKeyRef = useRef(currentSessionKey)
  const addToCartSequenceRef = useRef(0)
  const lifecycleRef = useRef<PCBuildSaveLifecycle>(
    new PCBuildSaveLifecycle(currentSessionKey, null)
  )

  useEffect(() => {
    const lifecycle = lifecycleRef.current
    lifecycle.mount()
    return () => {
      lifecycle.unmount()
    }
  }, [])

  // Reset toàn bộ state mutation & build của account trước khi đăng xuất hoặc đổi tài khoản
  useEffect(() => {
    if (activeSessionKeyRef.current !== currentSessionKey) {
      activeSessionKeyRef.current = currentSessionKey
      lifecycleRef.current.updateContext(currentSessionKey, null)

      // Vô hiệu hóa mọi in-flight request của session trước
      addToCartSequenceRef.current += 1
      saveLockRef.current.release()

      // Reset toàn bộ state mutation, saved build, form & modal của account trước
      setSavedBuildInfo(null)
      setIsSaving(false)
      setSaveError(null)
      setShowSaveModal(false)
      setSaveModalStep('form')
      setSaveConfirmationSnapshot(null)
      setBuildName('')
      setBuildDescription('')
      setSaveValidationErrors({})

      setIsAddingToCart(false)
      setAddToCartSuccess(false)
      setAddToCartError(null)
    }
  }, [currentSessionKey])

  // Config key hiện tại của selectedItems
  const currentConfigKey = useMemo(() => {
    if (selectedItems.length === 0) return ''
    return selectedItems
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(';')
  }, [selectedItems])

  // Snapshot xác nhận hợp lệ theo cấu hình hiện tại
  const activeConfirmationSnapshot =
    saveConfirmationSnapshot &&
    saveConfirmationSnapshot.configKey === currentConfigKey
      ? saveConfirmationSnapshot
      : null

  const currentModalStep =
    saveModalStep === 'confirm' && activeConfirmationSnapshot !== null
      ? 'confirm'
      : 'form'

  // Native <dialog> lifecycle & body scroll lock
  useEffect(() => {
    if (!showSaveModal) return
    const dialog = saveDialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
      if (dialog && dialog.open) {
        dialog.close()
      }
      if (
        saveTriggerBtnRef.current &&
        typeof saveTriggerBtnRef.current.focus === 'function'
      ) {
        saveTriggerBtnRef.current.focus()
      }
    }
  }, [showSaveModal])

  // Focus vào nút "Quay lại chỉnh sửa" khi bước xác nhận xuất hiện
  useEffect(() => {
    if (showSaveModal && currentModalStep === 'confirm' && confirmBackBtnRef.current) {
      confirmBackBtnRef.current.focus()
    }
  }, [showSaveModal, currentModalStep])

  // Kiểm tra quyền sở hữu và khớp snapshot cấu hình lúc save
  const isCurrentBuildSaved =
    savedBuildInfo !== null &&
    authStatus === 'authenticated' &&
    user?.role === UserRole.Customer &&
    user?.id === savedBuildInfo.ownerUserId &&
    savedBuildInfo.configKeyAtSave === currentConfigKey &&
    hasItems

  // Mở form lưu cấu hình
  const handleOpenSaveModal = (e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!hasItems) return
    if (e) {
      saveTriggerBtnRef.current = e.currentTarget
    }
    setGuestSaveError(null)

    // 1. Nếu là khách vãng lai (hoặc chưa đăng nhập): lưu guest draft và ghi nhận save intent
    if (authStatus === 'anonymous') {
      try {
        if (typeof window === 'undefined' || !window.sessionStorage) {
          throw new Error('Trình duyệt không hỗ trợ sessionStorage.')
        }

        // Xác định timestamp chỉnh sửa cuối cùng của selection
        const currentGuestDraft = loadDraft('guest')
        let draftTimestamp: number

        if (currentGuestDraft.draft) {
          draftTimestamp = currentGuestDraft.draft.updatedAt
        } else {
          draftTimestamp = lastModifiedAt ?? Date.now()
        }

        const now = Date.now()
        // Nếu draft đã quá hạn nhưng selection vẫn đang hiện: không âm thầm gia hạn bằng nút Lưu
        if (now - draftTimestamp > DRAFT_TTL_MS) {
          setGuestSaveError(
            'Bản nháp lưu tạm đã quá hạn (1 giờ). Vui lòng điều chỉnh lại cấu hình hoặc đăng nhập để tiếp tục lưu cấu hình.'
          )
          return
        }

        const saved = saveDraft('guest', selectedItems, draftTimestamp)
        const intentRecorded = recordSaveIntent(draftTimestamp)
        if (!saved || !intentRecorded) {
          throw new Error('Không thể ghi bản nháp tạm vào sessionStorage.')
        }

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
    if (!buildName.trim()) {
      const defaultName = `Cấu hình PC - ${new Date().toLocaleDateString('vi-VN')}`
      setBuildName(defaultName)
    }
    setSaveValidationErrors({})
    setSaveError(null)
    setAddToCartError(null)
    setAddToCartSuccess(false)
    setSaveModalStep('form')
    setShowSaveModal(true)
  }

  // Thực thi lệnh lưu cấu hình với shared executePCBuildSaveOperation
  const executeSavePCBuild = async (payload: {
    name: string
    description?: string | null
    items: PCBuildItemInput[]
  }) => {
    if (!user || user.role !== UserRole.Customer) {
      return
    }

    const expectedOwnerId = user.id
    const configSnapshot = currentConfigKey
    const opContext = lifecycleRef.current.createOperationContext()

    await executePCBuildSaveOperation<
      { name: string; description?: string | null; items: PCBuildItemInput[] },
      MyPCBuild
    >({
      payload,
      getAccessToken,
      mutationFn: (p, token) => createPCBuild(p, token),
      context: opContext,
      lock: saveLockRef.current,
      onStart: () => {
        setIsSaving(true)
        setSaveError(null)
      },
      onSuccess: (result) => {
        setSavedBuildInfo({
          build: result,
          configKeyAtSave: configSnapshot,
          ownerUserId: expectedOwnerId,
        })
        setShowSaveModal(false)
        setSaveModalStep('form')
        setSaveConfirmationSnapshot(null)
        setAddToCartSuccess(false)
        setAddToCartError(null)
      },
      onError: (err: unknown) => {
        let msg = 'Không thể lưu cấu hình lúc này. Vui lòng thử lại.'
        if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
          msg = PC_BUILDER_ERROR_MESSAGES[err.code]
        } else if (err instanceof ApiError && err.description) {
          msg = err.description
        } else if (err instanceof Error) {
          msg = err.message
        }
        setSaveError(msg)
      },
      onSettled: () => {
        setIsSaving(false)
      },
    })
  }

  // Submit lưu cấu hình từ form ban đầu
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

    const payloadItems: PCBuildItemInput[] = selectedItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }))

    const payload = {
      name: trimmedName,
      description: trimmedDesc || null,
      items: payloadItems,
    }

    // Áp dụng bảng quyết định decision table
    const decision = determineSaveDecision({
      previewResult,
      isPreviewLoading: isLoading,
      previewError: error,
    })

    if (decision === 'wait_loading') {
      return
    }

    if (decision === 'confirm_required' || decision === 'unverified_preview') {
      const snapshot = createSaveConfirmationSnapshot({
        flow: 'create',
        configKey: currentConfigKey,
        ownerId: user.id,
        payload,
        previewResult,
        previewError: error,
      })
      setSaveConfirmationSnapshot(snapshot)
      setSaveModalStep('confirm')
      setSaveError(null)
      return
    }

    // decision === 'save_directly'
    await executeSavePCBuild(payload)
  }

  // Xác nhận lưu cấu hình khi đang ở bước confirm
  const handleConfirmedSave = async () => {
    if (
      isSaving ||
      !user ||
      user.role !== UserRole.Customer ||
      !activeConfirmationSnapshot
    ) {
      return
    }

    const payloadItems: PCBuildItemInput[] = selectedItems.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }))

    const currentPayload = {
      name: buildName.trim(),
      description: buildDescription.trim() || null,
      items: payloadItems,
    }

    const isValid = isSaveConfirmationValid({
      snapshot: activeConfirmationSnapshot,
      currentConfigKey,
      currentOwnerId: user.id,
      currentPayload,
      previewResult,
      isPreviewLoading: isLoading,
      previewError: error,
    })

    if (!isValid) {
      setSaveError(
        'Cấu hình hoặc thông số tương thích đã thay đổi trong lúc chờ xác nhận. Vui lòng kiểm tra lại trước khi lưu.'
      )
      setSaveModalStep('form')
      setSaveConfirmationSnapshot(null)
      return
    }

    await executeSavePCBuild(activeConfirmationSnapshot.payload)
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

    const requestSessionKey = currentSessionKey
    const requestSeq = ++addToCartSequenceRef.current
    const targetBuildId = savedBuildInfo.build.id

    setIsAddingToCart(true)
    setAddToCartError(null)
    setAddToCartSuccess(false)

    const isRequestCurrent = () =>
      activeSessionKeyRef.current === requestSessionKey &&
      addToCartSequenceRef.current === requestSeq

    try {
      await addFromPCBuild(targetBuildId)
      // Guard: Chỉ hiển thị success nếu request vẫn thuộc session và sequence hiện hành
      if (isRequestCurrent()) {
        setAddToCartSuccess(true)
      }
    } catch (err: unknown) {
      let msg = 'Không thể thêm cấu hình vào giỏ hàng. Vui lòng thử lại.'
      if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
        msg = PC_BUILDER_ERROR_MESSAGES[err.code]
      } else if (err instanceof Error) {
        msg = err.message
      }
      if (isRequestCurrent()) {
        setAddToCartError(msg)
      }
    } finally {
      if (isRequestCurrent()) {
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
          <PCBuildCompatibilityNotice
            isCompatible={previewResult.isCompatible}
            isCompleteSystem={previewResult.isCompleteSystem}
            issues={previewResult.issues}
            missingComponents={previewResult.missingComponents}
            estimatedWattage={previewResult.estimatedWattage}
            recommendedPsuWattage={previewResult.recommendedPsuWattage}
            showPowerSpecs={true}
            showCompleteSystemBadge={true}
          />

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

            <div className="flex items-center justify-between pt-2 border-t border-emerald-200/70">
              <Link
                to={`/pc-builds/${savedBuildInfo.build.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 hover:text-red-600 underline transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Xem cấu hình đã lưu</span>
              </Link>
            </div>
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

      {/* Save Build Modal with native <dialog> */}
      {showSaveModal && (
        <dialog
          ref={saveDialogRef}
          aria-labelledby="pc-build-save-dialog-title"
          onCancel={(e) => {
            e.preventDefault()
            if (!isSaving) {
              if (currentModalStep === 'confirm') {
                setSaveModalStep('form')
                setSaveConfirmationSnapshot(null)
              } else {
                setShowSaveModal(false)
              }
            }
          }}
          onClick={(e) => {
            if (e.target === saveDialogRef.current && !isSaving) {
              if (currentModalStep === 'confirm') {
                setSaveModalStep('form')
                setSaveConfirmationSnapshot(null)
              } else {
                setShowSaveModal(false)
              }
            }
          }}
          className="backdrop:bg-slate-950/60 backdrop:backdrop-blur-xs p-0 bg-transparent rounded-3xl shadow-2xl max-w-md w-[95vw] max-h-[90vh] overflow-hidden m-auto border border-slate-200/80 focus:outline-none"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div
              className={`px-6 py-4 text-white flex items-center justify-between transition-colors flex-shrink-0 ${
                currentModalStep === 'confirm'
                  ? activeConfirmationSnapshot?.assessment.level === 'unverified'
                    ? 'bg-amber-900'
                    : 'bg-rose-950'
                  : 'bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {currentModalStep === 'confirm' ? (
                  <AlertTriangle
                    className={`w-5 h-5 ${
                      activeConfirmationSnapshot?.assessment.level === 'unverified'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  />
                ) : (
                  <Bookmark className="w-5 h-5 text-red-500" />
                )}
                <h3 id="pc-build-save-dialog-title" className="font-bold text-sm sm:text-base">
                  {currentModalStep === 'confirm'
                    ? activeConfirmationSnapshot?.assessment.level === 'unverified'
                      ? 'Chưa thể kiểm tra tương thích'
                      : 'Cấu hình có xung đột tương thích'
                    : 'Lưu cấu hình PC'}
                </h3>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (currentModalStep === 'confirm') {
                    setSaveModalStep('form')
                    setSaveConfirmationSnapshot(null)
                  } else {
                    setShowSaveModal(false)
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
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
            ) : currentModalStep === 'confirm' ? (
              <div className="p-6 space-y-4">
                {saveError && (
                  <div
                    role="alert"
                    className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <span>{saveError}</span>
                  </div>
                )}

                {activeConfirmationSnapshot?.assessment.level === 'unverified' ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm space-y-2">
                    <p className="font-semibold leading-relaxed">
                      Chưa thể kiểm tra tương thích giữa các linh kiện do hệ thống tạm thời không phản hồi. Bạn có thể thử kiểm tra lại hoặc vẫn tiếp tục lưu cấu hình.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onRetry()
                        setShowSaveModal(false)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Thử kiểm tra lại</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hệ thống phát hiện một số linh kiện có xung đột hoặc thông số chưa phù hợp. Bạn vẫn có thể tiếp tục lưu cấu hình vào tài khoản và chỉnh sửa sau.
                    </p>
                    <div className="max-h-60 overflow-y-auto pr-1">
                      <PCBuildCompatibilityNotice
                        isCompatible={activeConfirmationSnapshot?.previewResult?.isCompatible}
                        isCompleteSystem={activeConfirmationSnapshot?.previewResult?.isCompleteSystem}
                        issues={activeConfirmationSnapshot?.previewResult?.issues}
                        missingComponents={activeConfirmationSnapshot?.previewResult?.missingComponents}
                        compact={true}
                      />
                    </div>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-0.5">
                  <p className="font-semibold text-slate-900 truncate">
                    Cấu hình: {buildName}
                  </p>
                  <p>
                    Số lượng: <span className="font-bold">{itemCount} linh kiện</span> • Tạm tính:{' '}
                    <span className="font-bold text-slate-900">
                      {previewResult ? formatVnd(previewResult.totalPrice) : '---'}
                    </span>
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    ref={confirmBackBtnRef}
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setSaveModalStep('form')
                      setSaveConfirmationSnapshot(null)
                    }}
                    className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors"
                  >
                    Quay lại chỉnh sửa
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleConfirmedSave}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <span>Vẫn lưu</span>
                    )}
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
        </dialog>
      )}
    </div>
  )
}
