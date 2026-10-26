import { apiClient, type PagedResult } from '../../lib/api'
import type { Category, ProductFilterParams, ProductSummary } from './productTypes'

/**
 * Lấy danh sách sản phẩm phân trang từ RiuTek API qua Vercel reverse proxy
 */
export async function getProducts(
  filters: ProductFilterParams = {},
  signal?: AbortSignal
): Promise<PagedResult<ProductSummary>> {
  const params: Record<string, string | number | boolean> = {}

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

  if (filters.brand && filters.brand.trim().length > 0) {
    params.brand = filters.brand.trim().slice(0, 100)
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

  return apiClient.get<PagedResult<ProductSummary>>('/products', {
    params,
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
