import { apiClient } from '../../lib/api'
import type {
  CheckoutCartRequest,
  CheckoutOrderDto,
  CheckoutQuoteDto,
  GetCheckoutQuoteRequest,
} from './checkoutTypes'

export { getMyOrderById } from '../orders/orderApi'

/**
 * Lấy báo giá checkout cho giỏ hàng hiện tại với địa chỉ được chọn.
 * Backend yêu cầu POST có JSON body: { addressId: string }.
 */
export function getCheckoutQuote(
  addressId: string,
  token: string,
  selectedProductIds?: string[],
  signal?: AbortSignal
): Promise<CheckoutQuoteDto> {
  const body: GetCheckoutQuoteRequest = {
    addressId,
    ...(selectedProductIds ? { selectedProductIds } : {}),
  }
  return apiClient.post<CheckoutQuoteDto>('/orders/checkout/quote', body, {
    token,
    signal,
  })
}

/**
 * Thực hiện đặt hàng từ giỏ hàng.
 * Header Idempotency-Key bắt buộc dài từ 16 đến 128 ký tự.
 */
export function checkoutCart(
  request: CheckoutCartRequest,
  idempotencyKey: string,
  token: string,
  signal?: AbortSignal
): Promise<CheckoutOrderDto> {
  return apiClient.post<CheckoutOrderDto>('/orders/checkout', request, {
    token,
    signal,
    headers: {
      'Idempotency-Key': idempotencyKey,
    },
  })
}
