import { apiClient, ApiError, type PagedResult } from '../../lib/api'
import type { Category, ProductDetail } from '../products/productTypes'
import type {
  AdjustStockRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  StockAdjustmentResultDto,
  StockMovementDto,
  StockMovementsQueryParams,
  UpdateCategoryRequest,
  UpdateProductRequest,
} from './adminTypes'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false
  return UUID_REGEX.test(id.trim())
}

/**
 * GET /api/v1/categories/{id}
 */
export async function getCategoryById(
  id: string,
  signal?: AbortSignal
): Promise<Category> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id danh mục không hợp lệ.', status: 400 })
  }
  return apiClient.get<Category>(`/categories/${encodeURIComponent(cleanId)}`, {
    signal,
  })
}

/**
 * POST /api/v1/categories
 */
export async function createCategory(
  request: CreateCategoryRequest,
  token: string
): Promise<Category> {
  return apiClient.post<Category>('/categories', request, { token })
}

/**
 * PUT /api/v1/categories/{id}
 */
export async function updateCategory(
  id: string,
  request: UpdateCategoryRequest,
  token: string
): Promise<Category> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id danh mục không hợp lệ.', status: 400 })
  }
  return apiClient.put<Category>(
    `/categories/${encodeURIComponent(cleanId)}`,
    request,
    { token }
  )
}

/**
 * DELETE /api/v1/categories/{id}
 */
export async function deleteCategory(id: string, token: string): Promise<void> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id danh mục không hợp lệ.', status: 400 })
  }
  await apiClient.delete<void>(`/categories/${encodeURIComponent(cleanId)}`, {
    token,
  })
}

/**
 * GET /api/v1/products/{id} (ContentManager only — không dùng slug để edit)
 */
export async function getAdminProductById(
  id: string,
  token: string,
  signal?: AbortSignal
): Promise<ProductDetail> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id sản phẩm không hợp lệ.', status: 400 })
  }
  return apiClient.get<ProductDetail>(
    `/products/${encodeURIComponent(cleanId)}`,
    {
      token,
      signal,
    }
  )
}

/**
 * POST /api/v1/products
 */
export async function createProduct(
  request: CreateProductRequest,
  token: string
): Promise<ProductDetail> {
  return apiClient.post<ProductDetail>('/products', request, { token })
}

/**
 * PUT /api/v1/products/{id}
 */
export async function updateProduct(
  id: string,
  request: UpdateProductRequest,
  token: string
): Promise<ProductDetail> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id sản phẩm không hợp lệ.', status: 400 })
  }
  return apiClient.put<ProductDetail>(
    `/products/${encodeURIComponent(cleanId)}`,
    request,
    { token }
  )
}

/**
 * POST /api/v1/products/{id}/stock-adjustments
 */
export async function adjustProductStock(
  id: string,
  request: AdjustStockRequest,
  token: string
): Promise<StockAdjustmentResultDto> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id sản phẩm không hợp lệ.', status: 400 })
  }
  return apiClient.post<StockAdjustmentResultDto>(
    `/products/${encodeURIComponent(cleanId)}/stock-adjustments`,
    request,
    { token }
  )
}

/**
 * GET /api/v1/products/{id}/stock-movements
 */
export async function getProductStockMovements(
  id: string,
  params: StockMovementsQueryParams,
  token: string,
  signal?: AbortSignal
): Promise<PagedResult<StockMovementDto>> {
  const cleanId = id?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({ message: 'Id sản phẩm không hợp lệ.', status: 400 })
  }

  const queryParams: Record<string, string | number> = {}
  if (params.pageIndex !== undefined && params.pageIndex >= 1) {
    queryParams.pageIndex = params.pageIndex
  }
  if (params.pageSize !== undefined && params.pageSize >= 1 && params.pageSize <= 100) {
    queryParams.pageSize = params.pageSize
  }
  if (params.reason) {
    queryParams.reason = params.reason
  }

  return apiClient.get<PagedResult<StockMovementDto>>(
    `/products/${encodeURIComponent(cleanId)}/stock-movements`,
    {
      params: queryParams,
      token,
      signal,
    }
  )
}
