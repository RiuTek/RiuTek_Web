export type PaymentMethod = 'COD' | 'Stripe'

export type OrderStatus =
  | 'PendingPayment'
  | 'Confirmed'
  | 'Processing'
  | 'Shipping'
  | 'Completed'
  | 'Cancelled'
  | 'Refunded'

export type PaymentStatus = 'Pending' | 'Completed' | 'Failed' | 'Refunded'

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
}

export interface CheckoutCartRequest {
  addressId: string
  expectedCartVersion: number
  paymentMethod: PaymentMethod
  notes: string | null
}

export interface OrderItemDto {
  id: string
  productId: string
  productName: string
  sku: string
  imageUrl: string
  unitPrice: number
  quantity: number
  totalPrice: number
}

export interface PaymentActionDto {
  type: string
  url: string
  expiresAt: string
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

export interface OrderDetailDto {
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
  paymentAction?: PaymentActionDto | null
}

export interface PendingStripeCheckout {
  version: 1
  userId: string
  orderId: string
  orderNumber: string
  idempotencyKey: string
  addressId: string
  expectedCartVersion: number
  createdAt: string
}
