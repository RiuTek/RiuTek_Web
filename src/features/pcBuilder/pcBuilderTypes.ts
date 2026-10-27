import type { ComponentType } from '../products/productTypes'
import type { ProductSummary } from '../products/productTypes'

/**
 * Input cho một linh kiện khi gửi lên Backend để kiểm tra preview
 */
export interface PCBuildItemInput {
  productId: string
  quantity: number
}

/**
 * Request payload gửi lên POST /api/v1/pc-builds/preview
 */
export interface PCBuildPreviewRequest {
  items: PCBuildItemInput[]
}

/**
 * Một linh kiện trong kết quả preview do Backend trả về
 */
export interface PCBuildPreviewItem {
  productId: string
  productName: string
  sku: string
  imageUrl?: string | null
  componentType: ComponentType
  unitPrice: number
  quantity: number
  linePrice: number
  canPurchase: boolean
  issueCode?: string | null
  stockQuantity?: number
}

/**
 * Chi tiết vấn đề tương thích phát hiện bởi Backend
 */
export interface CompatibilityIssue {
  ruleId: string
  severity: 'Error' | 'Warning' | 'Info' | string
  componentA?: ComponentType | null
  componentB?: ComponentType | null
  message: string
}

/**
 * Kết quả kiểm tra tương thích và tính toán cấu hình từ Backend
 */
export interface PCBuildPreviewResult {
  totalPrice: number
  estimatedWattage: number
  recommendedPsuWattage: number
  isCompatible: boolean
  isCompleteSystem: boolean
  missingComponents: ComponentType[]
  issues: CompatibilityIssue[]
  canPurchaseAll: boolean
  items: PCBuildPreviewItem[]
}

/**
 * State linh kiện đã chọn ở phía Client (chứa đầy đủ ProductSummary để hiển thị)
 */
export interface SelectedPCBuildItem {
  product: ProductSummary
  quantity: number
}
