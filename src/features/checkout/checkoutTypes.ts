import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderItemDto,
  OrderDetailDto,
  PaymentActionDto,
} from '../orders/orderTypes'

export type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  OrderItemDto,
  OrderDetailDto,
  PaymentActionDto,
}

export interface CheckoutQuoteItemDto {
  productId: string
  name: string
  sku: string
  imageUrl: string
  unitPrice: number
  quantity: number
  lineTotal: number
  stockQuantity: number
  isActive: boolean
  canPurchase: boolean
  issueCode: string | null
}

export interface CheckoutQuoteDto {
  cartVersion: number
  addressId: string
  receiverName: string
  phoneNumber: string
  shippingAddress: string
  items: CheckoutQuoteItemDto[]
  subtotal: number
  discountAmount: number
  finalAmount: number
  canCheckout: boolean
  issues: string[]
}

export interface GetCheckoutQuoteRequest {
  addressId: string
  selectedProductIds?: string[]
}

export interface CheckoutCartRequest {
  addressId: string
  expectedCartVersion: number
  paymentMethod: PaymentMethod
  notes: string | null
  selectedProductIds?: string[]
}

export interface CheckoutOrderDto {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  currency: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  totalAmount: number
  discountAmount: number
  finalAmount: number
  notes: string | null
  createdAt: string
  items: OrderItemDto[]
  paymentAction: PaymentActionDto | null
}

export interface PendingStripeCommon {
  version: 2
  userId: string
  orderId: string
  orderNumber: string
  idempotencyKey: string
  addressId: string
  createdAt: string
}

export type PendingStripeCheckout =
  | (PendingStripeCommon & {
      source: 'cart'
      expectedCartVersion: number
      selectedProductIds?: string[]
    })
  | (PendingStripeCommon & {
      source: 'product'
      productId: string
      quantity: number
    })
  | (PendingStripeCommon & {
      source: 'pc-build'
      buildId: string
    })
