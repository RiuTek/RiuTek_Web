import { apiClient } from '../../lib/api'
import type {
  AddAddressRequest,
  UpdateAddressRequest,
  UserAddressDto,
} from './addressTypes'

const BASE_ADDRESS_PATH = '/users/me/addresses'

/**
 * Lấy danh sách địa chỉ giao hàng của người dùng hiện tại.
 * Backend trả về 200 UserAddressDto[], đã được sắp xếp mặc định trước.
 */
export function getMyAddresses(
  token: string,
  signal?: AbortSignal
): Promise<UserAddressDto[]> {
  return apiClient.get<UserAddressDto[]>(BASE_ADDRESS_PATH, { token, signal })
}

/**
 * Thêm một địa chỉ mới cho người dùng.
 * Backend trả về 201 UserAddressDto.
 * Địa chỉ đầu tiên luôn trở thành mặc định dù isDefault gửi false.
 */
export function addAddress(
  request: AddAddressRequest,
  token: string,
  signal?: AbortSignal
): Promise<UserAddressDto> {
  return apiClient.post<UserAddressDto>(BASE_ADDRESS_PATH, request, {
    token,
    signal,
  })
}

/**
 * Cập nhật thông tin địa chỉ hiện có.
 * Body TUYỆT ĐỐI không chứa isDefault.
 * Backend trả về 200 UserAddressDto.
 */
export function updateAddress(
  addressId: string,
  request: UpdateAddressRequest,
  token: string,
  signal?: AbortSignal
): Promise<UserAddressDto> {
  return apiClient.put<UserAddressDto>(
    `${BASE_ADDRESS_PATH}/${encodeURIComponent(addressId)}`,
    request,
    { token, signal }
  )
}

/**
 * Đặt một địa chỉ làm địa chỉ mặc định.
 * Không gửi body.
 * Backend trả về 204 No Content.
 */
export function setDefaultAddress(
  addressId: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  return apiClient.patch<void>(
    `${BASE_ADDRESS_PATH}/${encodeURIComponent(addressId)}/default`,
    undefined,
    { token, signal }
  )
}

/**
 * Xóa một địa chỉ.
 * Backend trả về 204 No Content.
 * Nếu xóa địa chỉ mặc định khi còn địa chỉ khác, Backend tự thăng cấp địa chỉ sớm nhất.
 */
export function deleteAddress(
  addressId: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  return apiClient.delete<void>(
    `${BASE_ADDRESS_PATH}/${encodeURIComponent(addressId)}`,
    { token, signal }
  )
}
