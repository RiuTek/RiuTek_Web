/**
 * ComponentType enum chuẩn số từ Backend RiuTek (1..9)
 */
export enum ComponentType {
  CPU = 1,
  Motherboard = 2,
  GPU = 3,
  RAM = 4,
  Storage = 5,
  PSU = 6,
  Case = 7,
  Cooler = 8,
  Accessory = 9,
}

/**
 * ProductSortOption enum chuẩn số từ Backend RiuTek (1..5)
 */
export enum ProductSortOption {
  Newest = 1,
  PriceLowToHigh = 2,
  PriceHighToLow = 3,
  NameAToZ = 4,
  NameZToA = 5,
}

/**
 * DTO tóm tắt sản phẩm trong danh sách ProductList
 */
export interface ProductSummary {
  id: string
  categoryId: string
  categoryName: string
  name: string
  slug: string
  sku: string
  brand: string
  price: number
  originalPrice: number | null
  stockQuantity: number
  isActive: boolean
  imageUrl: string
  componentType: ComponentType
  createdAt: string
}

/**
 * DTO danh mục phân cấp từ Backend
 */
export interface Category {
  id: string
  name: string
  slug: string
  componentType: ComponentType
  description: string | null
  parentId: string | null
  subCategories: Category[]
}

/**
 * Tham số lọc và phân trang gửi lên Backend
 */
export interface ProductFilterParams {
  pageIndex?: number
  pageSize?: number
  searchTerm?: string
  categoryId?: string
  componentType?: ComponentType
  brand?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  isActive?: boolean
  sortBy?: ProductSortOption
}

/**
 * Các numeric enum cho linh kiện phần cứng theo backend contract
 */
export enum CpuSocket {
  LGA1700 = 1,
  LGA1851 = 2,
  LGA1200 = 3,
  AM4 = 4,
  AM5 = 5,
  TR4 = 6,
  sTRX4 = 7,
  Other = 99,
}

export enum RamType {
  DDR4 = 1,
  DDR5 = 2,
  DDR3 = 3,
  LPDDR5 = 4,
}

export enum RamFormFactor {
  DIMM = 1,
  SODIMM = 2,
}

export enum MotherboardFormFactor {
  ATX = 1,
  MicroATX = 2,
  MiniITX = 3,
  EATX = 4,
}

export enum StorageType {
  NVMeM2 = 1,
  SataSSD = 2,
  Hdd35 = 3,
  Hdd25 = 4,
}

export enum StorageInterface {
  PCIe30 = 1,
  PCIe40 = 2,
  PCIe50 = 3,
  SATA3 = 4,
}

export enum PsuEfficiency {
  Plus80 = 1,
  Plus80Bronze = 2,
  Plus80Silver = 3,
  Plus80Gold = 4,
  Plus80Platinum = 5,
  Plus80Titanium = 6,
}

export enum PsuModularity {
  NonModular = 1,
  SemiModular = 2,
  FullModular = 3,
}

export enum PsuFormFactor {
  ATX = 1,
  SFX = 2,
  SFXL = 3,
  TFX = 4,
}

export enum CoolerType {
  Air = 1,
  AIO120 = 2,
  AIO240 = 3,
  AIO280 = 4,
  AIO360 = 5,
  AIO420 = 6,
  CustomLoop = 7,
}

/**
 * 9 Subtypes specification theo $type discriminator
 */
export interface CpuSpecification {
  $type: 'cpu'
  componentType: 1
  socket: CpuSocket
  coreCount: number
  threadCount: number
  baseClockGhz: number
  boostClockGhz: number
  tdpWattage: number
  hasIntegratedGpu: boolean
  supportedMemoryType: RamType
  maxMemorySpeedMhz: number
}

export interface MotherboardSpecification {
  $type: 'motherboard'
  componentType: 2
  socket: CpuSocket
  chipset: string
  formFactor: MotherboardFormFactor
  memoryType: RamType
  memorySlots: number
  maxMemoryCapacityGb: number
  m2Slots: number
  sataPorts: number
  pcieSlots: number
  hasWifi: boolean
}

export interface GpuSpecification {
  $type: 'gpu'
  componentType: 3
  chipset: string
  vramGb: number
  vramType: string
  lengthMm: number
  slotWidth: number
  tdpWattage: number
  recommendedPsuWattage: number
  requires12VHPWR: boolean
  powerConnectors: string
}

export interface RamSpecification {
  $type: 'ram'
  componentType: 4
  memoryType: RamType
  formFactor: RamFormFactor
  capacityGb: number
  moduleCount: number
  speedMhz: number
  casLatency: number
  hasRgb: boolean
}

export interface StorageSpecification {
  $type: 'storage'
  componentType: 5
  storageType: StorageType
  interface: StorageInterface
  capacityGb: number
  readSpeedMBs: number
  writeSpeedMBs: number
  formFactor: string
}

export interface PsuSpecification {
  $type: 'psu'
  componentType: 6
  wattage: number
  efficiency: PsuEfficiency
  modularity: PsuModularity
  formFactor: PsuFormFactor
  has12VHPWR: boolean
  lengthMm: number
}

export interface CaseSpecification {
  $type: 'case'
  componentType: 7
  supportedFormFactors: MotherboardFormFactor[]
  maxGpuLengthMm: number
  maxCpuCoolerHeightMm: number
  maxPsuLengthMm: number
  supportedRadiatorSizesMm: number[]
  includedFans: number
}

export interface CoolerSpecification {
  $type: 'cooler'
  componentType: 8
  coolerType: CoolerType
  supportedSockets: CpuSocket[]
  heightMm: number
  radiatorSizeMm: number
  maxTdpRating: number
  hasRgb: boolean
}

export interface AccessorySpecification {
  $type: 'accessory'
  componentType: 9
  details: string
}

/**
 * Discriminated union của toàn bộ 9 specification subtypes
 */
export type ComponentSpecification =
  | CpuSpecification
  | MotherboardSpecification
  | GpuSpecification
  | RamSpecification
  | StorageSpecification
  | PsuSpecification
  | CaseSpecification
  | CoolerSpecification
  | AccessorySpecification

/**
 * DTO chi tiết sản phẩm từ Backend RiuTek
 */
export interface ProductDetail {
  id: string
  categoryId: string
  categoryName: string
  name: string
  slug: string
  sku: string
  brand: string
  price: number
  originalPrice: number | null
  stockQuantity: number
  isActive: boolean
  imageUrl: string
  additionalImages: string[]
  componentType: ComponentType
  specifications: ComponentSpecification
  createdAt: string
}
