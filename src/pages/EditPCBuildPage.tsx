import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate, useBlocker } from 'react-router-dom'
import {
  Wrench,
  ChevronLeft,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { UserRole } from '../features/auth/authTypes'
import { ComponentType, type ProductSummary } from '../features/products/productTypes'
import {
  getMyPCBuildById,
  updateMyPCBuild,
  previewPCBuild,
} from '../features/pcBuilder/pcBuilderApi'
import {
  isSingleChoiceComponent,
  MIN_QUANTITY,
  MAX_MULTI_CHOICE_QUANTITY,
} from '../features/pcBuilder/pcBuilderConstants'
import { computeSelectedProduct } from '../features/pcBuilder/usePCBuilder'
import {
  mapMyPCBuildItemToSelectedItem,
  computeIsDirty,
  type InitialBuildState,
} from '../features/pcBuilder/pcBuilderEditHelper'
import { PCBuilderSlotList } from '../features/pcBuilder/components/PCBuilderSlotList'
import { PCBuilderProductPickerModal } from '../features/pcBuilder/components/PCBuilderProductPickerModal'
import { PCBuilderEditSummary } from '../features/pcBuilder/components/PCBuilderEditSummary'
import type {
  MyPCBuild,
  PCBuildItemInput,
  PCBuildPreviewResult,
  SelectedPCBuildItem,
  UpdatePCBuildRequest,
} from '../features/pcBuilder/pcBuilderTypes'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface EditPCBuildContentProps {
  buildId: string
  ownerId: string
}

const EditPCBuildContent: React.FC<EditPCBuildContentProps> = ({
  buildId,
  ownerId,
}) => {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()

  // State nạp dữ liệu gốc từ GET (derived loading pattern)
  const [initialBuild, setInitialBuild] = useState<MyPCBuild | null>(null)
  const [reloadTrigger, setReloadTrigger] = useState(0)

  const currentQueryKey = `${buildId}-${reloadTrigger}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<{
    key: string
    status?: number
    message: string
  } | null>(null)

  const currentError = loadError?.key === currentQueryKey ? loadError : null
  const isLoadingRecord = loadedQueryKey !== currentQueryKey && currentError === null

  // State chỉnh sửa (in-memory)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedPCBuildItem[]>([])
  const [activeSlot, setActiveSlot] = useState<ComponentType | null>(null)

  // Baseline dùng theo dõi dirty
  const [initialBaseline, setInitialBaseline] = useState<InitialBuildState | null>(null)
  const [isSavedClean, setIsSavedClean] = useState(false)

  // Key đại diện duy nhất cho tập linh kiện hiện tại
  const currentConfigKey = useMemo(() => {
    if (selectedItems.length === 0) return ''
    return selectedItems
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(';')
  }, [selectedItems])

  // State preview (derived loading pattern theo snapshot)
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    configKey: string
    result: PCBuildPreviewResult
  } | null>(null)
  const [errorSnapshot, setErrorSnapshot] = useState<{
    configKey: string
    error: string
  } | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [previewRetryTrigger, setPreviewRetryTrigger] = useState(0)

  const effectivePreviewResult =
    previewSnapshot &&
    previewSnapshot.configKey === currentConfigKey &&
    selectedItems.length > 0
      ? previewSnapshot.result
      : null

  const effectivePreviewError =
    errorSnapshot &&
    errorSnapshot.configKey === currentConfigKey &&
    selectedItems.length > 0
      ? errorSnapshot.error
      : null

  const isPreviewLoading =
    selectedItems.length > 0 &&
    (completedKey !== currentConfigKey ||
      (!effectivePreviewResult && !effectivePreviewError))

  // State submit PUT
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isConflict, setIsConflict] = useState(false)

  // Lifecycle và sequence tracking refs
  const isMountedRef = useRef(true)
  const userRef = useRef(user)
  const buildIdRef = useRef(buildId)
  const recordSeqRef = useRef(0)
  const putSeqRef = useRef(0)
  const previewSeqRef = useRef(0)
  const previewAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (previewAbortRef.current) {
        previewAbortRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    userRef.current = user
    buildIdRef.current = buildId
  }, [user, buildId])

  // Tính toán trạng thái dirty
  const isDirty = useMemo(() => {
    if (isSavedClean || !initialBaseline) return false
    return computeIsDirty(initialBaseline, {
      name,
      description,
      items: selectedItems,
    })
  }, [isSavedClean, initialBaseline, name, description, selectedItems])

  // Chặn điều hướng nội bộ bằng useBlocker khi có thay đổi chưa lưu
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !isSavedClean &&
      isDirty &&
      currentLocation.pathname !== nextLocation.pathname
  )

  // Cảnh báo người dùng khi reload hoặc đóng tab
  useEffect(() => {
    if (!isDirty || isSavedClean) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isSavedClean])

  // 1. Tải dữ liệu ban đầu từ GET /pc-builds/{id}
  useEffect(() => {
    let cancelled = false
    const currentSeq = ++recordSeqRef.current
    const abortController = new AbortController()

    const isContextCurrent = () =>
      isMountedRef.current &&
      !cancelled &&
      recordSeqRef.current === currentSeq &&
      userRef.current?.id === ownerId &&
      buildIdRef.current === buildId

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
      .then((record) => {
        if (isContextCurrent() && record) {
          setInitialBuild(record)
          setName(record.name)
          setDescription(record.description ?? '')
          const mapped = record.items.map(mapMyPCBuildItemToSelectedItem)
          setSelectedItems(mapped)

          // Thiết lập baseline để theo dõi dirty
          setInitialBaseline({
            name: record.name,
            description: record.description,
            items: record.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          })
          setIsSavedClean(false)

          const initKey = mapped
            .map((item) => `${item.product.id}:${item.quantity}`)
            .sort()
            .join(';')

          // Khởi tạo snapshot preview từ record gốc
          setPreviewSnapshot({
            configKey: initKey,
            result: {
              totalPrice: record.totalPrice,
              estimatedWattage: record.estimatedWattage,
              recommendedPsuWattage: record.recommendedPsuWattage,
              isCompatible: record.isCompatible,
              isCompleteSystem: record.isCompleteSystem,
              missingComponents: record.missingComponents,
              issues: record.issues,
              canPurchaseAll: record.canPurchaseAll,
              items: record.items.map((i) => ({
                productId: i.productId,
                name: i.productName,
                slug: i.productSlug,
                sku: i.productSku,
                imageUrl: i.productImageUrl,
                componentType: i.componentType,
                quantity: i.quantity,
                currentUnitPrice: i.currentPrice,
                lineTotal: i.lineTotal,
                stockQuantity: i.stockQuantity,
                isActive: i.isActive,
                canPurchase: i.canPurchase,
                issueCode: null,
                specifications: i.specifications,
              })),
            },
          })
          setErrorSnapshot(null)
          setCompletedKey(initKey)
          setLoadError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (!isContextCurrent()) return
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
              message: 'Bạn không có quyền chỉnh sửa cấu hình PC này.',
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
  }, [buildId, ownerId, reloadTrigger, currentQueryKey, getAccessToken])

  // 2. Tự động kiểm tra preview sau 400ms khi selection thay đổi
  useEffect(() => {
    // Không chạy preview khi đang nạp record ban đầu hoặc không có linh kiện
    if (isLoadingRecord || !initialBaseline) return

    if (selectedItems.length === 0) {
      if (previewAbortRef.current) previewAbortRef.current.abort()
      return
    }

    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
    }
    const controller = new AbortController()
    previewAbortRef.current = controller

    const currentSeq = ++previewSeqRef.current
    const targetConfigKey = currentConfigKey

    const timer = setTimeout(async () => {
      if (
        controller.signal.aborted ||
        !isMountedRef.current ||
        previewSeqRef.current !== currentSeq
      ) {
        return
      }

      try {
        const inputs: PCBuildItemInput[] = selectedItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        }))

        const res = await previewPCBuild(inputs, controller.signal)

        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          previewSeqRef.current !== currentSeq
        ) {
          return
        }

        setPreviewSnapshot({ configKey: targetConfigKey, result: res })
        setErrorSnapshot(null)
        setCompletedKey(targetConfigKey)
      } catch (err: unknown) {
        if (
          controller.signal.aborted ||
          !isMountedRef.current ||
          previewSeqRef.current !== currentSeq ||
          (err instanceof Error && err.name === 'AbortError')
        ) {
          return
        }
        let msg = 'Không thể kiểm tra tính tương thích của cấu hình. Vui lòng thử lại.'
        if (err instanceof ApiError && err.description) {
          msg = err.description
        } else if (err instanceof Error) {
          msg = err.message
        }
        setErrorSnapshot({ configKey: targetConfigKey, error: msg })
        setPreviewSnapshot(null)
        setCompletedKey(targetConfigKey)
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [currentConfigKey, selectedItems, previewRetryTrigger, isLoadingRecord, initialBaseline])

  // Chọn hoặc thay thế sản phẩm
  const handleSelectProduct = useCallback((product: ProductSummary) => {
    setSelectedItems((prev) => computeSelectedProduct(prev, product))
  }, [])

  // Cập nhật số lượng
  const handleUpdateItemQuantity = useCallback((productId: string, qty: number) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item
        if (isSingleChoiceComponent(item.product.componentType)) {
          return item.quantity === 1 ? item : { ...item, quantity: 1 }
        }
        const clampedQty = Math.max(
          MIN_QUANTITY,
          Math.min(MAX_MULTI_CHOICE_QUANTITY, Math.floor(qty) || 1)
        )
        return clampedQty === item.quantity ? item : { ...item, quantity: clampedQty }
      })
    )
  }, [])

  // Gỡ sản phẩm
  const handleRemoveItem = useCallback((productId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  // Xóa toàn bộ lựa chọn trong form
  const handleClearSelection = useCallback(() => {
    setSelectedItems([])
  }, [])

  // Retry nạp lại record ban đầu
  const handleRetryRecordLoad = () => {
    setLoadError(null)
    setReloadTrigger((prev) => prev + 1)
  }

  // Reload record từ server khi gặp 409 conflict
  const handleReloadRecordFromServer = () => {
    setSubmitError(null)
    setIsConflict(false)
    setReloadTrigger((prev) => prev + 1)
  }

  // 3. Xử lý Cập nhật cấu hình (PUT /api/v1/pc-builds/{id})
  const handleUpdateBuild = async () => {
    if (isSubmitting || !isDirty || !initialBuild) return
    const cleanName = name.trim()
    if (!cleanName) return
    if (selectedItems.length === 0 || selectedItems.length > 30) return

    const putSeq = ++putSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      userRef.current?.id === ownerId &&
      buildIdRef.current === buildId &&
      putSeqRef.current === putSeq

    setIsSubmitting(true)
    setSubmitError(null)
    setIsConflict(false)

    const requestPayload: UpdatePCBuildRequest = {
      name: cleanName,
      description: description.trim() || null,
      items: selectedItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    }

    try {
      const token = await getAccessToken(false)
      if (!isContextCurrent()) return
      if (!token) throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')

      let updatedRecord: MyPCBuild
      try {
        updatedRecord = await updateMyPCBuild(buildId, requestPayload, token)
      } catch (err: unknown) {
        if (!isContextCurrent()) return
        if (err instanceof ApiError && err.status === 401) {
          const freshToken = await getAccessToken(true)
          if (!isContextCurrent()) return
          if (!freshToken) throw err
          updatedRecord = await updateMyPCBuild(buildId, requestPayload, freshToken)
        } else {
          throw err
        }
      }

      if (!isContextCurrent()) return

      // Cập nhật thành công: đánh dấu clean và điều hướng về trang chi tiết
      setIsSavedClean(true)
      navigate(`/pc-builds/${updatedRecord.id}`, { replace: true })
    } catch (err: unknown) {
      if (!isContextCurrent()) return

      if (err instanceof ApiError) {
        if (err.status === 409) {
          setIsConflict(true)
          setSubmitError(
            'Cấu hình đã bị thay đổi bởi thao tác khác. Bạn có muốn tải lại dữ liệu mới nhất từ máy chủ không? (Lưu ý: các thay đổi chưa lưu sẽ bị hủy).'
          )
        } else if (err.status === 404) {
          setSubmitError('Không tìm thấy cấu hình này trên máy chủ.')
        } else if (err.status === 403) {
          setSubmitError('Bạn không có quyền cập nhật cấu hình PC này.')
        } else if (err.description) {
          setSubmitError(err.description)
        } else {
          setSubmitError('Không thể cập nhật cấu hình PC. Vui lòng thử lại.')
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Lỗi kết nối máy chủ.')
      }
    } finally {
      if (isContextCurrent()) {
        setIsSubmitting(false)
      }
    }
  }

  // Xử lý Hủy chỉnh sửa
  const handleCancel = () => {
    navigate(`/pc-builds/${buildId}`)
  }

  // Loading state nạp record ban đầu
  if (isLoadingRecord) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center"
      >
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Đang nạp dữ liệu cấu hình để chỉnh sửa...
        </p>
      </div>
    )
  }

  // Load record error state
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
                onClick={handleRetryRecordLoad}
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

  if (!initialBuild) return null

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Link
              to="/pc-builds"
              className="hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Cấu hình của tôi</span>
            </Link>
            <span>/</span>
            <Link
              to={`/pc-builds/${buildId}`}
              className="hover:text-red-600 transition-colors truncate max-w-[200px]"
            >
              {initialBuild.name}
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">Chỉnh sửa</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold">
                <Wrench className="w-3.5 h-3.5" />
                <span>Chỉnh Sửa Cấu Hình Đã Lưu</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Chỉnh Sửa: {initialBuild.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Tự do thay thế, điều chỉnh số lượng hoặc gỡ linh kiện. Các thay đổi của bạn sẽ được lưu trực tiếp vào cấu hình hiện tại khi bấm Cập nhật.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stable Slot List */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950">
                  Linh Kiện Cấu Hình ({selectedItems.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Nhấn "Thay thế" hoặc "Chọn linh kiện" để chọn sản phẩm từ danh mục
                </p>
              </div>
            </div>

            <PCBuilderSlotList
              selectedItems={selectedItems}
              previewItems={effectivePreviewResult?.items}
              activeSlot={activeSlot}
              onSelectSlot={(slot: ComponentType) => {
                if (!isSubmitting) {
                  setActiveSlot(slot)
                }
              }}
              onUpdateQuantity={handleUpdateItemQuantity}
              onRemoveItem={handleRemoveItem}
            />
          </div>

          {/* Right Column: Edit Summary Form */}
          <div className="lg:col-span-5 xl:col-span-4">
            <PCBuilderEditSummary
              buildId={buildId}
              name={name}
              onNameChange={setName}
              description={description}
              onDescriptionChange={setDescription}
              selectedItems={selectedItems}
              previewResult={effectivePreviewResult}
              isPreviewLoading={isPreviewLoading}
              previewError={effectivePreviewError}
              onRetryPreview={() => setPreviewRetryTrigger((prev) => prev + 1)}
              isDirty={isDirty}
              isSubmitting={isSubmitting}
              submitError={submitError}
              isConflict={isConflict}
              onReloadFromServer={handleReloadRecordFromServer}
              onSubmit={handleUpdateBuild}
              onCancel={handleCancel}
              onClearSelection={handleClearSelection}
            />
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      {activeSlot !== null && (
        <PCBuilderProductPickerModal
          key={activeSlot}
          activeSlot={activeSlot}
          onSelectProduct={handleSelectProduct}
          onClose={() => setActiveSlot(null)}
          selectedItems={selectedItems}
        />
      )}

      {/* Blocker Confirmation Modal */}
      {blocker.state === 'blocked' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Rời khỏi trang mà không lưu?
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Bạn có những thay đổi chưa được cập nhật vào cấu hình. Nếu rời đi bây giờ, các thay đổi sẽ bị mất.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => blocker.reset()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Ở lại trang
                </button>
                <button
                  type="button"
                  onClick={() => blocker.proceed()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  Rời khỏi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export const EditPCBuildPage: React.FC = () => {
  const { buildId } = useParams<{ buildId: string }>()
  const { user } = useAuth()

  const isCustomer = user?.role === UserRole.Customer
  const isUuidValid = Boolean(buildId && UUID_REGEX.test(buildId))

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
  if (!isUuidValid || !buildId) {
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

  return (
    <EditPCBuildContent
      key={`${user.id}:${buildId}`}
      buildId={buildId}
      ownerId={user.id}
    />
  )
}
