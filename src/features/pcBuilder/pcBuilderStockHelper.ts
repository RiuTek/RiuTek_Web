export interface ComponentStockDisplay {
  label: string
  badgeClass: string
  iconType: 'check' | 'cross' | 'alert'
}

/**
 * Xác định nhãn hiển thị và phong cách trạng thái tồn kho theo thứ tự ưu tiên:
 * 1. isActive false: Ngừng kinh doanh.
 * 2. isActive true, stockQuantity <= 0: Hết hàng.
 * 3. isActive true, stockQuantity > 0 nhưng stockQuantity < quantity: Không đủ số lượng (cần X, còn Y).
 * 4. Đủ stock và canPurchase true: Còn hàng (Y).
 * 5. Đủ stock nhưng canPurchase false: Chưa thể mua (không suy diễn là hết hàng).
 */
export function getComponentStockDisplay(item: {
  isActive: boolean
  stockQuantity: number
  quantity: number
  canPurchase: boolean
}): ComponentStockDisplay {
  if (!item.isActive) {
    return {
      label: 'Ngừng kinh doanh',
      badgeClass:
        'text-rose-700 font-semibold inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md',
      iconType: 'cross',
    }
  }

  if (item.stockQuantity <= 0) {
    return {
      label: 'Hết hàng',
      badgeClass:
        'text-rose-700 font-semibold inline-flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-md',
      iconType: 'cross',
    }
  }

  if (item.stockQuantity < item.quantity) {
    return {
      label: `Không đủ số lượng (cần ${item.quantity}, còn ${item.stockQuantity})`,
      badgeClass:
        'text-amber-800 font-semibold inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60',
      iconType: 'alert',
    }
  }

  if (item.canPurchase) {
    return {
      label: `Còn hàng (${item.stockQuantity})`,
      badgeClass: 'text-emerald-700 font-semibold inline-flex items-center gap-1',
      iconType: 'check',
    }
  }

  return {
    label: 'Chưa thể mua',
    badgeClass:
      'text-amber-800 font-semibold inline-flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60',
    iconType: 'alert',
  }
}
