import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { UserRole } from '../auth/authTypes'
import type { ProductSummary, ComponentType } from '../products/productTypes'
import { previewPCBuild } from './pcBuilderApi'
import {
  isSingleChoiceComponent,
  MAX_BUILD_ITEMS,
  MAX_MULTI_CHOICE_QUANTITY,
  MIN_QUANTITY,
  PC_BUILDER_ERROR_MESSAGES,
} from './pcBuilderConstants'
import {
  clearSaveIntent,
  loadDraft,
  peekSaveIntent,
  removeDraft,
  saveDraft,
  type PCBuilderDraftPayload,
} from './pcBuilderDraftStorage'
import type {
  PCBuildItemInput,
  PCBuildPreviewResult,
  PCBuilderProductItem,
  SelectedPCBuildItem,
} from './pcBuilderTypes'

interface PreviewSnapshot {
  configKey: string
  result: PCBuildPreviewResult
}

interface ErrorSnapshot {
  configKey: string
  error: string
}

function computeSelectedProduct(
  prev: SelectedPCBuildItem[],
  product: ProductSummary
): SelectedPCBuildItem[] {
  const isSingle = isSingleChoiceComponent(product.componentType)

  if (isSingle) {
    const existingSingle = prev.find(
      (item) => item.product.componentType === product.componentType
    )
    if (existingSingle && existingSingle.product.id === product.id) {
      return prev
    }

    const filtered = prev.filter(
      (item) => item.product.componentType !== product.componentType
    )
    if (filtered.length >= MAX_BUILD_ITEMS) return prev
    return [...filtered, { product, quantity: 1 }]
  }

  // Multi-choice: Tăng quantity hoặc thêm mới
  const existingIndex = prev.findIndex((item) => item.product.id === product.id)
  if (existingIndex >= 0) {
    const currentQty = prev[existingIndex].quantity
    if (currentQty >= MAX_MULTI_CHOICE_QUANTITY) {
      return prev
    }
    return prev.map((item, idx) => {
      if (idx !== existingIndex) return item
      return {
        ...item,
        quantity: Math.min(MAX_MULTI_CHOICE_QUANTITY, item.quantity + 1),
      }
    })
  }

  if (prev.length >= MAX_BUILD_ITEMS) {
    return prev
  }

  return [...prev, { product, quantity: 1 }]
}

export function usePCBuilder() {
  const { status: authStatus, user } = useAuth()

  const [selectedItems, setSelectedItems] = useState<SelectedPCBuildItem[]>([])
  const [activeSlot, setActiveSlot] = useState<ComponentType | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null)
  const [errorSnapshot, setErrorSnapshot] = useState<ErrorSnapshot | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Trạng thái khôi phục bản nháp cấu hình
  const [isRestoringDraft, setIsRestoringDraft] = useState(false)
  const [draftRestoreNotice, setDraftRestoreNotice] = useState<string | null>(null)
  const [draftRestoreError, setDraftRestoreError] = useState<string | null>(null)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  // Tracking refs
  const selectedItemsRef = useRef<SelectedPCBuildItem[]>(selectedItems)
  useEffect(() => {
    selectedItemsRef.current = selectedItems
  }, [selectedItems])

  const [lastModifiedAt, setLastModifiedAt] = useState<number | null>(null)

  const activeSequenceRef = useRef<number>(0)
  const latestConfigKeyRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

  const isMountedRef = useRef(true)
  const isRestoreResolvedRef = useRef(false)
  const restoreSequenceRef = useRef(0)
  const hasAttemptedRestoreRef = useRef(false)

  // Lifecycle mount check
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Khôi phục bản nháp từ sessionStorage và xác thực lại dữ liệu từ Backend
  const performRestore = useCallback(async () => {
    if (authStatus === 'checking') return
    if (authStatus === 'unavailable') {
      isRestoreResolvedRef.current = true
      return
    }

    const currentSeq = ++restoreSequenceRef.current

    let draftToRestore: PCBuilderDraftPayload | null = null
    let transferGuestToUser = false
    let noticeMessage: string | null = null
    let deferredAccountNotice: string | null = null

    if (authStatus === 'authenticated' && user?.id) {
      if (user.role === UserRole.Customer) {
        // 1. Kiểm tra xem tài khoản đã có sẵn bản nháp hợp lệ hay chưa
        const userDraftResult = loadDraft(user.id)
        if (userDraftResult.storageUnavailable) {
          setStorageWarning(
            'Trình duyệt đang chặn bộ nhớ tạm (sessionStorage). Cấu hình sẽ không được giữ lại khi tải lại trang.'
          )
        }
        if (userDraftResult.notice) {
          noticeMessage = userDraftResult.notice
        }

        // Kiểm tra intent chuyển giao từ phiên khách (KHÔNG xóa intent để cho phép retry)
        const saveIntent = peekSaveIntent()

        if (userDraftResult.draft) {
          draftToRestore = userDraftResult.draft
          if (saveIntent.valid) {
            // Tài khoản đã có sẵn bản nháp: ưu tiên tài khoản, thông báo không ghi đè âm thầm
            clearSaveIntent()
            deferredAccountNotice =
              'Đã khôi phục bản nháp của tài khoản. Cấu hình tạm từ phiên khách chưa được áp dụng vì tài khoản đã có sẵn bản nháp.'
          }
        } else if (saveIntent.valid) {
          // Tài khoản chưa có bản nháp và có intent lưu từ phiên khách: đọc guest draft
          const guestDraftResult = loadDraft('guest')
          if (guestDraftResult.draft) {
            draftToRestore = guestDraftResult.draft
            transferGuestToUser = true
          } else {
            // Guest draft đã hỏng hoặc quá hạn: kết thúc intent
            clearSaveIntent()
            if (guestDraftResult.notice) {
              noticeMessage = guestDraftResult.notice
            }
          }
        }
      } else {
        // Staff / Admin: chỉ tải nháp của tài khoản nếu có; KHÔNG tự nhận hoặc tiêu thụ intent của luồng này
        const userDraftResult = loadDraft(user.id)
        if (userDraftResult.draft) {
          draftToRestore = userDraftResult.draft
        }
      }
    } else if (authStatus === 'anonymous') {
      const guestDraftResult = loadDraft('guest')
      if (guestDraftResult.storageUnavailable) {
        setStorageWarning(
          'Trình duyệt đang chặn bộ nhớ tạm (sessionStorage). Cấu hình sẽ không được giữ lại khi tải lại trang.'
        )
      }
      if (guestDraftResult.notice) {
        noticeMessage = guestDraftResult.notice
      }
      draftToRestore = guestDraftResult.draft
    }

    if (!draftToRestore || draftToRestore.items.length === 0) {
      isRestoreResolvedRef.current = true
      if (deferredAccountNotice) {
        setDraftRestoreNotice(deferredAccountNotice)
      } else if (noticeMessage) {
        setDraftRestoreNotice(noticeMessage)
      }
      return
    }

    setIsRestoringDraft(true)
    setDraftRestoreError(null)

    try {
      const inputs: PCBuildItemInput[] = draftToRestore.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }))

      // Gọi public preview để lấy thông tin giá, kho và tương thích mới nhất
      const previewRes = await previewPCBuild(inputs)

      // Guard: Nếu unmount hoặc đã có restore/action mới hơn thì bỏ qua
      if (!isMountedRef.current || restoreSequenceRef.current !== currentSeq) {
        return
      }

      const restoredItems: SelectedPCBuildItem[] = []
      const returnedMap = new Map<string, (typeof previewRes.items)[0]>()
      for (const item of previewRes.items) {
        returnedMap.set(item.productId.toLowerCase(), item)
      }

      for (const input of inputs) {
        const found = returnedMap.get(input.productId.toLowerCase())
        if (found) {
          const productItem: PCBuilderProductItem = {
            id: found.productId,
            name: found.name,
            slug: found.slug,
            sku: found.sku,
            imageUrl: found.imageUrl,
            componentType: found.componentType,
            price: found.currentUnitPrice,
            stockQuantity: found.stockQuantity,
            isActive: found.isActive,
            canPurchase: found.canPurchase,
            issueCode: found.issueCode,
            specifications: found.specifications,
          }
          restoredItems.push({
            product: productItem,
            quantity: input.quantity,
          })
        }
      }

      if (restoredItems.length > 0) {
        selectedItemsRef.current = restoredItems
        setSelectedItems(restoredItems)
        setLastModifiedAt(draftToRestore.updatedAt)

        const restoredKey = restoredItems
          .map((item) => `${item.product.id}:${item.quantity}`)
          .sort()
          .join(';')

        setPreviewSnapshot({ configKey: restoredKey, result: previewRes })
        setCompletedKey(restoredKey)

        if (transferGuestToUser && user?.id) {
          // Ghi user draft với updatedAt gốc
          const writeOk = saveDraft(user.id, restoredItems, draftToRestore.updatedAt)
          if (!writeOk) {
            // Ghi user draft thất bại: giữ guest và intent, hiển thị storage warning, cho retry
            setStorageWarning(
              'Trình duyệt đang chặn bộ nhớ tạm (sessionStorage). Cấu hình sẽ không được giữ lại khi tải lại trang.'
            )
          } else {
            // Ghi thành công: dọn guest draft và tiêu thụ intent
            removeDraft('guest')
            clearSaveIntent()
            setDraftRestoreNotice('Đã khôi phục cấu hình từ phiên khách vào tài khoản của bạn.')
          }
        } else {
          // Giữ draft với updatedAt gốc trong storage
          const currentOwner =
            authStatus === 'authenticated' && user?.id ? user.id : 'guest'
          saveDraft(currentOwner, restoredItems, draftToRestore.updatedAt)

          if (deferredAccountNotice) {
            // Thông báo ưu tiên nháp tài khoản không bị thông báo generic ghi đè
            setDraftRestoreNotice(deferredAccountNotice)
          } else if (restoredItems.length < inputs.length) {
            setDraftRestoreNotice(
              `Đã khôi phục ${restoredItems.length}/${inputs.length} linh kiện. Một số linh kiện trước đó không còn tồn tại trong hệ thống.`
            )
          } else {
            setDraftRestoreNotice('Đã khôi phục bản nháp cấu hình thành công!')
          }
        }
      } else {
        // Toàn bộ linh kiện không còn tồn tại: dọn draft hiện hành và intent phù hợp
        const currentOwner =
          authStatus === 'authenticated' && user?.id ? user.id : 'guest'
        removeDraft(currentOwner)
        if (transferGuestToUser) {
          clearSaveIntent()
          removeDraft('guest')
        }
        setDraftRestoreNotice(
          'Không thể khôi phục các linh kiện do đã bị ngừng kinh doanh hoặc không còn tồn tại.'
        )
      }
    } catch (err: unknown) {
      if (!isMountedRef.current || restoreSequenceRef.current !== currentSeq) {
        return
      }

      // Giữ nguyên guest payload, updatedAt và intent trong storage để người dùng có thể thử lại
      let msg = 'Không thể xác thực lại bản nháp cấu hình với máy chủ. Vui lòng thử lại.'
      if (err instanceof ApiError && err.description) {
        msg = err.description
      } else if (err instanceof Error) {
        msg = err.message
      }
      setDraftRestoreError(msg)
    } finally {
      if (isMountedRef.current && restoreSequenceRef.current === currentSeq) {
        setIsRestoringDraft(false)
        isRestoreResolvedRef.current = true
      }
    }
  }, [authStatus, user])

  // Khôi phục bản nháp khi auth status ổn định
  useEffect(() => {
    if (authStatus === 'checking') return
    if (!hasAttemptedRestoreRef.current) {
      hasAttemptedRestoreRef.current = true
      performRestore()
    }
  }, [authStatus, performRestore])

  // Tự động lưu bản nháp khi có thao tác chỉnh sửa selection thực sự
  const persistSelection = useCallback(
    (newItems: SelectedPCBuildItem[]) => {
      if (!isRestoreResolvedRef.current) return
      if (authStatus === 'checking' || authStatus === 'unavailable') return

      const owner = authStatus === 'authenticated' && user?.id ? user.id : 'guest'

      if (newItems.length === 0) {
        removeDraft(owner)
        return
      }

      const ok = saveDraft(owner, newItems)
      if (!ok) {
        setStorageWarning(
          'Trình duyệt đang chặn bộ nhớ tạm (sessionStorage). Cấu hình sẽ không được giữ lại khi tải lại trang.'
        )
      }
    },
    [authStatus, user]
  )

  // Tập hợp các ID sản phẩm đã chọn
  const selectedProductIds = useMemo(() => {
    return new Set(selectedItems.map((item) => item.product.id))
  }, [selectedItems])

  // Key xác thực đại diện duy nhất cho cấu hình hiện tại
  const currentConfigKey = useMemo(() => {
    if (selectedItems.length === 0) return ''
    return selectedItems
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(';')
  }, [selectedItems])

  // Preview & Error chỉ được trả cho UI khi khớp chính xác currentConfigKey
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

  // Chọn hoặc thay thế sản phẩm
  const selectProduct = useCallback(
    (product: ProductSummary) => {
      if (isRestoringDraft) return
      if (!product.isActive || product.stockQuantity <= 0) return

      const current = selectedItemsRef.current
      const next = computeSelectedProduct(current, product)
      if (next !== current) {
        setLastModifiedAt(Date.now())
        selectedItemsRef.current = next
        setSelectedItems(next)
        persistSelection(next)
      }
    },
    [isRestoringDraft, persistSelection]
  )

  // Thay đổi số lượng sản phẩm (chỉ hỗ trợ multi-choice)
  const updateItemQuantity = useCallback(
    (productId: string, qty: number) => {
      if (isRestoringDraft) return
      const current = selectedItemsRef.current
      let changed = false
      const next = current.map((item) => {
        if (item.product.id !== productId) return item
        if (isSingleChoiceComponent(item.product.componentType)) {
          if (item.quantity === 1) return item
          changed = true
          return { ...item, quantity: 1 }
        }
        const clampedQty = Math.max(
          MIN_QUANTITY,
          Math.min(MAX_MULTI_CHOICE_QUANTITY, Math.floor(qty) || 1)
        )
        if (clampedQty === item.quantity) return item
        changed = true
        return { ...item, quantity: clampedQty }
      })

      if (changed) {
        setLastModifiedAt(Date.now())
        selectedItemsRef.current = next
        setSelectedItems(next)
        persistSelection(next)
      }
    },
    [isRestoringDraft, persistSelection]
  )

  // Gỡ sản phẩm khỏi cấu hình
  const removeItem = useCallback(
    (productId: string) => {
      if (isRestoringDraft) return
      const current = selectedItemsRef.current
      const next = current.filter((item) => item.product.id !== productId)
      if (next.length !== current.length) {
        setLastModifiedAt(Date.now())
        selectedItemsRef.current = next
        setSelectedItems(next)
        persistSelection(next)
      }
    },
    [isRestoringDraft, persistSelection]
  )

  // Xóa toàn bộ cấu hình
  const clearBuild = useCallback(() => {
    restoreSequenceRef.current++
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    activeSequenceRef.current++
    setLastModifiedAt(null)
    selectedItemsRef.current = []
    setSelectedItems([])
    setPreviewSnapshot(null)
    setErrorSnapshot(null)
    setCompletedKey(null)

    const owner = authStatus === 'authenticated' && user?.id ? user.id : 'guest'
    removeDraft(owner)
  }, [authStatus, user])

  // Retry preview thủ công
  const retryPreview = useCallback(() => {
    setCompletedKey(null)
    setErrorSnapshot(null)
    setRetryTrigger((prev) => prev + 1)
  }, [])

  // Retry khôi phục bản nháp
  const retryDraftRestore = useCallback(() => {
    setDraftRestoreError(null)
    performRestore()
  }, [performRestore])

  // Debounced auto-preview khi selection thay đổi (400ms)
  useEffect(() => {
    if (selectedItems.length === 0) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const targetConfigKey = currentConfigKey
    latestConfigKeyRef.current = currentConfigKey
    const currentSeq = ++activeSequenceRef.current

    const timer = setTimeout(() => {
      if (
        controller.signal.aborted ||
        activeSequenceRef.current !== currentSeq ||
        latestConfigKeyRef.current !== targetConfigKey
      ) {
        return
      }

      const payload: PCBuildItemInput[] = selectedItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      previewPCBuild(payload, controller.signal)
        .then((result) => {
          if (
            controller.signal.aborted ||
            activeSequenceRef.current !== currentSeq ||
            latestConfigKeyRef.current !== targetConfigKey
          ) {
            return
          }
          setPreviewSnapshot({ configKey: targetConfigKey, result })
          setErrorSnapshot(null)
          setCompletedKey(targetConfigKey)
        })
        .catch((err: unknown) => {
          if (
            controller.signal.aborted ||
            (err instanceof Error && err.name === 'AbortError') ||
            activeSequenceRef.current !== currentSeq ||
            latestConfigKeyRef.current !== targetConfigKey
          ) {
            return
          }

          let msg = 'Không thể kiểm tra tương thích cấu hình lúc này. Vui lòng thử lại.'
          if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
            msg = PC_BUILDER_ERROR_MESSAGES[err.code]
          } else if (err instanceof Error) {
            msg = err.message
          }

          setErrorSnapshot({ configKey: targetConfigKey, error: msg })
          setPreviewSnapshot(null)
          setCompletedKey(targetConfigKey)
        })
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [currentConfigKey, selectedItems, retryTrigger])

  return {
    selectedItems,
    selectedProductIds,
    activeSlot,
    setActiveSlot,
    previewResult: effectivePreviewResult,
    isPreviewLoading,
    previewError: effectivePreviewError,
    lastModifiedAt,
    selectProduct,
    updateItemQuantity,
    removeItem,
    clearBuild,
    retryPreview,
    isRestoringDraft,
    draftRestoreNotice,
    draftRestoreError,
    storageWarning,
    retryDraftRestore,
    dismissDraftRestoreNotice: () => setDraftRestoreNotice(null),
    dismissDraftRestoreError: () => setDraftRestoreError(null),
    dismissStorageWarning: () => setStorageWarning(null),
    // Aliases cho backward compatibility
    isRestoringGuestBuild: isRestoringDraft,
    guestRestoreNotice: draftRestoreNotice,
    guestRestoreError: draftRestoreError,
    retryGuestRestore: retryDraftRestore,
    dismissGuestRestoreNotice: () => setDraftRestoreNotice(null),
    dismissGuestRestoreError: () => setDraftRestoreError(null),
  }
}
