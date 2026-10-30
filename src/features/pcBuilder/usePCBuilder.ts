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
    product: ProductSummary
    quantity: number
  }>
}

function loadStoredGuestItems(): SelectedPCBuildItem[] {
  if (typeof window === 'undefined' || !window.sessionStorage) return []
  try {
    const raw = sessionStorage.getItem(PC_BUILDER_GUEST_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StoredGuestBuild
    if (
      !parsed ||
      typeof parsed.savedAt !== 'number' ||
      !Array.isArray(parsed.items) ||
      Date.now() - parsed.savedAt > PC_BUILDER_GUEST_STORAGE_TTL_MS
    ) {
      sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
      return []
    }

    // Validate cấu trúc từng item
    const validItems: SelectedPCBuildItem[] = []
    for (const entry of parsed.items) {
      if (
        entry &&
        entry.product &&
        typeof entry.product.id === 'string' &&
        typeof entry.product.name === 'string' &&
        typeof entry.product.componentType === 'number' &&
        typeof entry.quantity === 'number' &&
        entry.quantity >= 1 &&
        entry.quantity <= 20
      ) {
        validItems.push({
          product: entry.product,
          quantity: entry.quantity,
        })
      }
    }

    // Đã restore thành công -> xóa dữ liệu tạm khỏi sessionStorage
    sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
    return validItems
  } catch {
    try {
      sessionStorage.removeItem(PC_BUILDER_GUEST_STORAGE_KEY)
    } catch {
      // Bỏ qua lỗi sessionStorage nếu bị chặn
    }
    return []
  }
}

export function usePCBuilder() {
  const [selectedItems, setSelectedItems] = useState<SelectedPCBuildItem[]>(() =>
    loadStoredGuestItems()
  )
  const [activeSlot, setActiveSlot] = useState<ComponentType | null>(null)
  const [previewSnapshot, setPreviewSnapshot] = useState<PreviewSnapshot | null>(null)
  const [errorSnapshot, setErrorSnapshot] = useState<ErrorSnapshot | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Request tracking guards
  const activeSequenceRef = useRef<number>(0)
  const latestConfigKeyRef = useRef<string>('')
  const abortControllerRef = useRef<AbortController | null>(null)

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
  }
}
