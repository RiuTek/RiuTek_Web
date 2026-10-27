import type {
  ComponentSpecification,
  ComponentType,
  ProductSummary,
} from '../products/productTypes'

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
 * Một linh kiện trong kết quả preview do Backend trả về (khớp chính xác PCBuildItemDto)
 */
export interface PCBuildPreviewItem {
  productId: string
  name: string
  slug: string
  sku: string
  imageUrl: string
  componentType: ComponentType
  quantity: number
  currentUnitPrice: number
  lineTotal: number
  stockQuantity: number
  isActive: boolean
  canPurchase: boolean
  issueCode: string | null
  specifications: ComponentSpecification | null
}

/**
 * Chi tiết vấn đề tương thích phát hiện bởi Backend (khớp CompatibilityIssueDto)
 */
export interface CompatibilityIssue {
  ruleId: string
  severity: string
  componentA: string
  componentB: string
  message: string
}

/**
 * Kết quả kiểm tra tương thích và tính toán cấu hình từ Backend (khớp PCBuildPreviewDto)
 */
export interface PCBuildPreviewResult {
  totalPrice: number
  estimatedWattage: number
  recommendedPsuWattage: number
  isCompatible: boolean
  isCompleteSystem: boolean
  missingComponents: string[]
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
