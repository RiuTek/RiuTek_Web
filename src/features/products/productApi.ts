import { apiClient, ApiError, type PagedResult } from '../../lib/api'
import type {
  Category,
  ComponentType,
  ProductDetail,
  ProductFilterOptionsResponse,
  ProductFilterParams,
  ProductSummary,
} from './productTypes'

/**
 * Lấy danh sách sản phẩm phân trang từ RiuTek API qua Vercel reverse proxy
 */
export async function getProducts(
  filters: ProductFilterParams = {},
  signal?: AbortSignal
): Promise<PagedResult<ProductSummary>> {
  const params: Record<string, string | number | boolean | (string | number | boolean)[]> = {}

  if (filters.pageIndex !== undefined && filters.pageIndex >= 1) {
    params.pageIndex = filters.pageIndex
  }

  if (filters.pageSize !== undefined && filters.pageSize >= 1 && filters.pageSize <= 50) {
    params.pageSize = filters.pageSize
  }

  if (filters.searchTerm && filters.searchTerm.trim().length > 0) {
    params.searchTerm = filters.searchTerm.trim().slice(0, 100)
  }

  if (filters.categoryId && filters.categoryId.trim().length > 0) {
    params.categoryId = filters.categoryId.trim()
  }

  if (filters.componentType !== undefined && filters.componentType >= 1 && filters.componentType <= 9) {
    params.componentType = filters.componentType
  }

  // Brands (hỗ trợ cả plural list và scalar legacy)
  const brandList: string[] = []
  if (filters.brands && filters.brands.length > 0) {
    brandList.push(...filters.brands)
  }
  if (filters.brand && filters.brand.trim()) {
    brandList.push(filters.brand.trim())
  }
  if (brandList.length > 0) {
    // Unique preserving first casing
    const seenBrands = new Set<string>()
    const dedupedBrands: string[] = []
    for (const b of brandList) {
      const lower = b.toLowerCase()
      if (!seenBrands.has(lower)) {
        seenBrands.add(lower)
        dedupedBrands.push(b)
      }
    }
    params.brands = dedupedBrands.slice(0, 20)
  }

  if (filters.minPrice !== undefined && filters.minPrice >= 0) {
    params.minPrice = filters.minPrice
  }

  if (filters.maxPrice !== undefined && filters.maxPrice >= 0) {
    params.maxPrice = filters.maxPrice
  }

  if (typeof filters.inStock === 'boolean') {
    params.inStock = filters.inStock
  }

  if (typeof filters.isActive === 'boolean') {
    params.isActive = filters.isActive
  }

  if (filters.sortBy !== undefined && filters.sortBy >= 1 && filters.sortBy <= 5) {
    params.sortBy = filters.sortBy
  }

  // Helper serialize numeric list combining plural + scalar
  const appendNumericGroup = (
    pluralKey: string,
    list?: number[],
    scalar?: number
  ) => {
    const combined: number[] = []
    if (list && list.length > 0) {
      combined.push(...list)
    }
    if (scalar !== undefined && !combined.includes(scalar)) {
      combined.push(scalar)
    }
    if (combined.length > 0) {
      const unique = Array.from(new Set(combined)).slice(0, 20)
      params[pluralKey] = unique
    }
  }

  // 10 Enum technical groups
  appendNumericGroup('sockets', filters.sockets, filters.socket)
  appendNumericGroup('memoryTypes', filters.memoryTypes, filters.memoryType)
  appendNumericGroup('motherboardFormFactors', filters.motherboardFormFactors, filters.motherboardFormFactor)
  appendNumericGroup('ramFormFactors', filters.ramFormFactors, filters.ramFormFactor)
  appendNumericGroup('storageTypes', filters.storageTypes, filters.storageType)
  appendNumericGroup('storageInterfaces', filters.storageInterfaces, filters.storageInterface)
  appendNumericGroup('psuEfficiencies', filters.psuEfficiencies, filters.psuEfficiency)
  appendNumericGroup('psuModularities', filters.psuModularities, filters.psuModularity)
  appendNumericGroup('psuFormFactors', filters.psuFormFactors, filters.psuFormFactor)
  appendNumericGroup('coolerTypes', filters.coolerTypes, filters.coolerType)

  // 7 Numeric technical lists
  appendNumericGroup('coreCounts', filters.coreCounts)
  appendNumericGroup('vramGbs', filters.vramGbs)
  appendNumericGroup('gpuLengthsMm', filters.gpuLengthsMm)
  appendNumericGroup('ramCapacitiesGb', filters.ramCapacitiesGb)
  appendNumericGroup('ramSpeedsMhz', filters.ramSpeedsMhz)
  appendNumericGroup('storageCapacitiesGb', filters.storageCapacitiesGb)
  appendNumericGroup('psuWattages', filters.psuWattages)

  // 5 Booleans
  if (typeof filters.hasIntegratedGpu === 'boolean') {
    params.hasIntegratedGpu = filters.hasIntegratedGpu
  }
  if (typeof filters.hasWifi === 'boolean') {
    params.hasWifi = filters.hasWifi
  }
  if (typeof filters.hasRgb === 'boolean') {
    params.hasRgb = filters.hasRgb
  }
  if (typeof filters.has12VHPWR === 'boolean') {
    params.has12VHPWR = filters.has12VHPWR
  }
  if (typeof filters.requires12VHPWR === 'boolean') {
    params.requires12VHPWR = filters.requires12VHPWR
  }

  return apiClient.get<PagedResult<ProductSummary>>('/products', {
    params,
    signal,
  })
}

export interface GetProductFilterOptionsParams {
  componentType?: ComponentType
  categoryId?: string
  isActive?: boolean
  inStock?: boolean
}

/**
 * Lấy danh sách options khả dụng cho các bộ lọc checkbox theo scope 4 params
 */
export async function getProductFilterOptions(
  optionsParams: GetProductFilterOptionsParams = {},
  signal?: AbortSignal
): Promise<ProductFilterOptionsResponse> {
  const queryParams: Record<string, string | number | boolean> = {}

  if (optionsParams.componentType !== undefined && optionsParams.componentType >= 1 && optionsParams.componentType <= 9) {
    queryParams.componentType = optionsParams.componentType
  }

  if (optionsParams.categoryId && optionsParams.categoryId.trim().length > 0) {
    queryParams.categoryId = optionsParams.categoryId.trim()
  }

  if (typeof optionsParams.isActive === 'boolean') {
    queryParams.isActive = optionsParams.isActive
  }

  if (typeof optionsParams.inStock === 'boolean') {
    queryParams.inStock = optionsParams.inStock
  }

  return apiClient.get<ProductFilterOptionsResponse>('/products/filter-options', {
    params: queryParams,
    signal,
  })
}

/**
 * Lấy cây danh mục phân cấp từ RiuTek API qua Vercel reverse proxy
 */
export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  return apiClient.get<Category[]>('/categories', {
    signal,
  })
}

/**
 * Lấy chi tiết sản phẩm theo slug từ RiuTek API qua Vercel reverse proxy
 */
export async function getProductBySlug(
  slug: string,
  signal?: AbortSignal
): Promise<ProductDetail> {
  const cleanSlug = slug ? slug.trim() : ''
  if (!cleanSlug || cleanSlug.length > 255) {
    throw new ApiError({ message: 'Slug không hợp lệ', status: 400 })
  }

  return apiClient.get<ProductDetail>(`/products/slug/${encodeURIComponent(cleanSlug)}`, {
    signal,
  })
}
