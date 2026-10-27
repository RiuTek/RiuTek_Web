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
} from './pcBuilderConstants'
import type {
  PCBuildItemInput,
  PCBuildPreviewResult,
  SelectedPCBuildItem,
} from './pcBuilderTypes'

export function usePCBuilder() {
  const [selectedItems, setSelectedItems] = useState<SelectedPCBuildItem[]>([])
  const [activeSlot, setActiveSlot] = useState<ComponentType | null>(null)
  const [previewResult, setPreviewResult] = useState<PCBuildPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const abortControllerRef = useRef<AbortController | null>(null)

  // Tập hợp các ID sản phẩm đã chọn
  const selectedProductIds = useMemo(() => {
    return new Set(selectedItems.map((item) => item.product.id))
  }, [selectedItems])

  // Key đại diện cho cấu hình hiện tại để xác định trạng thái loading
  const currentConfigKey = useMemo(() => {
    if (selectedItems.length === 0) return ''
    const serialized = selectedItems
      .map((item) => `${item.product.id}:${item.quantity}`)
      .sort()
      .join(';')
    return `${serialized}|${retryTrigger}`
  }, [selectedItems, retryTrigger])

  // isLoading được tính đồng bộ từ chênh lệch giữa key hoàn tất và key hiện tại
  const isPreviewLoading =
    selectedItems.length > 0 && completedKey !== currentConfigKey

  // Chọn hoặc thay thế sản phẩm
  const selectProduct = useCallback((product: ProductSummary) => {
    if (!product.isActive || product.stockQuantity <= 0) {
      return
    }

    setSelectedItems((prev) => {
      const isSingle = isSingleChoiceComponent(product.componentType)

      if (isSingle) {
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
    setSelectedItems([])
    setPreviewResult(null)
    setPreviewError(null)
    setCompletedKey(null)
  }, [])

  // Retry preview thủ công
  const retryPreview = useCallback(() => {
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

    const targetKey = currentConfigKey
    const timer = setTimeout(() => {
      const payload: PCBuildItemInput[] = selectedItems.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      previewPCBuild(payload, controller.signal)
        .then((result) => {
          setPreviewResult(result)
          setPreviewError(null)
          setCompletedKey(targetKey)
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === 'AbortError') {
            return
          }
          if (err instanceof ApiError && err.code && PC_BUILDER_ERROR_MESSAGES[err.code]) {
            setPreviewError(PC_BUILDER_ERROR_MESSAGES[err.code])
          } else if (err instanceof Error) {
            setPreviewError(err.message)
          } else {
            setPreviewError(
              'Không thể kiểm tra tương thích cấu hình lúc này. Vui lòng thử lại.'
            )
          }
          setCompletedKey(targetKey)
        })
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [currentConfigKey, selectedItems])

  const effectivePreviewResult = selectedItems.length === 0 ? null : previewResult
  const effectivePreviewError = selectedItems.length === 0 ? null : previewError

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
