import { ApiError } from '../../lib/api'
import type { StockMovementReason } from './adminTypes'

export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  ProductCreated: 'Khởi tạo sản phẩm',
  BulkImport: 'Nhập hàng loạt (Excel)',
  ManualAdjustment: 'Điều chỉnh thủ công',
  Checkout: 'Khách đặt hàng',
  OrderCancellation: 'Hoàn kho do hủy đơn',
  PaymentExpiration: 'Hoàn kho do hết hạn thanh toán',
}

export const STOCK_MOVEMENT_REASON_OPTIONS: Array<{
  value: StockMovementReason
  label: string
}> = [
  { value: 'ManualAdjustment', label: STOCK_MOVEMENT_REASON_LABELS.ManualAdjustment },
  { value: 'ProductCreated', label: STOCK_MOVEMENT_REASON_LABELS.ProductCreated },
  { value: 'Checkout', label: STOCK_MOVEMENT_REASON_LABELS.Checkout },
  { value: 'OrderCancellation', label: STOCK_MOVEMENT_REASON_LABELS.OrderCancellation },
  { value: 'PaymentExpiration', label: STOCK_MOVEMENT_REASON_LABELS.PaymentExpiration },
  { value: 'BulkImport', label: STOCK_MOVEMENT_REASON_LABELS.BulkImport },
]

export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  'Auth.Unauthorized': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  'Auth.Forbidden': 'Bạn không có quyền thực hiện thao tác quản trị này.',
  'User.AccountInactive': 'Tài khoản của bạn hiện đang bị khóa hoặc ngừng hoạt động.',
  'Category.Forbidden': 'Bạn không có quyền quản lý danh mục.',
  'Category.NotFound': 'Không tìm thấy danh mục.',
  'Category.ParentNotFound': 'Danh mục cha không tồn tại.',
  'Category.SelfParent': 'Danh mục không thể là danh mục cha của chính nó.',
  'Category.CycleDetected':
    'Không thể thiết lập danh mục cha vì sẽ tạo thành vòng lặp phân cấp.',
  'Category.ComponentTypeMismatch':
    'Loại linh kiện của danh mục con phải trùng khớp với danh mục cha.',
  'Category.HasProducts':
    'Không thể thực hiện thao tác vì danh mục đang chứa sản phẩm.',
  'Category.HasSubCategories':
    'Không thể thực hiện thao tác vì danh mục đang có danh mục con.',
  'Category.InvalidSlug': 'Không thể tạo đường dẫn (slug) hợp lệ từ tên danh mục.',
  'Category.SlugConflict': 'Danh mục với tên hoặc đường dẫn (slug) này đã tồn tại.',
  'Product.Forbidden': 'Bạn không có quyền quản lý sản phẩm.',
  'Product.NotFound': 'Không tìm thấy sản phẩm.',
  'Product.CategoryNotFound': 'Danh mục đã chọn không tồn tại.',
  'Product.CategoryComponentTypeMismatch':
    'Loại linh kiện của sản phẩm không trùng khớp với danh mục đã chọn.',
  'Product.SkuConflict': 'Mã SKU này đã tồn tại trên một sản phẩm khác.',
  'Product.SlugConflict': 'Tên sản phẩm tạo ra đường dẫn (slug) trùng với sản phẩm đã có.',
  'Product.InvalidSlug': 'Không thể tạo đường dẫn (slug) hợp lệ từ tên sản phẩm.',
  'Product.ConcurrencyConflict':
    'Sản phẩm vừa được cập nhật ở một phiên khác. Vui lòng tải lại dữ liệu mới nhất.',
  'Inventory.ProductNotFound': 'Không tìm thấy sản phẩm cần điều chỉnh tồn kho.',
  'Inventory.StockConflict':
    'Số lượng tồn kho trên hệ thống đã thay đổi. Hệ thống đã tải lại tồn kho mới nhất, vui lòng kiểm tra và xác nhận lại.',
  'Inventory.InsufficientStock':
    'Số lượng tồn kho hiện tại không đủ để giảm theo mức yêu cầu.',
  'Inventory.StockOverflow':
    'Số lượng tồn kho sau điều chỉnh vượt quá giới hạn tối đa cho phép.',
  'Inventory.InvalidDelta': 'Biến động tồn kho phải là số nguyên khác 0.',
  'Inventory.InvalidNote':
    'Ghi chú lý do điều chỉnh kho là bắt buộc và phải từ 3 đến 500 ký tự.',
}

export function mapAdminApiError(
  err: unknown,
  fallback = 'Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.'
): string {
  if (err instanceof ApiError) {
    if (err.code && ADMIN_ERROR_MESSAGES[err.code]) {
      return ADMIN_ERROR_MESSAGES[err.code]
    }
    if (err.description && err.description.trim().length > 0) {
      return err.description.trim()
    }
    if (err.message && err.message.trim().length > 0) {
      return err.message.trim()
    }
  }
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.trim()
  }
  return fallback
}
