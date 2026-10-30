import { apiClient } from '../../lib/api'
import type { AddCartItemRequest, CartDto, SetCartItemQuantityRequest } from './cartTypes'

/**
 * Lấy thông tin giỏ hàng hiện tại của người dùng đã xác thực.
 * Backend trả về 200 với giỏ hàng rỗng nếu người dùng chưa có cart.
 */
export function getCart(token: string, signal?: AbortSignal): Promise<CartDto> {
  return apiClient.get<CartDto>('/carts', { token, signal })
}

/**
 * Thêm sản phẩm vào giỏ hàng.
 * Nếu sản phẩm đã tồn tại trong giỏ, Backend sẽ cộng dồn số lượng.
 */
export function addCartItem(
  request: AddCartItemRequest,
  token: string,
  signal?: AbortSignal
): Promise<CartDto> {
  return apiClient.post<CartDto>('/carts/items', request, { token, signal })
}

/**
 * Đặt số lượng tuyệt đối cho một sản phẩm trong giỏ hàng.
 */
export function setCartItemQuantity(
  productId: string,
  quantity: number,
  token: string,
  signal?: AbortSignal
): Promise<CartDto> {
  const body: SetCartItemQuantityRequest = { quantity }
  return apiClient.put<CartDto>(
    `/carts/items/${encodeURIComponent(productId)}`,
    body,
    { token, signal }
  )
}

/**
 * Thêm toàn bộ linh kiện từ cấu hình PC đã lưu vào giỏ hàng.
 * Backend trả về 200 CartDto.
 */
export function addPCBuildToCart(
  pcBuildId: string,
  token: string,
  signal?: AbortSignal
): Promise<CartDto> {
  return apiClient.post<CartDto>(
    `/carts/from-pc-build/${encodeURIComponent(pcBuildId)}`,
    undefined,
    { token, signal }
  )
}

/**
 * Xóa một sản phẩm khỏi giỏ hàng.
 * Backend trả về 204 No Content.
 */
export function removeCartItem(
  productId: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  return apiClient.delete<void>(
    `/carts/items/${encodeURIComponent(productId)}`,
    { token, signal }
  )
}

/**
 * Xóa toàn bộ sản phẩm khỏi giỏ hàng.
 * Backend trả về 204 No Content.
 */
export function clearCart(token: string, signal?: AbortSignal): Promise<void> {
  return apiClient.delete<void>('/carts/items', { token, signal })
}
