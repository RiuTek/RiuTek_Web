import React from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  CreditCard,
  Layers,
  ChevronRight,
  Package,
} from 'lucide-react'
import type { OrderSummaryDto } from '../orderTypes'
import { PAYMENT_METHOD_LABELS } from '../orderConstants'
import { OrderStatusBadge, PaymentStatusBadge } from './OrderStatusBadge'

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}

function formatCreatedAt(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

interface OrderSummaryCardProps {
  order: OrderSummaryDto
}

export const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({ order }) => {
  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 hover:shadow-md transition-shadow duration-200 space-y-4">
      {/* Header: Order Number, Date, Status Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 flex-shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium">Mã đơn hàng</span>
            <p className="font-bold text-slate-950 text-sm sm:text-base leading-tight">
              #{order.orderNumber}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{formatCreatedAt(order.createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <CreditCard className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate" title={paymentMethodLabel}>
            {paymentMethodLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{order.itemCount} dòng sản phẩm</span>
        </div>
      </div>

      {/* Footer: Amount and View Detail Link */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-slate-500">Tổng thanh toán:</span>
          <span className="text-base sm:text-lg font-black text-red-600">
            {formatVnd(order.finalAmount)}
          </span>
          {order.discountAmount > 0 && (
            <span className="text-[11px] text-emerald-600 font-medium">
              (Đã giảm {formatVnd(order.discountAmount)})
            </span>
          )}
        </div>

        <Link
          to={`/orders/${encodeURIComponent(order.id)}`}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold transition-colors self-start sm:self-auto shadow-xs"
        >
          <span>Xem chi tiết</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
