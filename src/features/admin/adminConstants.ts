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
  'ProductImport.MissingFile': 'File Excel tải lên không được để trống.',
  'ProductImport.InvalidFileExtension': 'Chỉ chấp nhận file Excel định dạng .xlsx.',
  'ProductImport.FileTooLarge': 'Dung lượng file Excel không được vượt quá 5 MiB.',
  'ProductImport.ImageMappingsTooLarge':
    'Dữ liệu ánh xạ ảnh (imageMappings) vượt quá giới hạn 512 KiB.',
  'ProductImport.InvalidImageMappingsJson':
    'Dữ liệu ánh xạ ảnh (imageMappings) không đúng định dạng JSON hợp lệ.',
  'ProductImport.TooManyImageMappings':
    'Số lượng SKU trong danh sách ánh xạ ảnh vượt quá giới hạn 1.000 SKU.',
  'ProductImport.TooManyObjectKeys':
    'Tổng số lượng ảnh trong danh sách ánh xạ vượt quá giới hạn 11.000 tệp.',
  'ProductImport.DuplicateImageMappingSku':
    'Mã SKU bị lặp lại trong danh sách ánh xạ ảnh.',
  'ProductImport.UnknownImageMappingSku':
    'Mã SKU trong danh sách ánh xạ ảnh không tồn tại trong sheet Products.',
  'ProductImport.MissingPrimaryObjectKey':
    'SKU trong danh sách ánh xạ ảnh thiếu ảnh chính (primaryObjectKey).',
  'ProductImport.InvalidObjectKey':
    'ObjectKey của ảnh không hợp lệ hoặc nằm ngoài thư mục quản lý.',
  'ProductImport.TooManyAdditionalImages':
    'Mỗi SKU chỉ được phép gắn tối đa 10 ảnh phụ.',
  'ProductImport.DuplicateObjectKey':
    'ObjectKey ảnh phụ bị trùng với ảnh chính hoặc ảnh phụ khác của cùng SKU.',
  'ProductImport.MediaNotFound':
    'Không tìm thấy file ảnh đã tải lên trên kho lưu trữ R2.',
  'ProductImport.InvalidMediaMetadata':
    'Định dạng MIME hoặc dung lượng của ảnh trên kho lưu trữ không hợp lệ.',
  'ProductImport.StaleValidation':
    'Danh mục hoặc dữ liệu workbook đã thay đổi. Vui lòng kiểm tra (validate) lại trước khi import.',
  'ProductImport.ConcurrentConflict':
    'SKU hoặc đường dẫn (slug) vừa được tạo bởi một yêu cầu khác. Không có sản phẩm nào trong lô được tạo.',
  'ProductMedia.StorageDisabled':
    'Dịch vụ lưu trữ ảnh sản phẩm (Cloudflare R2) chưa được cấu hình hoặc đang tạm ngưng.',
  'ProductMedia.StorageUnavailable':
    'Không thể kết nối tới dịch vụ lưu trữ ảnh sản phẩm (Cloudflare R2). Vui lòng thử lại sau.',
  'ProductMedia.FileTooLarge':
    'Dung lượng file ảnh vượt quá giới hạn cho phép của kho lưu trữ (tối đa 5 MiB).',
  'ProductMedia.InvalidKey': 'Mã đối tượng ảnh (ObjectKey) không hợp lệ.',
  'ProductMedia.InvalidMetadata':
    'Metadata hoặc định dạng của file ảnh tải lên không hợp lệ.',
  'ProductMedia.NotFound':
    'Không tìm thấy file ảnh trên kho lưu trữ R2 để xác nhận.',
}

export function mapAdminApiError(
  err: unknown,
  fallback = 'Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại.'
): string {
  if (err instanceof ApiError) {
    if (err.code && ADMIN_ERROR_MESSAGES[err.code]) {
      return `${ADMIN_ERROR_MESSAGES[err.code]}${
        err.description && err.description !== ADMIN_ERROR_MESSAGES[err.code]
          ? ` (${err.description})`
          : ''
      }`
    }
    if (err.description && err.description.trim().length > 0) {
      return err.code
        ? `[${err.code}] ${err.description.trim()}`
        : err.description.trim()
    }
    if (
      err.problemDetails?.errors &&
      Object.keys(err.problemDetails.errors).length > 0
    ) {
      const messages = Object.values(err.problemDetails.errors)
        .flat()
        .filter((m) => typeof m === 'string' && m.trim().length > 0)
      if (messages.length > 0) {
        return messages.join(' ')
      }
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