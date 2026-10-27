export {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from '../orders/orderConstants'

export const CHECKOUT_ERROR_MESSAGES: Record<string, string> = {
  'Checkout.Unauthorized': 'Vui lòng đăng nhập lại để thanh toán.',
  'Checkout.UserNotFound': 'Không tìm thấy tài khoản người dùng.',
  'Checkout.AccountInactive': 'Tài khoản hiện không thể đặt hàng.',
  'Checkout.AddressNotFound': 'Địa chỉ giao hàng không còn tồn tại.',
  'Checkout.EmptyCart': 'Giỏ hàng đang trống.',
  'Checkout.CartChanged': 'Giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại báo giá.',
  'Checkout.ProductNotFound': 'Một hoặc nhiều sản phẩm không còn tồn tại.',
  'Checkout.ProductInactive': 'Một hoặc nhiều sản phẩm đã ngừng kinh doanh.',
  'Checkout.InvalidPrice': 'Giá sản phẩm đã thay đổi hoặc không hợp lệ.',
  'Checkout.InsufficientStock': 'Tồn kho không đủ cho số lượng đã chọn.',
  'Checkout.InventoryChanged': 'Tồn kho vừa thay đổi. Vui lòng kiểm tra lại.',
  'Checkout.PaymentMethodNotAvailable': 'Phương thức thanh toán hiện không khả dụng.',
  'Checkout.IdempotencyConflict': 'Không thể tiếp tục lần đặt hàng này. Vui lòng kiểm tra trạng thái đơn.',
  'Payment.StripeUnavailable': 'Stripe đang tạm thời không khả dụng. Hãy thử lại cùng lần thanh toán.',
}

export const QUOTE_ISSUE_MESSAGES: Record<string, string> = {
  EMPTY_CART: 'Giỏ hàng đang trống.',
  PRODUCT_INACTIVE: 'Sản phẩm đã ngừng kinh doanh.',
  INVALID_PRICE: 'Giá sản phẩm hiện không hợp lệ.',
  OUT_OF_STOCK: 'Sản phẩm đang hết hàng.',
  INSUFFICIENT_STOCK: 'Số lượng yêu cầu vượt quá tồn kho.',
  PRODUCT_NOT_FOUND: 'Sản phẩm không còn tồn tại.',
}

export const PENDING_STRIPE_STORAGE_KEY = 'riutek:pending-stripe-checkout:v1'
export const STRIPE_CHECKOUT_HOSTNAME = 'checkout.stripe.com'
export const PENDING_STRIPE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
export const MAX_NOTES_LENGTH = 1000
