export type OrderStatus =
  | 'PendingPayment'
  | 'Confirmed'
  | 'Processing'
  | 'Shipping'
  | 'Completed'
  | 'Cancelled'
  | 'Refunded'

export type PaymentMethod = 'Stripe' | 'VNPay' | 'COD'

export type PaymentStatus = 'Pending' | 'Completed' | 'Failed' | 'Refunded'

export interface PagedResult<T> {
  items: T[]
  pageIndex: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
}

export interface OrderSummaryDto {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  currency: string
  totalAmount: number
  discountAmount: number
  finalAmount: number
  itemCount: number
  createdAt: string
}

export interface OrderItemDto {
  productId: string
  productName: string
  productSku: string
  unitPrice: number
  quantity: number
  totalPrice: number
}

export interface PaymentActionDto {
  type: string
  url: string
  expiresAt: string
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

export interface GetMyOrdersParams {
  pageIndex?: number
  pageSize?: number
  status?: OrderStatus
}
