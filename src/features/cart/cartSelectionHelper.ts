import type { CartDto, CartItemDto } from './cartTypes'

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

export function isValidUuid(id: unknown): id is string {
  if (typeof id !== 'string') return false
  const trimmed = id.trim()
  if (!UUID_REGEX.test(trimmed)) return false
  if (trimmed === EMPTY_GUID) return false
  return true
}

/**
 * Validate danh sách selectedProductIds:
 * - Phải là array string
 * - Mỗi ID là UUID hợp lệ, khác empty GUID
 * - Loại bỏ trùng lặp (duy nhất, giữ nguyên thứ tự)
 * - Tối đa 50 phần tử theo contract BE
 */
export function validateSelectedProductIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const uniqueIds: string[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (isValidUuid(item)) {
      const lower = item.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        uniqueIds.push(item)
        if (uniqueIds.length >= 50) break
      }
    }
  }

  return uniqueIds
}

export function getCartSelectionStorageKey(ownerId: string): string {
  return `riutek:cart-selected-products:${ownerId}`
}

/**
 * Đọc selection từ sessionStorage theo ownerId.
 * Không throw, nếu lỗi/mismatch trả về [] (không fallback chọn toàn bộ giỏ).
 */
export function loadCartSelection(ownerId: string): string[] {
  if (!ownerId) return []
  try {
    const raw = sessionStorage.getItem(getCartSelectionStorageKey(ownerId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return []
    const candidate = parsed as Record<string, unknown>
    if (candidate.ownerId !== ownerId) return []
    return validateSelectedProductIds(candidate.selectedProductIds)
  } catch {
    return []
  }
}

/**
 * Ghi selection vào sessionStorage theo ownerId.
 */
export function persistCartSelection(
  ownerId: string,
  selectedProductIds: string[]
): boolean {
  if (!ownerId) return false
  try {
    const validIds = validateSelectedProductIds(selectedProductIds)
    const key = getCartSelectionStorageKey(ownerId)
    if (validIds.length === 0) {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ownerId,
          selectedProductIds: validIds,
        })
      )
    }
    return true
  } catch {
    return false
  }
}

/**
 * Đối soát (reconcile) danh sách selection với cart hiện tại:
 * - Khi cart chưa tải xong (cart === null): giữ nguyên selection, không prune!
 * - Khi cart đã tải: chỉ giữ lại các sản phẩm còn trong giỏ và có canPurchase === true.
 */
export function reconcileSelectionWithCart(
  selectedIds: string[],
  cart: CartDto | null
): {
  reconciledIds: string[]
  hasPruned: boolean
  prunedCount: number
} {
  // Cart chưa tải hoặc chưa có items -> giữ nguyên selection
  if (!cart || !cart.items) {
    return {
      reconciledIds: selectedIds,
      hasPruned: false,
      prunedCount: 0,
    }
  }

  const validCartItemsMap = new Map<string, CartItemDto>()
  for (const item of cart.items) {
    if (item.canPurchase) {
      validCartItemsMap.set(item.productId.toLowerCase(), item)
    }
  }

  const reconciledIds: string[] = []
  let prunedCount = 0

  for (const id of selectedIds) {
    const matched = validCartItemsMap.get(id.toLowerCase())
    if (matched) {
      reconciledIds.push(matched.productId)
    } else {
      prunedCount++
    }
  }

  return {
    reconciledIds,
    hasPruned: prunedCount > 0,
    prunedCount,
  }
}

export interface CartSelectionTotals {
  selectedItemCount: number
  selectedLineCount: number
  selectedSubtotal: number
  canCheckoutSelected: boolean
  isAllSelected: boolean
  isIndeterminate: boolean
}

/**
 * Tính toán số liệu thống kê cho các sản phẩm được chọn trong giỏ hàng.
 */
export function calculateCartSelectionTotals(
  cart: CartDto | null,
  selectedIds: string[]
): CartSelectionTotals {
  if (!cart || !cart.items || cart.items.length === 0 || selectedIds.length === 0) {
    return {
      selectedItemCount: 0,
      selectedLineCount: 0,
      selectedSubtotal: 0,
      canCheckoutSelected: false,
      isAllSelected: false,
      isIndeterminate: false,
    }
  }

  const selectedSet = new Set(selectedIds.map((id) => id.toLowerCase()))
  let selectedItemCount = 0
  let selectedLineCount = 0
  let selectedSubtotal = 0
  let allSelectedPurchasable = true

  const purchasableItems = cart.items.filter((item) => item.canPurchase)

  for (const item of cart.items) {
    if (selectedSet.has(item.productId.toLowerCase())) {
      selectedLineCount++
      selectedItemCount += item.quantity
      selectedSubtotal += item.lineTotal
      if (!item.canPurchase) {
        allSelectedPurchasable = false
      }
    }
  }

  const canCheckoutSelected =
    selectedLineCount > 0 &&
    selectedLineCount <= 50 &&
    allSelectedPurchasable

  const isAllSelected =
    purchasableItems.length > 0 &&
    purchasableItems.every((item) => selectedSet.has(item.productId.toLowerCase()))

  const isIndeterminate =
    selectedLineCount > 0 && !isAllSelected

  return {
    selectedItemCount,
    selectedLineCount,
    selectedSubtotal,
    canCheckoutSelected,
    isAllSelected,
    isIndeterminate,
  }
}
