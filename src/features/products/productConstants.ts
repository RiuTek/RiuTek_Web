import { ComponentType, ProductSortOption } from './productTypes'

export const COMPONENT_TYPE_LABELS: Record<ComponentType, string> = {
  [ComponentType.CPU]: 'Bộ vi xử lý (CPU)',
  [ComponentType.Motherboard]: 'Bo mạch chủ (Mainboard)',
  [ComponentType.GPU]: 'Card màn hình (GPU)',
  [ComponentType.RAM]: 'Bộ nhớ RAM',
  [ComponentType.Storage]: 'Ổ cứng SSD & HDD',
  [ComponentType.PSU]: 'Nguồn máy tính (PSU)',
  [ComponentType.Case]: 'Vỏ case máy tính',
  [ComponentType.Cooler]: 'Tản nhiệt (Cooler)',
  [ComponentType.Accessory]: 'Phụ kiện máy tính',
}

export const SORT_OPTION_LABELS: Record<ProductSortOption, string> = {
  [ProductSortOption.Newest]: 'Mới nhất',
  [ProductSortOption.PriceLowToHigh]: 'Giá tăng dần',
  [ProductSortOption.PriceHighToLow]: 'Giá giảm dần',
  [ProductSortOption.NameAToZ]: 'Tên từ A đến Z',
  [ProductSortOption.NameZToA]: 'Tên từ Z đến A',
}

export const DEFAULT_PAGE_INDEX = 1
export const DEFAULT_PAGE_SIZE = 12
export const DEFAULT_SORT_BY = ProductSortOption.Newest

export const formatVnd = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount)
}
