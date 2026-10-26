/**
 * ComponentType enum chuẩn số từ Backend RiuTek (1..9)
 */
export enum ComponentType {
  CPU = 1,
  Motherboard = 2,
  GPU = 3,
  RAM = 4,
  Storage = 5,
  PSU = 6,
  Case = 7,
  Cooler = 8,
  Accessory = 9,
}

/**
 * ProductSortOption enum chuẩn số từ Backend RiuTek (1..5)
 */
export enum ProductSortOption {
  Newest = 1,
  PriceLowToHigh = 2,
  PriceHighToLow = 3,
  NameAToZ = 4,
  NameZToA = 5,
}

/**
 * DTO tóm tắt sản phẩm trong danh sách ProductList
 */
export interface ProductSummary {
  id: string
  categoryId: string
  categoryName: string
  name: string
  slug: string
  sku: string
  brand: string
  price: number
  originalPrice: number | null
  stockQuantity: number
  isActive: boolean
  imageUrl: string
  componentType: ComponentType
  createdAt: string
}

/**
 * DTO danh mục phân cấp từ Backend
 */
export interface Category {
  id: string
  name: string
  slug: string
  componentType: ComponentType
  description: string | null
  parentId: string | null
  subCategories: Category[]
}

/**
 * Tham số lọc và phân trang gửi lên Backend
 */
export interface ProductFilterParams {
  pageIndex?: number
  pageSize?: number
  searchTerm?: string
  categoryId?: string
  componentType?: ComponentType
  brand?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  isActive?: boolean
  sortBy?: ProductSortOption
}
