import { apiClient } from '../../lib/api'
import type {
  GetMyOrdersParams,
  OrderDetailDto,
  OrderSummaryDto,
  PagedResult,
} from './orderTypes'

/**
 * Lấy danh sách đơn hàng có phân trang của người dùng hiện tại.
 * Status là optional. FE dùng pageSize = 10 cố định.
 */
export function getMyOrders(
  params: GetMyOrdersParams,
  token: string,
  signal?: AbortSignal
): Promise<PagedResult<OrderSummaryDto>> {
  const searchParams = new URLSearchParams()
  searchParams.set('pageIndex', String(params.pageIndex ?? 1))
  searchParams.set('pageSize', String(params.pageSize ?? 10))
  if (params.status) {
    searchParams.set('status', params.status)
  }

  const query = searchParams.toString()
  const endpoint = query ? `/orders?${query}` : '/orders'

  return apiClient.get<PagedResult<OrderSummaryDto>>(endpoint, {
    token,
    signal,
  })
}

/**
 * Lấy chi tiết đơn hàng của người dùng hiện tại theo orderId.
 */
export function getMyOrderById(
  orderId: string,
  token: string,
  signal?: AbortSignal
): Promise<OrderDetailDto> {
  return apiClient.get<OrderDetailDto>(
    `/orders/${encodeURIComponent(orderId)}`,
    {
      token,
      signal,
    }
  )
}

/**
 * Hủy đơn hàng của người dùng hiện tại (hỗ trợ đơn COD ở trạng thái Confirmed
 * hoặc đơn Stripe ở trạng thái PendingPayment / payment Pending).
 * Tuyệt đối không gửi body rỗng {}. Backend yêu cầu body là undefined để tránh lỗi HTTP 415.
 */
export function cancelMyOrder(
  orderId: string,
  token: string,
  signal?: AbortSignal
): Promise<OrderDetailDto> {
  return apiClient.post<OrderDetailDto>(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    undefined,
    {
      token,
      signal,
    }
  )
}
