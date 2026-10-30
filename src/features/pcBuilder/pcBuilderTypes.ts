import type {
  ComponentSpecification,
  ComponentType,
  CpuSocket,
  RamType,
  MotherboardFormFactor,
  RamFormFactor,
  StorageType,
  StorageInterface,
  PsuEfficiency,
  PsuModularity,
  PsuFormFactor,
  CoolerType,
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
 * Thông tin tối thiểu của linh kiện được chọn trong cấu hình phía Client.
 * Tương thích với cả ProductSummary từ catalog picker lẫn PCBuildPreviewItem từ preview API.
 */
export interface PCBuilderProductItem {
  id: string
  name: string
  slug: string
  sku: string
  imageUrl: string
  componentType: ComponentType
  price: number
  stockQuantity: number
  isActive: boolean
  brand?: string
  categoryId?: string
  categoryName?: string
  originalPrice?: number | null
  createdAt?: string
  canPurchase?: boolean
  issueCode?: string | null
  specifications?: ComponentSpecification | null
}

/**
 * State linh kiện đã chọn ở phía Client
 */
export interface SelectedPCBuildItem {
  product: PCBuilderProductItem
  quantity: number
}

/**
 * State của 15 bộ lọc kỹ thuật cho PC Builder modal
 */
export interface PCBuilderTechnicalFilterState {
  socket?: CpuSocket
  memoryType?: RamType
  motherboardFormFactor?: MotherboardFormFactor
  ramFormFactor?: RamFormFactor
  storageType?: StorageType
  storageInterface?: StorageInterface
  psuEfficiency?: PsuEfficiency
  psuModularity?: PsuModularity
  psuFormFactor?: PsuFormFactor
  coolerType?: CoolerType
  hasIntegratedGpu?: boolean
  hasWifi?: boolean
  hasRgb?: boolean
  has12VHPWR?: boolean
  requires12VHPWR?: boolean
}

export const EMPTY_TECHNICAL_FILTERS: Readonly<PCBuilderTechnicalFilterState> = Object.freeze({})

/**
 * Trạng thái cấu hình PC theo Backend PCBuildStatus
 */
export enum PCBuildStatus {
  Draft = 1,
  Saved = 2,
  Ordered = 3,
}

/**
 * Request payload gửi lên POST /api/v1/pc-builds để lưu cấu hình
 */
export interface CreatePCBuildRequest {
  name: string
  description?: string | null
  items: PCBuildItemInput[]
}

/**
 * Chi tiết một linh kiện trong cấu hình đã lưu (MyPCBuildItemDto)
 */
export interface MyPCBuildItem {
  id: string
  productId: string
  productName: string
  productSlug: string
  productSku: string
  productImageUrl: string
  componentType: ComponentType
  quantity: number
  unitPrice: number
  lineTotal: number
  currentPrice: number
  stockQuantity: number
  isActive: boolean
  canPurchase: boolean
  specifications: ComponentSpecification | null
}

/**
 * DTO cấu hình đã lưu do Backend trả về (MyPCBuildDto)
 */
export interface MyPCBuild {
  id: string
  name: string
  description: string | null
  totalPrice: number
  estimatedWattage: number
  recommendedPsuWattage: number
  isCompatible: boolean
  isCompleteSystem: boolean
  missingComponents: string[]
  issues: CompatibilityIssue[]
  canPurchaseAll: boolean
  status: PCBuildStatus
  items: MyPCBuildItem[]
  createdAt: string
  updatedAt: string | null
}
