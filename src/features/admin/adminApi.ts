import {
  apiClient,
  apiFetchBlob,
  ApiError,
  type ApiBlobResponse,
  type PagedResult,
} from '../../lib/api'
import type {
  GetManagedOrdersParams,
  ManagedOrderSummaryDto,
  OrderDetailDto,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UpdateManagedOrderStatusRequest,
} from '../orders/orderTypes'
import type { Category, ProductDetail } from '../products/productTypes'
import type {
  AdjustStockRequest,
  ConfirmProductMediaUploadRequest,
  CreateCategoryRequest,
  CreateProductMediaUploadRequest,
  CreateProductRequest,
  ProductImportCommitResultDto,
  ProductImportImageMappingDto,
  ProductImportInspectResultDto,
  ProductImportValidationResultDto,
  ProductMediaDto,
  ProductMediaUploadDto,
  StockAdjustmentResultDto,
  StockMovementDto,
  StockMovementsQueryParams,
  UpdateCategoryRequest,
  UpdateProductRequest,
} from './adminTypes'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_ORDER_STATUSES = new Set<OrderStatus>([
  'PendingPayment',
  'Confirmed',
  'Processing',
  'Shipping',
  'Completed',
  'Cancelled',
  'Refunded',
])

const ALLOWED_PAYMENT_METHODS = new Set<PaymentMethod>([
  'Stripe',
  'VNPay',
  'COD',
])

const ALLOWED_PAYMENT_STATUSES = new Set<PaymentStatus>([
  'Pending',
  'Completed',
  'Failed',
  'Refunded',
])

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

/**
 * GET /api/v1/product-imports/template (Binary .xlsx v1.0)
 */
export async function downloadProductImportTemplate(
  token: string,
  signal?: AbortSignal
): Promise<ApiBlobResponse> {
  return apiFetchBlob('/product-imports/template', {
    token,
    signal,
    fallbackFileName: 'riutek-product-import-v1.0.xlsx',
  })
}

function createImportFormData(
  file: File | Blob,
  fileName?: string,
  imageMappings?: ProductImportImageMappingDto[] | null
): FormData {
  const formData = new FormData()
  const resolvedName =
    fileName?.trim() ||
    (typeof File !== 'undefined' && file instanceof File && file.name
      ? file.name
      : 'products-import.xlsx')

  formData.append('file', file, resolvedName)

  if (Array.isArray(imageMappings) && imageMappings.length > 0) {
    // Contract BE: imageMappings là STRING JSON trong FormData (không phải Blob file)
    formData.append('imageMappings', JSON.stringify(imageMappings))
  }

  return formData
}

/**
 * POST /api/v1/product-imports/inspect
 */
export async function inspectProductImportWorkbook(
  file: File | Blob,
  token: string,
  fileName?: string,
  signal?: AbortSignal
): Promise<ProductImportInspectResultDto> {
  const formData = createImportFormData(file, fileName, null)
  return apiClient.post<ProductImportInspectResultDto>(
    '/product-imports/inspect',
    formData,
    {
      token,
      signal,
    }
  )
}

/**
 * POST /api/v1/product-imports/validate
 */
export async function validateProductImport(params: {
  file: File | Blob
  fileName?: string
  imageMappings?: ProductImportImageMappingDto[] | null
  token: string
  signal?: AbortSignal
}): Promise<ProductImportValidationResultDto> {
  const formData = createImportFormData(
    params.file,
    params.fileName,
    params.imageMappings
  )
  return apiClient.post<ProductImportValidationResultDto>(
    '/product-imports/validate',
    formData,
    {
      token: params.token,
      signal: params.signal,
    }
  )
}

/**
 * POST /api/v1/product-imports/import
 */
export async function commitProductImport(params: {
  file: File | Blob
  fileName?: string
  imageMappings?: ProductImportImageMappingDto[] | null
  token: string
  signal?: AbortSignal
}): Promise<ProductImportCommitResultDto> {
  const formData = createImportFormData(
    params.file,
    params.fileName,
    params.imageMappings
  )
  return apiClient.post<ProductImportCommitResultDto>(
    '/product-imports/import',
    formData,
    {
      token: params.token,
      signal: params.signal,
    }
  )
}

/**
 * POST /api/v1/product-media/upload-requests
 */
export async function createProductMediaUploadRequest(
  request: CreateProductMediaUploadRequest,
  token: string,
  signal?: AbortSignal
): Promise<ProductMediaUploadDto> {
  return apiClient.post<ProductMediaUploadDto>(
    '/product-media/upload-requests',
    request,
    {
      token,
      signal,
    }
  )
}

/**
 * POST /api/v1/product-media/confirmations
 */
export async function confirmProductMediaUpload(
  request: ConfirmProductMediaUploadRequest,
  token: string,
  signal?: AbortSignal
): Promise<ProductMediaDto> {
  return apiClient.post<ProductMediaDto>(
    '/product-media/confirmations',
    request,
    {
      token,
      signal,
    }
  )
}

/**
 * GET /api/v1/orders/admin (ContentManager only — Admin/Staff)
 * Query: pageIndex (default 1), pageSize (default 20, 1..100),
 * optional status, paymentMethod, paymentStatus, search (<= 150 chars).
 */
export async function getManagedOrders(
  params: GetManagedOrdersParams,
  token: string,
  signal?: AbortSignal
): Promise<PagedResult<ManagedOrderSummaryDto>> {
  const rawPageIndex = params.pageIndex
  const pageIndex =
    typeof rawPageIndex === 'number' &&
    Number.isSafeInteger(rawPageIndex) &&
    rawPageIndex >= 1
      ? rawPageIndex
      : 1

  const rawPageSize = params.pageSize
  const pageSize =
    typeof rawPageSize === 'number' &&
    Number.isSafeInteger(rawPageSize) &&
    rawPageSize >= 1 &&
    rawPageSize <= 100
      ? rawPageSize
      : 20

  const queryParams: Record<string, string | number> = {
    pageIndex,
    pageSize,
  }

  if (params.status && ALLOWED_ORDER_STATUSES.has(params.status)) {
    queryParams.status = params.status
  }
  if (
    params.paymentMethod &&
    ALLOWED_PAYMENT_METHODS.has(params.paymentMethod)
  ) {
    queryParams.paymentMethod = params.paymentMethod
  }
  if (
    params.paymentStatus &&
    ALLOWED_PAYMENT_STATUSES.has(params.paymentStatus)
  ) {
    queryParams.paymentStatus = params.paymentStatus
  }

  const trimmedSearch = (params.search ?? '').trim().slice(0, 150)
  if (trimmedSearch.length > 0) {
    queryParams.search = trimmedSearch
  }

  return apiClient.get<PagedResult<ManagedOrderSummaryDto>>('/orders/admin', {
    params: queryParams,
    token,
    signal,
  })
}

/**
 * GET /api/v1/orders/admin/{id} (ContentManager only — Admin/Staff)
 */
export async function getManagedOrderById(
  orderId: string,
  token: string,
  signal?: AbortSignal
): Promise<OrderDetailDto> {
  const cleanId = orderId?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({
      message: 'Mã định danh đơn hàng (ID) không hợp lệ.',
      status: 400,
      code: 'Order.InvalidId',
      description: 'Mã định danh đơn hàng (ID) không đúng định dạng UUID.',
    })
  }

  return apiClient.get<OrderDetailDto>(
    `/orders/admin/${encodeURIComponent(cleanId)}`,
    {
      token,
      signal,
    }
  )
}

/**
 * PATCH /api/v1/orders/admin/{id}/status (ContentManager only — Admin/Staff)
 * Body: { expectedStatus, newStatus } (string enum names).
 * Response 200: OrderDetailDto.
 */
export async function updateManagedOrderStatus(
  orderId: string,
  request: UpdateManagedOrderStatusRequest,
  token: string,
  signal?: AbortSignal
): Promise<OrderDetailDto> {
  const cleanId = orderId?.trim() ?? ''
  if (!isValidUuid(cleanId)) {
    throw new ApiError({
      message: 'Mã định danh đơn hàng (ID) không hợp lệ.',
      status: 400,
      code: 'Order.InvalidId',
      description: 'Mã định danh đơn hàng (ID) không đúng định dạng UUID.',
    })
  }

  const payload: UpdateManagedOrderStatusRequest = {
    expectedStatus: request.expectedStatus,
    newStatus: request.newStatus,
  }

  return apiClient.patch<OrderDetailDto>(
    `/orders/admin/${encodeURIComponent(cleanId)}/status`,
    payload,
    {
      token,
      signal,
    }
  )
}
