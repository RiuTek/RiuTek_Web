import type { ComponentType } from '../products/productTypes'
import type {
  CompatibilityIssue,
  MyPCBuild,
  PCBuildPreviewResult,
  SelectedPCBuildItem,
} from './pcBuilderTypes'
import { PC_BUILDER_SLOT_ORDER } from './pcBuilderConstants'

/**
 * Một dòng linh kiện chuẩn hóa trong bản chụp xuất ảnh (Export Snapshot)
 */
export interface PCBuildExportItem {
  id: string
  name: string
  sku: string
  componentType: ComponentType
  quantity: number
  unitPrice: number
  lineTotal: number
}

/**
 * Dữ liệu snapshot trọn gói tại thời điểm người dùng nhấn "Tải ảnh cấu hình"
 */
export interface PCBuildExportSnapshot {
  sourceType: 'builder' | 'saved'
  buildName: string
  items: PCBuildExportItem[]
  totalPrice: number
  priceLabel: string
  savedDateStr?: string | null
  exportedAt: Date
  estimatedWattage?: number | null
  recommendedPsuWattage?: number | null
  isCompatible?: boolean | null
  isCompleteSystem?: boolean | null
  issues?: CompatibilityIssue[] | null
  missingComponents?: string[] | null
}

const slotOrderMap = new Map<ComponentType, number>()
PC_BUILDER_SLOT_ORDER.forEach((slot, index) => {
  slotOrderMap.set(slot, index)
})

/**
 * Kiểm tra xem cấu hình trong Builder hiện tại có đủ điều kiện để xuất ảnh hay không
 */
export function canExportFromBuilder(params: {
  selectedItems: SelectedPCBuildItem[]
  previewResult: PCBuildPreviewResult | null
  isRestoringDraft?: boolean
  isPreviewLoading?: boolean
  previewError?: string | null
}): { canExport: boolean; reason?: string } {
  const {
    selectedItems,
    previewResult,
    isRestoringDraft = false,
    isPreviewLoading = false,
    previewError = null,
  } = params

  if (selectedItems.length === 0) {
    return { canExport: false, reason: 'Chưa có linh kiện nào trong cấu hình.' }
  }

  if (isRestoringDraft) {
    return { canExport: false, reason: 'Đang khôi phục bản nháp cấu hình...' }
  }

  if (isPreviewLoading) {
    return { canExport: false, reason: 'Đang cập nhật tính toán giá và tương thích...' }
  }

  if (previewError) {
    return {
      canExport: false,
      reason: 'Chưa thể xác thực giá từ máy chủ. Vui lòng nhấn Thử lại kiểm tra.',
    }
  }

  if (!previewResult) {
    return { canExport: false, reason: 'Chưa có dữ liệu tính toán từ máy chủ.' }
  }

  // So khớp productId và quantity giữa selections và previewResult.items
  const previewItems = previewResult.items ?? []
  if (previewItems.length !== selectedItems.length) {
    return {
      canExport: false,
      reason: 'Dữ liệu tính toán đang đồng bộ với các lựa chọn mới...',
    }
  }

  const previewItemMap = new Map<string, number>()
  for (const item of previewItems) {
    previewItemMap.set(item.productId, (previewItemMap.get(item.productId) ?? 0) + item.quantity)
  }

  for (const selected of selectedItems) {
    const previewQty = previewItemMap.get(selected.product.id)
    if (previewQty !== selected.quantity) {
      return {
        canExport: false,
        reason: 'Dữ liệu tính toán đang đồng bộ với các lựa chọn mới...',
      }
    }
  }

  return { canExport: true }
}

/**
 * Adapter: Tạo snapshot từ Builder đang chọn (sử dụng giá và tính toán từ previewResult)
 */
export function createSnapshotFromBuilder(params: {
  selectedItems: SelectedPCBuildItem[]
  previewResult: PCBuildPreviewResult
  buildName?: string
}): PCBuildExportSnapshot | null {
  const { selectedItems, previewResult, buildName } = params

  if (!selectedItems || selectedItems.length === 0 || !previewResult) {
    return null
  }

  // Sắp xếp các linh kiện theo đúng thứ tự 9 nhóm PC_BUILDER_SLOT_ORDER
  const sortedItems = [...previewResult.items].sort((a, b) => {
    const orderA = slotOrderMap.get(a.componentType) ?? 99
    const orderB = slotOrderMap.get(b.componentType) ?? 99
    if (orderA !== orderB) return orderA - orderB
    return a.productId.localeCompare(b.productId)
  })

  const exportItems: PCBuildExportItem[] = sortedItems.map((item) => ({
    id: item.productId,
    name: item.name,
    sku: item.sku,
    componentType: item.componentType,
    quantity: item.quantity,
    unitPrice: item.currentUnitPrice, // Giá đơn vị hiện tại từ server preview
    lineTotal: item.lineTotal,
  }))

  return {
    sourceType: 'builder',
    buildName: (buildName ?? '').trim() || 'Cấu hình PC của tôi',
    items: exportItems,
    totalPrice: previewResult.totalPrice,
    priceLabel: 'Tổng tạm tính (Giá hiện tại từ máy chủ)',
    savedDateStr: null,
    exportedAt: new Date(),
    estimatedWattage: previewResult.estimatedWattage,
    recommendedPsuWattage: previewResult.recommendedPsuWattage,
    isCompatible: previewResult.isCompatible,
    isCompleteSystem: previewResult.isCompleteSystem,
    issues: previewResult.issues ? [...previewResult.issues] : [],
    missingComponents: previewResult.missingComponents ? [...previewResult.missingComponents] : [],
  }
}

function formatSavedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

/**
 * Adapter: Tạo snapshot từ cấu hình đã lưu (MyPCBuild)
 * Lưu ý: Giữ nguyên SNAPSHOT GIÁ ĐÃ LƯU (unitPrice và totalPrice), không dùng currentPrice
 */
export function createSnapshotFromSavedBuild(build: MyPCBuild): PCBuildExportSnapshot {
  const sortedItems = [...build.items].sort((a, b) => {
    const orderA = slotOrderMap.get(a.componentType) ?? 99
    const orderB = slotOrderMap.get(b.componentType) ?? 99
    if (orderA !== orderB) return orderA - orderB
    return (a.id || a.productId).localeCompare(b.id || b.productId)
  })

  const exportItems: PCBuildExportItem[] = sortedItems.map((item) => ({
    id: item.id || item.productId,
    name: item.productName,
    sku: item.productSku,
    componentType: item.componentType,
    quantity: item.quantity,
    unitPrice: item.unitPrice, // GIÁ LƯU BAN ĐẦU
    lineTotal: item.lineTotal,
  }))

  return {
    sourceType: 'saved',
    buildName: (build.name ?? '').trim() || 'Cấu hình PC đã lưu',
    items: exportItems,
    totalPrice: build.totalPrice, // TỔNG GIÁ SNAPSHOT ĐÃ LƯU
    priceLabel: 'Tổng giá snapshot đã lưu (Giá tại thời điểm lưu cấu hình)',
    savedDateStr: formatSavedDate(build.createdAt),
    exportedAt: new Date(),
    estimatedWattage: build.estimatedWattage,
    recommendedPsuWattage: build.recommendedPsuWattage,
    isCompatible: build.isCompatible,
    isCompleteSystem: build.isCompleteSystem,
    issues: build.issues ? [...build.issues] : [],
    missingComponents: build.missingComponents ? [...build.missingComponents] : [],
  }
}
