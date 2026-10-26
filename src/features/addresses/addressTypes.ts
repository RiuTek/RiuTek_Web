export interface UserAddressDto {
  id: string
  userId: string
  receiverName: string
  phoneNumber: string
  addressLine: string
  ward: string
  district: string
  city: string
  isDefault: boolean
}

export interface AddAddressRequest {
  receiverName: string
  phoneNumber: string
  addressLine: string
  ward: string
  district: string
  city: string
  isDefault: boolean
}

export interface UpdateAddressRequest {
  receiverName: string
  phoneNumber: string
  addressLine: string
  ward: string
  district: string
  city: string
}

export type AddressStatus = 'idle' | 'loading' | 'ready' | 'error'

export type AddressMutationResult =
  | { refreshed: true }
  | { refreshed: false; warning: string }

export const ADDRESS_ERROR_MESSAGES: Record<string, string> = {
  'UserAddress.NotFound': 'Không tìm thấy địa chỉ hoặc địa chỉ không còn tồn tại.',
  'User.Unauthorized': 'Vui lòng đăng nhập lại để quản lý địa chỉ.',
  'User.NotFound': 'Không tìm thấy tài khoản người dùng.',
  'User.AccountInactive': 'Tài khoản hiện không thể quản lý địa chỉ.',
}
