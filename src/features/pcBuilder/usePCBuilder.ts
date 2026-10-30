import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ApiError } from '../../lib/api'
import type { ProductSummary, ComponentType } from '../products/productTypes'
import { previewPCBuild } from './pcBuilderApi'
import {
  isSingleChoiceComponent,
  MAX_BUILD_ITEMS,
  MAX_MULTI_CHOICE_QUANTITY,
  MIN_QUANTITY,
  PC_BUILDER_ERROR_MESSAGES,
  PC_BUILDER_GUEST_STORAGE_KEY,
  PC_BUILDER_GUEST_STORAGE_TTL_MS,
} from './pcBuilderConstants'
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

interface StoredGuestBuild {
  savedAt: number
  items: Array<{
    productId: string
    quantity: number
  }>
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function usePCBuilder() {
  const [selectedItems, setSelectedItems] = useState<SelectedPCBuildItem[]>([])
  const [activeSlot, setActiveSlot] = useState<ComponentType | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null)
  const [errorSnapshot, setErrorSnapshot] = useState<ErrorSnapshot | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Trạng thái khôi phục cấu hình từ guest session
  const [isRestoringGuestBuild, setIsRestoringGuestBuild] = useState(false)
  const [guestRestoreNotice, setGuestRestoreNotice] = useState<string | null>(null)
  const [guestRestoreError, setGuestRestoreError] = useState<string | null>(null)

  // Request tracking guards
  const activeSequenceRef = useRef<number>(0)
  const latestConfigKeyRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasAttemptedRestoreRef = useRef(false)

  // Khôi phục cấu hình khách vãng lai sau đăng nhập và xác thực lại dữ liệu từ Backend
  const restoreGuestBuild = useCallback(async () => {
    if (typeof window === 'undefined' || !window.sessionStorage) return

    let raw: string | null
    try {
      raw = sessionStorage.getItem(PC_BUILDER_GUEST_STORAGE_KEY)
    } catch {
      return
    }

    if (!raw) return

    let parsed: StoredGuestBuild
    try {
      parsed = JSON.parse(raw) as StoredGuestBuild
    } catch {
      // Payload hỏng -> xóa an toàn
      try {
        sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
      } catch {
        // Bỏ qua lỗi storage
      }
      setGuestRestoreNotice('Dữ liệu cấu hình tạm bị hỏng và đã được làm mới.')
      return
    }

    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.items) ||
      Date.now() - parsed.savedAt > PC_BUILDER_GUEST_STORAGE_TTL_MS
    ) {
      // Hết hạn hoặc cấu trúc sai -> xóa
      try {
        sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
      } catch {
        // Bỏ qua lỗi storage
      }
      if (parsed && Date.now() - parsed.savedAt > PC_BUILDER_GUEST_STORAGE_TTL_MS) {
        setGuestRestoreNotice('Cấu hình lưu tạm đã quá hạn (1 giờ) và đã được xóa.')
      }
      return
    }

    // Validate chặt chẽ từng item (chỉ nhận UUID hợp lệ, quantity 1..20, tối đa 30 dòng, loại bỏ duplicate)
    const validInputs: PCBuildItemInput[] = []
    const seenIds = new Set<string>()

    for (const item of parsed.items.slice(0, MAX_BUILD_ITEMS)) {
      if (
        item &&
        typeof item.productId === 'string' &&
        UUID_REGEX.test(item.productId.trim()) &&
        typeof item.quantity === 'number' &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= MAX_MULTI_CHOICE_QUANTITY
      ) {
        const cleanId = item.productId.trim().toLowerCase()
        if (!seenIds.has(cleanId)) {
          seenIds.add(cleanId)
          validInputs.push({
            productId: cleanId,
            quantity: item.quantity,
          })
        }
      }
    }

    if (validInputs.length === 0) {
      try {
        sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
      } catch {
        // Bỏ qua lỗi storage
      }
      setGuestRestoreNotice('Cấu hình lưu tạm không chứa linh kiện hợp lệ.')
      return
    }

    setIsRestoringGuestBuild(true)
    setGuestRestoreError(null)

    try {
      // Xác thực lại thông tin sản phẩm và giá/kho từ Backend qua preview endpoint
      const previewRes = await previewPCBuild(validInputs)

      // Chuyển đổi các item trả về thành SelectedPCBuildItem
      const restoredItems: SelectedPCBuildItem[] = []
      const returnedMap = new Map<string, (typeof previewRes.items)[0]>()
      for (const item of previewRes.items) {
        returnedMap.set(item.productId.toLowerCase(), item)
      }

      for (const input of validInputs) {
        const found = returnedMap.get(input.productId)
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
        setSelectedItems(restoredItems)

        // Tính toán và tạo ngay configKey tương ứng để snapshot khớp lập tức
        const restoredKey = restoredItems
          .map((item) => `${item.product.id}:${item.quantity}`)
          .sort()
          .join(';')

        setPreviewSnapshot({ configKey: restoredKey, result: previewRes })
        setCompletedKey(restoredKey)

        if (restoredItems.length < validInputs.length) {
          setGuestRestoreNotice(
            `Đã khôi phục ${restoredItems.length}/${validInputs.length} linh kiện. Một số linh kiện trước đó không còn tồn tại trong hệ thống.`
          )
        } else {
          setGuestRestoreNotice('Đã khôi phục cấu hình từ phiên trước thành công!')
        }
      } else {
        setGuestRestoreNotice(
          'Không thể khôi phục các linh kiện do đã bị ngừng kinh doanh hoặc không còn tồn tại.'
        )
      }

      // Xóa sessionStorage sau khi khôi phục thành công
      try {
        sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
      } catch {
        // Bỏ qua
      }
    } catch (err: unknown) {
      // Khi gặp lỗi mạng / API: GIỮ NGUYÊN payload trong sessionStorage để người dùng có thể thử lại
      let msg = 'Không thể xác thực lại cấu hình lưu tạm với máy chủ. Vui lòng thử lại.'
      if (err instanceof ApiError && err.description) {
        msg = err.description
      } else if (err instanceof Error) {
        msg = err.message
      }
      setGuestRestoreError(msg)
    } finally {
      setIsRestoringGuestBuild(false)
    }
  }, [])

  // Chạy restore khi hook mount lần đầu
  useEffect(() => {
    if (!hasAttemptedRestoreRef.current) {
      hasAttemptedRestoreRef.current = true
      restoreGuestBuild()
    }
  }, [restoreGuestBuild])

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
  const selectProduct = useCallback((product: ProductSummary) => {
    if (!product.isActive || product.stockQuantity <= 0) {
      return
    }

    setSelectedItems((prev) => {
      const isSingle = isSingleChoiceComponent(product.componentType)

      if (isSingle) {
        // Kiểm tra xem có đúng sản phẩm này đang được chọn hay không
        const existingSingle = prev.find(
          (item) => item.product.componentType === product.componentType
        )
        if (existingSingle && existingSingle.product.id === product.id) {
          return prev // Không làm gì nếu đã chọn đúng sản phẩm này
        }

        // Thay thế sản phẩm cùng ComponentType nếu là single-choice
        const filtered = prev.filter(
          (item) => item.product.componentType !== product.componentType
        )
        if (filtered.length >= MAX_BUILD_ITEMS) return prev
        return [...filtered, { product, quantity: 1 }]
      }

      // Multi-choice: Nếu đã có product.id trong danh sách thì tăng quantity (tối đa 20)
      const existingIndex = prev.findIndex((item) => item.product.id === product.id)
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].quantity
        if (currentQty >= MAX_MULTI_CHOICE_QUANTITY) {
          return prev // Đã đạt tối đa 20
        }
        return prev.map((item, idx) => {
          if (idx !== existingIndex) return item
          return {
            ...item,
            quantity: Math.min(MAX_MULTI_CHOICE_QUANTITY, item.quantity + 1),
          }
        })
      }

      // Nếu chưa có, thêm mới (nếu chưa vượt quá 30 items)
      if (prev.length >= MAX_BUILD_ITEMS) {
        return prev
      }

      return [...prev, { product, quantity: 1 }]
    })
  }, [])

  // Thay đổi số lượng sản phẩm (chỉ hỗ trợ multi-choice)
  const updateItemQuantity = useCallback((productId: string, qty: number) => {
    setSelectedItems((prev) => {
      return prev.map((item) => {
        if (item.product.id !== productId) return item
        if (isSingleChoiceComponent(item.product.componentType)) {
          return { ...item, quantity: 1 }
        }
        const clampedQty = Math.max(
          MIN_QUANTITY,
          Math.min(MAX_MULTI_CHOICE_QUANTITY, Math.floor(qty) || 1)
        )
        return { ...item, quantity: clampedQty }
      })
    })
  }, [])

  // Gỡ sản phẩm khỏi cấu hình
  const removeItem = useCallback((productId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  // Xóa toàn bộ cấu hình
  const clearBuild = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    activeSequenceRef.current++
    setSelectedItems([])
    setPreviewSnapshot(null)
    setErrorSnapshot(null)
    setCompletedKey(null)
  }, [])

  // Retry preview thủ công
  const retryPreview = useCallback(() => {
    setCompletedKey(null)
    setErrorSnapshot(null)
    setRetryTrigger((prev) => prev + 1)
  }, [])

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
    selectProduct,
    updateItemQuantity,
    removeItem,
    clearBuild,
    retryPreview,
    isRestoringGuestBuild,
    guestRestoreNotice,
    guestRestoreError,
    retryGuestRestore: restoreGuestBuild,
    dismissGuestRestoreNotice: () => setGuestRestoreNotice(null),
    dismissGuestRestoreError: () => setGuestRestoreError(null),
  }
}
