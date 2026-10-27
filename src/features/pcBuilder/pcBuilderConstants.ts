import { ComponentType } from '../products/productTypes'

/**
 * Thứ tự hiển thị 9 nhóm linh kiện trong PC Builder theo đặc tả
 */
export const PC_BUILDER_SLOT_ORDER: ComponentType[] = [
  ComponentType.CPU,
  ComponentType.Motherboard,
  ComponentType.GPU,
  ComponentType.RAM,
  ComponentType.Storage,
  ComponentType.PSU,
  ComponentType.Case,
  ComponentType.Cooler,
  ComponentType.Accessory,
]

/**
 * Các linh kiện bắt buộc để cấu hình được xem là một hệ thống hoàn chỉnh (isCompleteSystem = true)
 */
export const REQUIRED_COMPONENT_TYPES: Set<ComponentType> = new Set([
  ComponentType.CPU,
  ComponentType.Motherboard,
  ComponentType.RAM,
  ComponentType.Storage,
  ComponentType.PSU,
  ComponentType.Case,
])

/**
 * Các nhóm linh kiện cho phép chọn nhiều sản phẩm khác nhau hoặc số lượng > 1 (1..20)
 */
export const MULTI_CHOICE_COMPONENT_TYPES: Set<ComponentType> = new Set([
  ComponentType.RAM,
  ComponentType.Storage,
  ComponentType.Accessory,
])

/**
 * Giới hạn tối đa số dòng linh kiện trong một cấu hình
 */
export const MAX_BUILD_ITEMS = 30

/**
 * Giới hạn số lượng tối đa cho mỗi dòng linh kiện multi-choice
 */
export const MAX_MULTI_CHOICE_QUANTITY = 20

/**
 * Số lượng tối thiểu
 */
export const MIN_QUANTITY = 1

/**
 * Kiểm tra linh kiện có phải là single-choice hay không (quantity luôn là 1)
 */
export function isSingleChoiceComponent(type: ComponentType): boolean {
  return !MULTI_CHOICE_COMPONENT_TYPES.has(type)
}

/**
 * Kiểm tra linh kiện có bắt buộc cho một dàn máy hoàn chỉnh hay không
 */
export function isRequiredComponent(type: ComponentType): boolean {
  return REQUIRED_COMPONENT_TYPES.has(type)
}

/**
 * Mapping các mã lỗi Backend sang tiếng Việt thân thiện
 */
export const PC_BUILDER_ERROR_MESSAGES: Record<string, string> = {
  'PCBuild.EmptyItems': 'Danh sách linh kiện không được để trống.',
  'PCBuild.TooManyItems': 'Cấu hình không được vượt quá 30 linh kiện.',
  'PCBuild.InvalidProductId': 'Mã linh kiện không hợp lệ.',
  'PCBuild.InvalidQuantity': 'Số lượng linh kiện không hợp lệ (từ 1 đến 20).',
  'PCBuild.DuplicateProduct': 'Linh kiện bị trùng lặp trong cấu hình.',
  'PCBuild.ProductNotFound': 'Không tìm thấy thông tin một số linh kiện đã chọn.',
  'PCBuild.MultipleSingleChoiceComponents':
    'Chỉ được chọn 1 sản phẩm cho linh kiện đơn lẻ (CPU, Mainboard, GPU, Nguồn, Case, Tản nhiệt).',
  'PCBuild.InvalidSingleChoiceQuantity': 'Số lượng của linh kiện đơn lẻ phải bằng 1.',
}
