export interface CartItemDto {
  productId: string
  name: string
  slug: string
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

export interface CartDto {
  cartId: string | null
  version: number
  items: CartItemDto[]
  subtotal: number
  canCheckout: boolean
}

export interface AddCartItemRequest {
  productId: string
  quantity: number
}

export interface SetCartItemQuantityRequest {
  quantity: number
}

export type CartStatus = 'idle' | 'loading' | 'ready' | 'error'

export const CART_ISSUE_LABELS: Record<string, string> = {
  INACTIVE: 'Sản phẩm đã ngừng kinh doanh',
  OUT_OF_STOCK: 'Sản phẩm đang hết hàng',
  INSUFFICIENT_STOCK: 'Số lượng vượt quá tồn kho hiện tại',
  PRODUCT_NOT_FOUND: 'Sản phẩm không còn tồn tại',
}

export const CART_ERROR_MESSAGES: Record<string, string> = {
  'Cart.ProductNotFound': 'Không tìm thấy sản phẩm.',
  'Cart.ProductInactive': 'Sản phẩm đã ngừng kinh doanh.',
  'Cart.InsufficientStock': 'Số lượng yêu cầu vượt quá tồn kho hiện tại.',
  'Cart.MaxQuantityExceeded': 'Mỗi sản phẩm chỉ được tối đa 99.',
  'Cart.MaxItemsExceeded': 'Giỏ hàng đã đạt tối đa 50 sản phẩm khác nhau.',
  'Cart.ItemNotFound': 'Sản phẩm không còn trong giỏ hàng.',
  'Cart.ConcurrencyConflict': 'Giỏ hàng vừa thay đổi ở nơi khác và đã được tải lại.',
  'Cart.DuplicateCartCreation': 'Giỏ hàng đang được khởi tạo; dữ liệu mới nhất đã được tải lại.',
  'Cart.AccountInactive': 'Tài khoản hiện không thể sử dụng giỏ hàng.',
}

export function getCartIssueLabel(issueCode: string | null): string {
  if (!issueCode) return 'Sản phẩm hiện chưa thể mua'
  return CART_ISSUE_LABELS[issueCode] ?? 'Sản phẩm hiện chưa thể mua'
}
