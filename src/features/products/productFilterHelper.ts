import {
  ComponentType,
  CpuSocket,
  RamType,
  RamFormFactor,
  MotherboardFormFactor,
  StorageType,
  StorageInterface,
  PsuEfficiency,
  PsuModularity,
  PsuFormFactor,
  CoolerType,
  type Category,
  type ProductFilterParams,
  type ProductFilterOptionsResponse,
} from './productTypes'
import {
  CPU_SOCKET_LABELS,
  RAM_TYPE_LABELS,
  RAM_FORM_FACTOR_LABELS,
  MOTHERBOARD_FORM_FACTOR_LABELS,
  STORAGE_TYPE_LABELS,
  STORAGE_INTERFACE_LABELS,
  PSU_EFFICIENCY_LABELS,
  PSU_MODULARITY_LABELS,
  PSU_FORM_FACTOR_LABELS,
  COOLER_TYPE_LABELS,
} from './productConstants'
import { getProductFilterOptions, type GetProductFilterOptionsParams } from './productApi'
import { ApiError } from '../../lib/api'

export const MAX_FILTER_VALUES_PER_GROUP = 20
export const MAX_INT32 = 2147483647

/**
 * 10 Technical array keys có phiên bản legacy scalar tương ứng
 */
export const PLURAL_TO_SCALAR_KEY: Record<string, string> = {
  brands: 'brand',
  sockets: 'socket',
  memoryTypes: 'memoryType',
  motherboardFormFactors: 'motherboardFormFactor',
  ramFormFactors: 'ramFormFactor',
  storageTypes: 'storageType',
  storageInterfaces: 'storageInterface',
  psuEfficiencies: 'psuEfficiency',
  psuModularities: 'psuModularity',
  psuFormFactors: 'psuFormFactor',
  coolerTypes: 'coolerType',
}

export const SCALAR_TO_PLURAL_KEY: Record<string, string> = {
  brand: 'brands',
  socket: 'sockets',
  memoryType: 'memoryTypes',
  motherboardFormFactor: 'motherboardFormFactors',
  ramFormFactor: 'ramFormFactors',
  storageType: 'storageTypes',
  storageInterface: 'storageInterfaces',
  psuEfficiency: 'psuEfficiencies',
  psuModularity: 'psuModularities',
  psuFormFactor: 'psuFormFactors',
  coolerType: 'coolerTypes',
}

/**
 * 7 Numeric technical array keys
 */
export const NUMERIC_TECHNICAL_KEYS = [
  'coreCounts',
  'vramGbs',
  'gpuLengthsMm',
  'ramCapacitiesGb',
  'ramSpeedsMhz',
  'storageCapacitiesGb',
  'psuWattages',
] as const

/**
 * 5 Boolean filter keys
 */
export const BOOLEAN_FILTER_KEYS = [
  'hasIntegratedGpu',
  'hasWifi',
  'hasRgb',
  'has12VHPWR',
  'requires12VHPWR',
] as const

/**
 * Ma trận các nhóm bộ lọc kỹ thuật được áp dụng cho từng ComponentType
 */
export const TECHNICAL_GROUPS_BY_TYPE: Record<ComponentType, string[]> = {
  [ComponentType.CPU]: ['sockets', 'coreCounts', 'memoryTypes', 'hasIntegratedGpu'],
  [ComponentType.Motherboard]: ['sockets', 'memoryTypes', 'motherboardFormFactors', 'hasWifi'],
  [ComponentType.GPU]: ['vramGbs', 'gpuLengthsMm', 'requires12VHPWR'],
  [ComponentType.RAM]: ['memoryTypes', 'ramFormFactors', 'ramCapacitiesGb', 'ramSpeedsMhz', 'hasRgb'],
  [ComponentType.Storage]: ['storageTypes', 'storageInterfaces', 'storageCapacitiesGb'],
  [ComponentType.PSU]: ['psuWattages', 'psuEfficiencies', 'psuModularities', 'psuFormFactors', 'has12VHPWR'],
  [ComponentType.Case]: ['motherboardFormFactors'],
  [ComponentType.Cooler]: ['sockets', 'coolerTypes', 'hasRgb'],
  [ComponentType.Accessory]: [],
}

/**
 * Preset khoảng giá phục vụ chọn nhanh (single-choice)
 */
export interface PricePreset {
  id: string
  label: string
  minPrice?: number
  maxPrice?: number
}

export const PRICE_PRESETS: PricePreset[] = [
  { id: 'under-2m', label: 'Dưới 2 triệu', maxPrice: 2000000 },
  { id: '2m-5m', label: '2 - 5 triệu', minPrice: 2000000, maxPrice: 5000000 },
  { id: '5m-10m', label: '5 - 10 triệu', minPrice: 5000000, maxPrice: 10000000 },
  { id: '10m-20m', label: '10 - 20 triệu', minPrice: 10000000, maxPrice: 20000000 },
  { id: 'over-20m', label: 'Trên 20 triệu', minPrice: 20000000 },
]

/**
 * Tiêu đề tiếng Việt hiển thị cho từng nhóm bộ lọc
 */
export function getGroupTitle(key: string, componentType?: ComponentType): string {
  switch (key) {
    case 'brands':
      return 'Thương hiệu'
    case 'sockets':
      if (componentType === ComponentType.Cooler) return 'Socket hỗ trợ'
      return 'Socket'
    case 'coreCounts':
      return 'Số nhân CPU'
    case 'memoryTypes':
      if (componentType === ComponentType.Motherboard) return 'Loại RAM hỗ trợ'
      return 'Loại bộ nhớ (RAM)'
    case 'motherboardFormFactors':
      if (componentType === ComponentType.Case) return 'Kích thước main hỗ trợ'
      return 'Kích thước Mainboard'
    case 'ramFormFactors':
      return 'Chuẩn chân RAM'
    case 'ramCapacitiesGb':
      return 'Dung lượng RAM'
    case 'ramSpeedsMhz':
      return 'Tốc độ Bus RAM'
    case 'vramGbs':
      return 'Dung lượng VRAM'
    case 'gpuLengthsMm':
      return 'Chiều dài Card đồ họa'
    case 'storageTypes':
      return 'Loại ổ cứng'
    case 'storageInterfaces':
      return 'Chuẩn giao tiếp ổ cứng'
    case 'storageCapacitiesGb':
      return 'Dung lượng ổ cứng'
    case 'psuWattages':
      return 'Công suất nguồn'
    case 'psuEfficiencies':
      return 'Hiệu suất nguồn (80 Plus)'
    case 'psuModularities':
      return 'Kiểu dây nguồn'
    case 'psuFormFactors':
      return 'Kích thước nguồn'
    case 'coolerTypes':
      return 'Loại tản nhiệt'
    case 'hasIntegratedGpu':
      return 'Đồ họa tích hợp (iGPU)'
    case 'hasWifi':
      return 'Tích hợp Wi-Fi'
    case 'hasRgb':
      return 'Đèn LED RGB'
    case 'has12VHPWR':
      return 'Cổng nguồn 12VHPWR'
    case 'requires12VHPWR':
      return 'Yêu cầu cổng 12VHPWR'
    default:
      return key
  }
}

/**
 * Định dạng nhãn hiển thị cho từng lựa chọn (enum, numeric, string brand)
 */
export function formatChoiceLabel(key: string, value: string | number): string {
  if (typeof value === 'string') {
    return value
  }

  const num = value
  switch (key) {
    case 'sockets':
      return CPU_SOCKET_LABELS[num as CpuSocket] ?? `Socket #${num}`
    case 'memoryTypes':
      return RAM_TYPE_LABELS[num as RamType] ?? `RAM #${num}`
    case 'motherboardFormFactors':
      return MOTHERBOARD_FORM_FACTOR_LABELS[num as MotherboardFormFactor] ?? `Form Factor #${num}`
    case 'ramFormFactors':
      return RAM_FORM_FACTOR_LABELS[num as RamFormFactor] ?? `Form Factor #${num}`
    case 'storageTypes':
      return STORAGE_TYPE_LABELS[num as StorageType] ?? `Type #${num}`
    case 'storageInterfaces':
      return STORAGE_INTERFACE_LABELS[num as StorageInterface] ?? `Interface #${num}`
    case 'psuEfficiencies':
      return PSU_EFFICIENCY_LABELS[num as PsuEfficiency] ?? `80 Plus #${num}`
    case 'psuModularities':
      return PSU_MODULARITY_LABELS[num as PsuModularity] ?? `Modularity #${num}`
    case 'psuFormFactors':
      return PSU_FORM_FACTOR_LABELS[num as PsuFormFactor] ?? `Form Factor #${num}`
    case 'coolerTypes':
      return COOLER_TYPE_LABELS[num as CoolerType] ?? `Cooler #${num}`
    case 'coreCounts':
      return `${num} nhân`
    case 'vramGbs':
      return `${num} GB`
    case 'gpuLengthsMm':
      return `${num} mm`
    case 'ramCapacitiesGb':
      return `${num} GB`
    case 'ramSpeedsMhz':
      return `${num} MHz`
    case 'storageCapacitiesGb':
      if (num >= 1000 && num % 1000 === 0) {
        return `${num / 1000} TB`
      }
      return `${num} GB`
    case 'psuWattages':
      return `${num} W`
    default:
      return String(num)
  }
}

const STRICT_INT_REGEX = /^\d+$/
const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/**
 * Parse strictly positive int32 <= 2147483647
 */
export function parseStrictPositiveInt32(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!STRICT_INT_REGEX.test(trimmed)) return undefined
  const num = Number(trimmed)
  if (!Number.isSafeInteger(num) || num <= 0 || num > MAX_INT32) return undefined
  return num
}

/**
 * Kiểm tra xem một enum value có hợp lệ trong enum tương ứng hay không
 */
export function isValidEnumValue(key: string, value: number): boolean {
  switch (key) {
    case 'sockets':
      return Object.values(CpuSocket).includes(value as CpuSocket)
    case 'memoryTypes':
      return Object.values(RamType).includes(value as RamType)
    case 'motherboardFormFactors':
      return Object.values(MotherboardFormFactor).includes(value as MotherboardFormFactor)
    case 'ramFormFactors':
      return Object.values(RamFormFactor).includes(value as RamFormFactor)
    case 'storageTypes':
      return Object.values(StorageType).includes(value as StorageType)
    case 'storageInterfaces':
      return Object.values(StorageInterface).includes(value as StorageInterface)
    case 'psuEfficiencies':
      return Object.values(PsuEfficiency).includes(value as PsuEfficiency)
    case 'psuModularities':
      return Object.values(PsuModularity).includes(value as PsuModularity)
    case 'psuFormFactors':
      return Object.values(PsuFormFactor).includes(value as PsuFormFactor)
    case 'coolerTypes':
      return Object.values(CoolerType).includes(value as CoolerType)
    default:
      return true
  }
}

/**
 * Trích xuất danh sách giá trị mảng từ searchParams, hỗ trợ cả repeated plural keys lẫn legacy scalar
 */
export function parseArrayFilterValues(
  searchParams: URLSearchParams,
  pluralKey: string,
  isNumeric: boolean
): { values: (string | number)[]; hasOverflow: boolean } {
  const scalarKey = PLURAL_TO_SCALAR_KEY[pluralKey]
  const rawPlural = searchParams.getAll(pluralKey)
  const rawScalar = scalarKey ? searchParams.get(scalarKey) : null

  const rawCombined: string[] = [...rawPlural]
  if (rawScalar !== null && rawScalar !== undefined && rawScalar.trim() !== '') {
    rawCombined.push(rawScalar)
  }

  if (rawCombined.length > MAX_FILTER_VALUES_PER_GROUP) {
    return { values: [], hasOverflow: true }
  }

  const seen = new Set<string>()
  const parsedValues: (string | number)[] = []

  for (const raw of rawCombined) {
    const trimmed = raw.trim()
    if (!trimmed) continue

    if (isNumeric) {
      const num = parseStrictPositiveInt32(trimmed)
      if (num === undefined) continue
      if (!isValidEnumValue(pluralKey, num)) continue

      const keyString = String(num)
      if (!seen.has(keyString)) {
        seen.add(keyString)
        parsedValues.push(num)
      }
    } else {
      // String (e.g. brands)
      const lower = trimmed.toLowerCase()
      if (!seen.has(lower)) {
        seen.add(lower)
        parsedValues.push(trimmed)
      }
    }
  }

  if (parsedValues.length > MAX_FILTER_VALUES_PER_GROUP) {
    return { values: [], hasOverflow: true }
  }

  return { values: parsedValues, hasOverflow: false }
}

export interface ParsedProductCatalogFilters extends ProductFilterParams {
  pageIndex: number
  pageSize: number
  searchTerm: string
  categoryId: string
  brands: string[]
  sockets: CpuSocket[]
  memoryTypes: RamType[]
  motherboardFormFactors: MotherboardFormFactor[]
  ramFormFactors: RamFormFactor[]
  storageTypes: StorageType[]
  storageInterfaces: StorageInterface[]
  psuEfficiencies: PsuEfficiency[]
  psuModularities: PsuModularity[]
  psuFormFactors: PsuFormFactor[]
  coolerTypes: CoolerType[]
  coreCounts: number[]
  vramGbs: number[]
  gpuLengthsMm: number[]
  ramCapacitiesGb: number[]
  ramSpeedsMhz: number[]
  storageCapacitiesGb: number[]
  psuWattages: number[]
}

export interface ParseFiltersResult {
  filters: ParsedProductCatalogFilters
  priceError: string | null
  overflowError: string | null
  invalidCategoryError: string | null
}

/**
 * Phân tích toàn bộ query parameters từ URL thành đối tượng ParsedProductCatalogFilters
 */
export function parseFiltersFromUrl(searchParams: URLSearchParams): ParseFiltersResult {
  let overflowError: string | null = null
  let invalidCategoryError: string | null = null

  // Phân trang
  const rawPage = parseStrictPositiveInt32(searchParams.get('pageIndex'))
  const pageIndex = rawPage && rawPage >= 1 ? rawPage : 1

  const rawPageSize = parseStrictPositiveInt32(searchParams.get('pageSize'))
  const pageSize = rawPageSize && rawPageSize >= 1 && rawPageSize <= 50 ? rawPageSize : 20

  // Sắp xếp
  const rawSort = parseStrictPositiveInt32(searchParams.get('sortBy'))
  const sortBy = rawSort && rawSort >= 1 && rawSort <= 5 ? rawSort : 1

  // ComponentType & Category
  const rawComponentType = parseStrictPositiveInt32(searchParams.get('componentType'))
  const componentType =
    rawComponentType && rawComponentType >= 1 && rawComponentType <= 9
      ? (rawComponentType as ComponentType)
      : undefined

  const rawCategoryId = (searchParams.get('categoryId') ?? '').trim()
  let categoryId = ''
  if (rawCategoryId.length > 0) {
    if (GUID_REGEX.test(rawCategoryId)) {
      categoryId = rawCategoryId
    } else {
      invalidCategoryError = 'Mã danh mục không hợp lệ (yêu cầu định dạng GUID chuẩn).'
    }
  }

  const searchTerm = (searchParams.get('searchTerm') ?? '').trim().slice(0, 100)

  // Giá
  const rawMin = searchParams.get('minPrice')
  const rawMax = searchParams.get('maxPrice')
  let minPrice: number | undefined
  let maxPrice: number | undefined

  if (rawMin && /^\d+(\.\d+)?$/.test(rawMin.trim())) {
    const val = Number(rawMin.trim())
    if (Number.isFinite(val) && val >= 0) minPrice = val
  }
  if (rawMax && /^\d+(\.\d+)?$/.test(rawMax.trim())) {
    const val = Number(rawMax.trim())
    if (Number.isFinite(val) && val >= 0) maxPrice = val
  }

  let priceError: string | null = null
  if (minPrice !== undefined && maxPrice !== undefined && maxPrice < minPrice) {
    priceError = 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.'
  }

  // Stock & Active
  let inStock: boolean | undefined
  const inStockRaw = searchParams.get('inStock')
  if (inStockRaw === 'true') inStock = true
  else if (inStockRaw === 'false') inStock = false

  let isActive: boolean | undefined
  const isActiveRaw = searchParams.get('isActive')
  if (isActiveRaw === 'true') isActive = true
  else if (isActiveRaw === 'false') isActive = false

  // Parse brands
  const brandsRes = parseArrayFilterValues(searchParams, 'brands', false)
  if (brandsRes.hasOverflow) {
    overflowError = 'Số lượng lựa chọn thương hiệu vượt quá giới hạn tối đa (20).'
  }

  // Parse 10 enum technical arrays
  const parseEnumList = <T extends number>(pluralKey: string): T[] => {
    const res = parseArrayFilterValues(searchParams, pluralKey, true)
    if (res.hasOverflow) {
      overflowError = `Số lượng lựa chọn cho nhóm ${getGroupTitle(pluralKey, componentType)} vượt quá giới hạn tối đa (20).`
    }
    return res.values as T[]
  }

  const sockets = parseEnumList<CpuSocket>('sockets')
  const memoryTypes = parseEnumList<RamType>('memoryTypes')
  const motherboardFormFactors = parseEnumList<MotherboardFormFactor>('motherboardFormFactors')
  const ramFormFactors = parseEnumList<RamFormFactor>('ramFormFactors')
  const storageTypes = parseEnumList<StorageType>('storageTypes')
  const storageInterfaces = parseEnumList<StorageInterface>('storageInterfaces')
  const psuEfficiencies = parseEnumList<PsuEfficiency>('psuEfficiencies')
  const psuModularities = parseEnumList<PsuModularity>('psuModularities')
  const psuFormFactors = parseEnumList<PsuFormFactor>('psuFormFactors')
  const coolerTypes = parseEnumList<CoolerType>('coolerTypes')

  // Parse 7 numeric lists
  const parseNumericList = (pluralKey: string): number[] => {
    const res = parseArrayFilterValues(searchParams, pluralKey, true)
    if (res.hasOverflow) {
      overflowError = `Số lượng lựa chọn cho nhóm ${getGroupTitle(pluralKey, componentType)} vượt quá giới hạn tối đa (20).`
    }
    return res.values as number[]
  }

  const coreCounts = parseNumericList('coreCounts')
  const vramGbs = parseNumericList('vramGbs')
  const gpuLengthsMm = parseNumericList('gpuLengthsMm')
  const ramCapacitiesGb = parseNumericList('ramCapacitiesGb')
  const ramSpeedsMhz = parseNumericList('ramSpeedsMhz')
  const storageCapacitiesGb = parseNumericList('storageCapacitiesGb')
  const psuWattages = parseNumericList('psuWattages')

  // Parse 5 booleans
  const parseBool = (key: string): boolean | undefined => {
    const val = searchParams.get(key)
    if (val === 'true') return true
    if (val === 'false') return false
    return undefined
  }

  const hasIntegratedGpu = parseBool('hasIntegratedGpu')
  const hasWifi = parseBool('hasWifi')
  const hasRgb = parseBool('hasRgb')
  const has12VHPWR = parseBool('has12VHPWR')
  const requires12VHPWR = parseBool('requires12VHPWR')

  return {
    filters: {
      pageIndex,
      pageSize,
      sortBy,
      componentType,
      categoryId,
      searchTerm,
      minPrice,
      maxPrice,
      inStock,
      isActive,
      brands: brandsRes.values as string[],
      sockets,
      memoryTypes,
      motherboardFormFactors,
      ramFormFactors,
      storageTypes,
      storageInterfaces,
      psuEfficiencies,
      psuModularities,
      psuFormFactors,
      coolerTypes,
      coreCounts,
      vramGbs,
      gpuLengthsMm,
      ramCapacitiesGb,
      ramSpeedsMhz,
      storageCapacitiesGb,
      psuWattages,
      hasIntegratedGpu,
      hasWifi,
      hasRgb,
      has12VHPWR,
      requires12VHPWR,
    },
    priceError,
    overflowError,
    invalidCategoryError,
  }
}

/**
 * Làm sạch các bộ lọc kỹ thuật không thuộc về ComponentType hiện tại
 */
export function filterApplicableTechnicalFilters<T extends ProductFilterParams>(
  filters: T,
  type?: ComponentType
): T {
  if (!type) {
    // Không có componentType -> loại bỏ toàn bộ technical filters
    const cleaned = { ...filters }
    delete cleaned.sockets
    delete cleaned.socket
    delete cleaned.memoryTypes
    delete cleaned.memoryType
    delete cleaned.motherboardFormFactors
    delete cleaned.motherboardFormFactor
    delete cleaned.ramFormFactors
    delete cleaned.ramFormFactor
    delete cleaned.storageTypes
    delete cleaned.storageType
    delete cleaned.storageInterfaces
    delete cleaned.storageInterface
    delete cleaned.psuEfficiencies
    delete cleaned.psuEfficiency
    delete cleaned.psuModularities
    delete cleaned.psuModularity
    delete cleaned.psuFormFactors
    delete cleaned.psuFormFactor
    delete cleaned.coolerTypes
    delete cleaned.coolerType
    delete cleaned.coreCounts
    delete cleaned.vramGbs
    delete cleaned.gpuLengthsMm
    delete cleaned.ramCapacitiesGb
    delete cleaned.ramSpeedsMhz
    delete cleaned.storageCapacitiesGb
    delete cleaned.psuWattages
    delete cleaned.hasIntegratedGpu
    delete cleaned.hasWifi
    delete cleaned.hasRgb
    delete cleaned.has12VHPWR
    delete cleaned.requires12VHPWR
    return cleaned
  }

  const applicableKeys = new Set(TECHNICAL_GROUPS_BY_TYPE[type] ?? [])
  const cleaned = { ...filters }

  // Danh sách toàn bộ technical keys
  const allTechnicalKeys = [
    'sockets',
    'socket',
    'memoryTypes',
    'memoryType',
    'motherboardFormFactors',
    'motherboardFormFactor',
    'ramFormFactors',
    'ramFormFactor',
    'storageTypes',
    'storageType',
    'storageInterfaces',
    'storageInterface',
    'psuEfficiencies',
    'psuEfficiency',
    'psuModularities',
    'psuModularity',
    'psuFormFactors',
    'psuFormFactor',
    'coolerTypes',
    'coolerType',
    'coreCounts',
    'vramGbs',
    'gpuLengthsMm',
    'ramCapacitiesGb',
    'ramSpeedsMhz',
    'storageCapacitiesGb',
    'psuWattages',
    'hasIntegratedGpu',
    'hasWifi',
    'hasRgb',
    'has12VHPWR',
    'requires12VHPWR',
  ] as const

  for (const k of allTechnicalKeys) {
    const pluralKey = SCALAR_TO_PLURAL_KEY[k] ?? k
    if (!applicableKeys.has(pluralKey)) {
      delete (cleaned as Record<string, unknown>)[k]
    }
  }

  return cleaned
}

/**
 * Tìm ComponentType từ Category ID trong cây danh mục
 */
export function inferComponentTypeFromCategory(
  categories: Category[],
  categoryId: string
): ComponentType | undefined {
  if (!categoryId) return undefined

  function search(cats: Category[]): ComponentType | undefined {
    for (const cat of cats) {
      if (cat.id === categoryId) {
        return cat.componentType
      }
      if (cat.subCategories && cat.subCategories.length > 0) {
        const found = search(cat.subCategories)
        if (found !== undefined) return found
      }
    }
    return undefined
  }

  return search(categories)
}

/**
 * Xây dựng URLSearchParams đầy đủ từ ProductFilterParams
 */
export function buildProductFilterSearchParams(
  filters: ProductFilterParams,
  cleanDefaults = true
): URLSearchParams {
  const searchParams = new URLSearchParams()

  if (filters.pageIndex && filters.pageIndex > 1) {
    searchParams.set('pageIndex', String(filters.pageIndex))
  }

  if (filters.pageSize && (!cleanDefaults || filters.pageSize !== 20)) {
    searchParams.set('pageSize', String(filters.pageSize))
  }

  if (filters.sortBy && (!cleanDefaults || filters.sortBy !== 1)) {
    searchParams.set('sortBy', String(filters.sortBy))
  }

  if (filters.componentType) {
    searchParams.set('componentType', String(filters.componentType))
  }

  if (filters.categoryId) {
    searchParams.set('categoryId', filters.categoryId)
  }

  if (filters.searchTerm && filters.searchTerm.trim()) {
    searchParams.set('searchTerm', filters.searchTerm.trim())
  }

  if (filters.minPrice !== undefined && filters.minPrice >= 0) {
    searchParams.set('minPrice', String(filters.minPrice))
  }

  if (filters.maxPrice !== undefined && filters.maxPrice >= 0) {
    searchParams.set('maxPrice', String(filters.maxPrice))
  }

  if (typeof filters.inStock === 'boolean') {
    searchParams.set('inStock', String(filters.inStock))
  }

  if (typeof filters.isActive === 'boolean') {
    searchParams.set('isActive', String(filters.isActive))
  }

  // Repeated plural array keys
  const appendArray = (key: string, items?: (string | number)[]) => {
    if (!items || items.length === 0) return
    if (items.length > MAX_FILTER_VALUES_PER_GROUP) {
      throw new Error(`Số lượng lựa chọn cho nhóm ${key} vượt quá giới hạn tối đa (${MAX_FILTER_VALUES_PER_GROUP}).`)
    }
    for (const item of items) {
      if (item !== undefined && item !== null && String(item).trim() !== '') {
        searchParams.append(key, String(item))
      }
    }
  }

  appendArray('brands', filters.brands)
  appendArray('sockets', filters.sockets)
  appendArray('memoryTypes', filters.memoryTypes)
  appendArray('motherboardFormFactors', filters.motherboardFormFactors)
  appendArray('ramFormFactors', filters.ramFormFactors)
  appendArray('storageTypes', filters.storageTypes)
  appendArray('storageInterfaces', filters.storageInterfaces)
  appendArray('psuEfficiencies', filters.psuEfficiencies)
  appendArray('psuModularities', filters.psuModularities)
  appendArray('psuFormFactors', filters.psuFormFactors)
  appendArray('coolerTypes', filters.coolerTypes)

  appendArray('coreCounts', filters.coreCounts)
  appendArray('vramGbs', filters.vramGbs)
  appendArray('gpuLengthsMm', filters.gpuLengthsMm)
  appendArray('ramCapacitiesGb', filters.ramCapacitiesGb)
  appendArray('ramSpeedsMhz', filters.ramSpeedsMhz)
  appendArray('storageCapacitiesGb', filters.storageCapacitiesGb)
  appendArray('psuWattages', filters.psuWattages)

  // Booleans
  if (typeof filters.hasIntegratedGpu === 'boolean') {
    searchParams.set('hasIntegratedGpu', String(filters.hasIntegratedGpu))
  }
  if (typeof filters.hasWifi === 'boolean') {
    searchParams.set('hasWifi', String(filters.hasWifi))
  }
  if (typeof filters.hasRgb === 'boolean') {
    searchParams.set('hasRgb', String(filters.hasRgb))
  }
  if (typeof filters.has12VHPWR === 'boolean') {
    searchParams.set('has12VHPWR', String(filters.has12VHPWR))
  }
  if (typeof filters.requires12VHPWR === 'boolean') {
    searchParams.set('requires12VHPWR', String(filters.requires12VHPWR))
  }

  return searchParams
}

/**
 * Sinh canonical query key xác định (deterministic) để so sánh cache hoặc dependency
 * Tự động sắp xếp mảng để thứ tự tick checkbox không tạo ra cache key khác nhau
 */
export function computeCanonicalQueryKey(filters: ParsedProductCatalogFilters): string {
  const sortArray = <T>(arr?: T[]): T[] => {
    if (!arr || arr.length === 0) return []
    return [...arr].sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') return a - b
      return String(a).localeCompare(String(b))
    })
  }

  const normalized = {
    pageIndex: filters.pageIndex,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    searchTerm: filters.searchTerm,
    categoryId: filters.categoryId,
    componentType: filters.componentType,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    inStock: filters.inStock,
    isActive: filters.isActive,
    brands: sortArray(filters.brands),
    sockets: sortArray(filters.sockets),
    memoryTypes: sortArray(filters.memoryTypes),
    motherboardFormFactors: sortArray(filters.motherboardFormFactors),
    ramFormFactors: sortArray(filters.ramFormFactors),
    storageTypes: sortArray(filters.storageTypes),
    storageInterfaces: sortArray(filters.storageInterfaces),
    psuEfficiencies: sortArray(filters.psuEfficiencies),
    psuModularities: sortArray(filters.psuModularities),
    psuFormFactors: sortArray(filters.psuFormFactors),
    coolerTypes: sortArray(filters.coolerTypes),
    coreCounts: sortArray(filters.coreCounts),
    vramGbs: sortArray(filters.vramGbs),
    gpuLengthsMm: sortArray(filters.gpuLengthsMm),
    ramCapacitiesGb: sortArray(filters.ramCapacitiesGb),
    ramSpeedsMhz: sortArray(filters.ramSpeedsMhz),
    storageCapacitiesGb: sortArray(filters.storageCapacitiesGb),
    psuWattages: sortArray(filters.psuWattages),
    hasIntegratedGpu: filters.hasIntegratedGpu,
    hasWifi: filters.hasWifi,
    hasRgb: filters.hasRgb,
    has12VHPWR: filters.has12VHPWR,
    requires12VHPWR: filters.requires12VHPWR,
  }

  return JSON.stringify(normalized)
}

/**
 * Coordinator quản lý nạp metadata bộ lọc theo 4 scope parameters
 * Có bộ nhớ đệm (in-memory cache) và sequence/scope guard chống stale response
 */
export class ProductFilterOptionsCoordinator {
  private inMemoryCache = new Map<string, ProductFilterOptionsResponse>()
  private activeAbortController: AbortController | null = null
  private currentScopeKey = ''
  private sequence = 0

  public getScopeKey(params: GetProductFilterOptionsParams): string {
    const t = params.componentType !== undefined ? String(params.componentType) : ''
    const c = params.categoryId && params.categoryId.trim() ? params.categoryId.trim() : ''
    const a = params.isActive === undefined ? '' : String(params.isActive)
    const s = params.inStock === undefined ? '' : String(params.inStock)
    return `${t}:${c}:${a}:${s}`
  }

  public getCached(scopeKey: string): ProductFilterOptionsResponse | undefined {
    return this.inMemoryCache.get(scopeKey)
  }

  public async loadOptions(
    params: GetProductFilterOptionsParams,
    onSuccess: (data: ProductFilterOptionsResponse) => void,
    onError: (err: Error) => void,
    onLoading: (isLoading: boolean) => void
  ): Promise<void> {
    const scopeKey = this.getScopeKey(params)
    this.currentScopeKey = scopeKey
    const currentSeq = ++this.sequence

    // Nếu đã có trong cache
    const cached = this.inMemoryCache.get(scopeKey)
    if (cached) {
      onSuccess(cached)
      onLoading(false)
      return
    }

    if (this.activeAbortController) {
      this.activeAbortController.abort()
    }

    const controller = new AbortController()
    this.activeAbortController = controller
    onLoading(true)

    try {
      const data = await getProductFilterOptions(params, controller.signal)
      if (this.sequence === currentSeq && this.currentScopeKey === scopeKey) {
        this.inMemoryCache.set(scopeKey, data)
        onSuccess(data)
        onLoading(false)
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isAbortError) {
        return
      }
      if (this.sequence === currentSeq && this.currentScopeKey === scopeKey) {
        onError(err instanceof Error ? err : new Error(String(err)))
        onLoading(false)
      }
    }
  }

  public abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort()
      this.activeAbortController = null
    }
  }

  public clearCache(scopeKey?: string): void {
    if (scopeKey) {
      this.inMemoryCache.delete(scopeKey)
    } else {
      this.inMemoryCache.clear()
    }
  }
}

/**
 * Kết quả của việc toggle một giá trị trong danh sách mảng bộ lọc
 */
export interface ToggleFilterChoiceResult {
  nextValues: (string | number)[]
  isAdded: boolean
  isRemoved: boolean
  isRejected: boolean
  warning: string | null
}

/**
 * Hàm thuần toggle một lựa chọn mảng với quy tắc tối đa 20 mục, case-insensitive cho chuỗi
 */
export function toggleArrayFilterChoice(
  currentValues: (string | number)[],
  value: string | number,
  maxAllowed = MAX_FILTER_VALUES_PER_GROUP
): ToggleFilterChoiceResult {
  const isNum = typeof value === 'number'
  const trimmedLower = isNum ? '' : String(value).trim().toLowerCase()

  const exists = currentValues.some((item) =>
    isNum ? item === value : String(item).trim().toLowerCase() === trimmedLower
  )

  if (exists) {
    const nextValues = currentValues.filter((item) =>
      isNum ? item !== value : String(item).trim().toLowerCase() !== trimmedLower
    )
    return {
      nextValues,
      isAdded: false,
      isRemoved: true,
      isRejected: false,
      warning: null,
    }
  }

  if (currentValues.length >= maxAllowed) {
    return {
      nextValues: currentValues,
      isAdded: false,
      isRemoved: false,
      isRejected: true,
      warning: `Mỗi nhóm chỉ được chọn tối đa ${maxAllowed} giá trị.`,
    }
  }

  const nextItem = isNum ? value : String(value).trim()
  return {
    nextValues: [...currentValues, nextItem],
    isAdded: true,
    isRemoved: false,
    isRejected: false,
    warning: null,
  }
}

/**
 * Chuẩn bị tham số truy vấn sản phẩm cho network call:
 * 1. Làm sạch các bộ lọc kỹ thuật không áp dụng cho componentType hiệu lực
 * 2. Gán componentType hiệu lực vào request params để backend nhận được componentType
 */
export function prepareProductQueryParams(
  filters: ProductFilterParams,
  effectiveComponentType?: ComponentType
): ProductFilterParams {
  const applicable = filterApplicableTechnicalFilters(filters, effectiveComponentType)
  return {
    ...applicable,
    componentType: effectiveComponentType,
  }
}

export interface PrepareCatalogFilterUpdateOptions {
  currentFilters: ParsedProductCatalogFilters
  newParams: Partial<ProductFilterParams>
  categories: Category[]
  resetPage?: boolean
}

/**
 * Chuẩn bị trạng thái cập nhật bộ lọc catalog an toàn:
 * - Chọn category mới thì tự động suy luận componentType hiệu lực
 * - Bỏ category thì xóa componentType sinh ra từ category đó
 * - Xóa sạch các bộ lọc kỹ thuật không áp dụng cho componentType mới (không bị Object.assign ép ngược lại)
 * - Đổi category/type thì reset pageIndex về 1
 */
export function prepareCatalogFilterUpdate({
  currentFilters,
  newParams,
  categories,
  resetPage = true,
}: PrepareCatalogFilterUpdateOptions): ProductFilterParams {
  const isCategoryExplicitlyGiven = 'categoryId' in newParams
  const nextCategoryId = isCategoryExplicitlyGiven
    ? (newParams.categoryId || undefined)
    : (currentFilters.categoryId || undefined)

  let nextComponentType: ComponentType | undefined

  if (nextCategoryId) {
    // Danh mục được chọn quyết định componentType
    nextComponentType = inferComponentTypeFromCategory(categories, nextCategoryId)
    if (nextComponentType === undefined && newParams.componentType !== undefined) {
      nextComponentType = newParams.componentType
    }
  } else {
    // Không có danh mục được chọn
    if ('componentType' in newParams) {
      nextComponentType = newParams.componentType || undefined
    } else if (isCategoryExplicitlyGiven && currentFilters.categoryId) {
      // Bỏ chọn danh mục: xóa componentType suy luận từ danh mục trước đó
      nextComponentType = undefined
    } else {
      nextComponentType = currentFilters.componentType || undefined
    }
  }

  const isChangingCategory = nextCategoryId !== (currentFilters.categoryId || undefined)
  const isChangingType = nextComponentType !== (currentFilters.componentType || undefined)
  const shouldResetPage = resetPage || isChangingCategory || isChangingType

  const result: ProductFilterParams = {}

  // 1. Phân trang & sắp xếp
  if ('pageIndex' in newParams) {
    if (newParams.pageIndex !== undefined) {
      result.pageIndex = shouldResetPage ? 1 : newParams.pageIndex
    }
  } else {
    result.pageIndex = shouldResetPage ? 1 : (currentFilters.pageIndex ?? 1)
  }

  if ('pageSize' in newParams) {
    if (newParams.pageSize !== undefined) result.pageSize = newParams.pageSize
  } else if (currentFilters.pageSize !== undefined) {
    result.pageSize = currentFilters.pageSize
  }

  if ('sortBy' in newParams) {
    if (newParams.sortBy !== undefined) result.sortBy = newParams.sortBy
  } else if (currentFilters.sortBy !== undefined) {
    result.sortBy = currentFilters.sortBy
  }

  // 2. Category & ComponentType
  if (nextCategoryId) {
    result.categoryId = nextCategoryId
  }
  if (nextComponentType) {
    result.componentType = nextComponentType
  }

  // 3. Search term (undefined hoặc rỗng -> xóa)
  if ('searchTerm' in newParams) {
    if (newParams.searchTerm !== undefined && newParams.searchTerm.trim() !== '') {
      result.searchTerm = newParams.searchTerm.trim()
    }
  } else if (currentFilters.searchTerm && currentFilters.searchTerm.trim() !== '') {
    result.searchTerm = currentFilters.searchTerm.trim()
  }

  // 4. Giá tối thiểu (0 là giá trị hợp lệ, undefined -> xóa)
  if ('minPrice' in newParams) {
    if (
      newParams.minPrice !== undefined &&
      Number.isFinite(newParams.minPrice) &&
      newParams.minPrice >= 0
    ) {
      result.minPrice = newParams.minPrice
    }
  } else if (
    currentFilters.minPrice !== undefined &&
    Number.isFinite(currentFilters.minPrice) &&
    currentFilters.minPrice >= 0
  ) {
    result.minPrice = currentFilters.minPrice
  }

  // 5. Giá tối đa (0 là giá trị hợp lệ, undefined -> xóa)
  if ('maxPrice' in newParams) {
    if (
      newParams.maxPrice !== undefined &&
      Number.isFinite(newParams.maxPrice) &&
      newParams.maxPrice >= 0
    ) {
      result.maxPrice = newParams.maxPrice
    }
  } else if (
    currentFilters.maxPrice !== undefined &&
    Number.isFinite(currentFilters.maxPrice) &&
    currentFilters.maxPrice >= 0
  ) {
    result.maxPrice = currentFilters.maxPrice
  }

  // 6. inStock (boolean false là hợp lệ, undefined -> xóa)
  if ('inStock' in newParams) {
    if (typeof newParams.inStock === 'boolean') {
      result.inStock = newParams.inStock
    }
  } else if (typeof currentFilters.inStock === 'boolean') {
    result.inStock = currentFilters.inStock
  }

  // 7. isActive (boolean false là hợp lệ, undefined -> xóa)
  if ('isActive' in newParams) {
    if (typeof newParams.isActive === 'boolean') {
      result.isActive = newParams.isActive
    }
  } else if (typeof currentFilters.isActive === 'boolean') {
    result.isActive = currentFilters.isActive
  }

  // 8. Brands (mảng rỗng hoặc undefined -> xóa)
  if ('brands' in newParams) {
    if (Array.isArray(newParams.brands) && newParams.brands.length > 0) {
      result.brands = newParams.brands
    }
  } else if (Array.isArray(currentFilters.brands) && currentFilters.brands.length > 0) {
    result.brands = currentFilters.brands
  }

  // 9. Technical filters (chỉ áp dụng cho nextComponentType)
  if (nextComponentType) {
    const applicableGroups = new Set(TECHNICAL_GROUPS_BY_TYPE[nextComponentType] ?? [])

    const techArrayKeys = [
      'sockets',
      'memoryTypes',
      'motherboardFormFactors',
      'ramFormFactors',
      'storageTypes',
      'storageInterfaces',
      'psuEfficiencies',
      'psuModularities',
      'psuFormFactors',
      'coolerTypes',
      'coreCounts',
      'vramGbs',
      'gpuLengthsMm',
      'ramCapacitiesGb',
      'ramSpeedsMhz',
      'storageCapacitiesGb',
      'psuWattages',
    ] as const

    for (const key of techArrayKeys) {
      if (applicableGroups.has(key)) {
        if (key in newParams) {
          const val = (newParams as Record<string, unknown>)[key]
          if (Array.isArray(val) && val.length > 0) {
            ;(result as Record<string, unknown>)[key] = val
          }
        } else {
          const val = (currentFilters as unknown as Record<string, unknown>)[key]
          if (Array.isArray(val) && val.length > 0) {
            ;(result as Record<string, unknown>)[key] = val
          }
        }
      }
    }

    const techBoolKeys = [
      'hasIntegratedGpu',
      'hasWifi',
      'hasRgb',
      'has12VHPWR',
      'requires12VHPWR',
    ] as const

    for (const key of techBoolKeys) {
      if (applicableGroups.has(key)) {
        if (key in newParams) {
          const val = (newParams as Record<string, unknown>)[key]
          if (typeof val === 'boolean') {
            ;(result as Record<string, unknown>)[key] = val
          }
        } else {
          const val = (currentFilters as unknown as Record<string, unknown>)[key]
          if (typeof val === 'boolean') {
            ;(result as Record<string, unknown>)[key] = val
          }
        }
      }
    }
  }

  return result
}
