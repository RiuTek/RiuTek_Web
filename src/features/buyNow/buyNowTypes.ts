import type { PaymentMethod } from '../orders/orderTypes'

export interface BuyNowProductRequest {
  addressId: string
  quantity: number
  paymentMethod: PaymentMethod
  notes: string | null
}

export interface BuyNowPCBuildRequest {
  addressId: string
  paymentMethod: PaymentMethod
  notes: string | null
}
