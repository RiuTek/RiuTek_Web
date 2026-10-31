import { apiClient } from '../../lib/api'
import type { CheckoutOrderDto } from '../checkout/checkoutTypes'
import type { BuyNowPCBuildRequest, BuyNowProductRequest } from './buyNowTypes'

/**
 * Đặt mua trực tiếp một sản phẩm (Buy Now) không qua giỏ hàng.
 * Header Idempotency-Key bắt buộc dài từ 16 đến 128 ký tự.
 */
export function buyNowProduct(
  productId: string,
  request: BuyNowProductRequest,
  idempotencyKey: string,
  token: string,
  signal?: AbortSignal
): Promise<CheckoutOrderDto> {
  return apiClient.post<CheckoutOrderDto>(
    `/orders/buy-now/product/${encodeURIComponent(productId)}`,
    request,
    {
      token,
      signal,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  )
}

/**
 * Đặt mua trực tiếp một cấu hình PC đã lưu (Buy Now) không qua giỏ hàng.
 * Header Idempotency-Key bắt buộc dài từ 16 đến 128 ký tự.
 */
export function buyNowPCBuild(
  buildId: string,
  request: BuyNowPCBuildRequest,
  idempotencyKey: string,
  token: string,
  signal?: AbortSignal
): Promise<CheckoutOrderDto> {
  return apiClient.post<CheckoutOrderDto>(
    `/orders/buy-now/pc-build/${encodeURIComponent(buildId)}`,
    request,
    {
      token,
      signal,
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    }
  )
}
