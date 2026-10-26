import { createContext, useContext } from 'react'
import type {
  AddAddressRequest,
  AddressStatus,
  UpdateAddressRequest,
  UserAddressDto,
} from './addressTypes'

export interface AddressContextValue {
  addresses: UserAddressDto[]
  status: AddressStatus
  error: string | null
  isMutating: boolean
  loadAddresses: () => Promise<void>
  addAddress: (request: AddAddressRequest) => Promise<void>
  updateAddress: (id: string, request: UpdateAddressRequest) => Promise<void>
  setDefaultAddress: (id: string) => Promise<void>
  deleteAddress: (id: string) => Promise<void>
  clearError: () => void
}

export const AddressContext = createContext<AddressContextValue | null>(null)

export function useAddresses(): AddressContextValue {
  const context = useContext(AddressContext)
  if (!context) {
    throw new Error('useAddresses must be used within an AddressProvider')
  }
  return context
}
