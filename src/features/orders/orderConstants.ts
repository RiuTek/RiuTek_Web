import type {
  OrderDetailDto,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './orderTypes'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PendingPayment: 'Chờ thanh toán',
  Confirmed: 'Đã xác nhận',
  Processing: 'Đang xử lý',
  Shipping: 'Đang giao hàng',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy',
  Refunded: 'Đã hoàn tiền',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Chờ xử lý',
  Completed: 'Đã thanh toán',
  Failed: 'Thất bại',
  Refunded: 'Đã hoàn tiền',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng (COD)',
  Stripe: 'Thẻ quốc tế (Stripe)',
  VNPay: 'Cổng thanh toán VNPay',
}

export const ORDER_STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  PendingPayment: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  Confirmed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  Processing: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    dot: 'bg-indigo-500',
  },
  Shipping: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
  Completed: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Cancelled: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  Refunded: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
}

export function canCustomerCancelOrder(
  order: Pick<OrderDetailDto, 'status' | 'paymentMethod'>
): boolean {
  return order.status === 'Confirmed' && order.paymentMethod === 'COD'
}
