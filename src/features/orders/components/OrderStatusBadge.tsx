import React from 'react'
import type { OrderStatus, PaymentStatus } from '../orderTypes'
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orderConstants'

interface OrderStatusBadgeProps {
  status: OrderStatus
  className?: string
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const label = ORDER_STATUS_LABELS[status] ?? status
  const color = ORDER_STATUS_COLORS[status] ?? {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color.bg} ${color.text} ${color.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

interface PaymentStatusBadgeProps {
  status: PaymentStatus
  className?: string
}

export const PaymentStatusBadge: React.FC<PaymentStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const label = PAYMENT_STATUS_LABELS[status] ?? status

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200'
  if (status === 'Completed') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  } else if (status === 'Pending') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200'
  } else if (status === 'Failed') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200'
  } else if (status === 'Refunded') {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colorClasses} ${className}`}
    >
      {label}
    </span>
  )
}
