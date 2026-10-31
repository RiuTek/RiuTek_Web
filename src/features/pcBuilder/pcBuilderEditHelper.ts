import type {
  MyPCBuildItem,
  PCBuilderProductItem,
  SelectedPCBuildItem,
} from './pcBuilderTypes'

/**
 * Chuyển đổi dữ liệu MyPCBuildItem từ GET detail sang SelectedPCBuildItem của Client.
 * Bảo toàn số lượng và thông tin kể cả khi linh kiện đã hết hàng hoặc ngừng kinh doanh
 * để người dùng nhìn thấy rõ và chủ động thay thế hoặc gỡ bỏ.
 */
export function mapMyPCBuildItemToSelectedItem(item: MyPCBuildItem): SelectedPCBuildItem {
  const product: PCBuilderProductItem = {
    id: item.productId,
    name: item.productName,
    slug: item.productSlug,
    sku: item.productSku,
    imageUrl: item.productImageUrl,
    componentType: item.componentType,
    price: item.currentPrice,
    stockQuantity: item.stockQuantity,
    isActive: item.isActive,
    canPurchase: item.canPurchase,
    specifications: item.specifications,
  }

  return {
    product,
    quantity: item.quantity,
  }
}

export interface InitialBuildState {
  name: string
  description: string | null
  items: Array<{ productId: string; quantity: number }>
}

export interface CurrentBuildState {
  name: string
  description: string
  items: SelectedPCBuildItem[]
}

/**
 * So sánh trạng thái ban đầu của cấu hình với trạng thái đang chỉnh sửa.
 * Tiêu chí dirty:
 * - Tên cấu hình thay đổi (sau khi trim).
 * - Mô tả thay đổi (sau khi trim).
 * - Tập linh kiện thay đổi (so khớp map productId -> tổng quantity, không phụ thuộc thứ tự render, giá hay tồn kho).
 */
export function computeIsDirty(
  initial: InitialBuildState,
  current: CurrentBuildState
): boolean {
  const normInitName = initial.name.trim()
  const normCurName = current.name.trim()
  if (normInitName !== normCurName) return true

  const normInitDesc = (initial.description ?? '').trim()
  const normCurDesc = current.description.trim()
  if (normInitDesc !== normCurDesc) return true

  const initMap = new Map<string, number>()
  for (const item of initial.items) {
    const key = item.productId.toLowerCase()
    initMap.set(key, (initMap.get(key) ?? 0) + item.quantity)
  }

  const curMap = new Map<string, number>()
  for (const item of current.items) {
    const key = item.product.id.toLowerCase()
    curMap.set(key, (curMap.get(key) ?? 0) + item.quantity)
  }

  if (initMap.size !== curMap.size) return true

  for (const [prodId, qty] of initMap.entries()) {
    if (curMap.get(prodId) !== qty) return true
  }

  return false
}
