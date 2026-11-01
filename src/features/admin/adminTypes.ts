import type {
  Category,
  ComponentSpecification,
  ComponentType,
  ProductDetail,
  ProductSortOption,
} from '../products/productTypes'

export type StockMovementReason =
  | 'ProductCreated'
  | 'BulkImport'
  | 'ManualAdjustment'
  | 'Checkout'
  | 'OrderCancellation'
  | 'PaymentExpiration'

export interface CreateCategoryRequest {
  name: string
  componentType: ComponentType
  description: string | null
  parentId: string | null
}

export interface UpdateCategoryRequest {
  name: string
  componentType: ComponentType
  description: string | null
  parentId: string | null
}

export interface CategoryDraft {
  name: string
  componentType: ComponentType | ''
  description: string
  parentId: string
}

export interface FlattenedCategoryNode {
  id: string
  name: string
  slug: string
  componentType: ComponentType
  description: string | null
  parentId: string | null
  parentName: string | null
  depth: number
  pathNames: string[]
  subCategoryCount: number
  descendantIds: Set<string>
  raw: Category
}

export interface CreateProductRequest {
  categoryId: string
  name: string
  sku: string
  brand: string
  price: number
  originalPrice: number | null
  stockQuantity: number
  imageUrl: string
  additionalImages: string[]
  componentType: ComponentType
  specifications: ComponentSpecification
}

export interface UpdateProductRequest {
  categoryId: string
  name: string
  sku: string
  brand: string
  price: number
  originalPrice: number | null
  isActive: boolean
  imageUrl: string
  additionalImages: string[]
  componentType: ComponentType
  specifications: ComponentSpecification
}

export interface AdjustStockRequest {
  expectedStockQuantity: number
  quantityDelta: number
  note: string
}

export interface StockAdjustmentResultDto {
  productId: string
  sku: string
  stockBefore: number
  quantityDelta: number
  stockAfter: number
  movementId: string
  reason: StockMovementReason
  note: string | null
  createdAt: string
}

export interface StockMovementDto {
  id: string
  productId: string
  sku: string
  quantityDelta: number
  stockBefore: number
  stockAfter: number
  reason: StockMovementReason
  note: string | null
  actorUserId: string | null
  actorUserName: string | null
  orderId: string | null
  createdAt: string
}

export interface StockMovementsQueryParams {
  pageIndex?: number
  pageSize?: number
  reason?: StockMovementReason
}

export interface AdminProductListFilters {
  pageIndex: number
  pageSize: number
  searchTerm: string
  categoryId: string
  componentType: ComponentType | ''
  isActive: 'all' | 'active' | 'inactive'
  inStock: 'all' | 'in_stock' | 'out_of_stock'
  sortBy: ProductSortOption
}

export interface CpuSpecDraft {
  socket: string
  coreCount: string
  threadCount: string
  baseClockGhz: string
  boostClockGhz: string
  tdpWattage: string
  hasIntegratedGpu: boolean
  supportedMemoryType: string
  maxMemorySpeedMhz: string
}

export interface MotherboardSpecDraft {
  socket: string
  chipset: string
  formFactor: string
  memoryType: string
  memorySlots: string
  maxMemoryCapacityGb: string
  m2Slots: string
  sataPorts: string
  pcieSlots: string
  hasWifi: boolean
}

export interface GpuSpecDraft {
  chipset: string
  vramGb: string
  vramType: string
  lengthMm: string
  slotWidth: string
  tdpWattage: string
  recommendedPsuWattage: string
  requires12VHPWR: boolean
  powerConnectors: string
}

export interface RamSpecDraft {
  memoryType: string
  formFactor: string
  capacityGb: string
  moduleCount: string
  speedMhz: string
  casLatency: string
  hasRgb: boolean
}

export interface StorageSpecDraft {
  storageType: string
  interface: string
  capacityGb: string
  readSpeedMBs: string
  writeSpeedMBs: string
  formFactor: string
}

export interface PsuSpecDraft {
  wattage: string
  efficiency: string
  modularity: string
  formFactor: string
  has12VHPWR: boolean
  lengthMm: string
}

export interface CaseSpecDraft {
  supportedFormFactors: number[]
  maxGpuLengthMm: string
  maxCpuCoolerHeightMm: string
  maxPsuLengthMm: string
  supportedRadiatorSizesMm: string
  includedFans: string
}

export interface CoolerSpecDraft {
  coolerType: string
  supportedSockets: number[]
  heightMm: string
  radiatorSizeMm: string
  maxTdpRating: string
  hasRgb: boolean
}

export interface AccessorySpecDraft {
  details: string
}

export interface SpecificationDraftMap {
  cpu: CpuSpecDraft
  motherboard: MotherboardSpecDraft
  gpu: GpuSpecDraft
  ram: RamSpecDraft
  storage: StorageSpecDraft
  psu: PsuSpecDraft
  case: CaseSpecDraft
  cooler: CoolerSpecDraft
  accessory: AccessorySpecDraft
}

export type AnySpecificationDraft = SpecificationDraftMap[keyof SpecificationDraftMap]

export interface ProductFormDraft {
  name: string
  sku: string
  brand: string
  categoryId: string
  componentType: ComponentType
  price: string
  originalPrice: string
  stockQuantity: string
  isActive: boolean
  imageUrl: string
  additionalImages: string[]
  specDraft: AnySpecificationDraft
}

export type AdminProductFormMode = 'create' | 'edit'

export type { ProductDetail }
