import { ComponentType } from '../products/productTypes'
import type { PCBuilderTechnicalFilterState } from './pcBuilderTypes'

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
  'PCBuild.Forbidden': 'Chỉ tài khoản khách hàng (Customer) mới có thể lưu và quản lý cấu hình PC.',
  'PCBuild.NotFound': 'Không tìm thấy cấu hình PC đã lưu.',
  'PCBuild.EmptyBuild': 'Cấu hình PC không có linh kiện nào.',
}

/**
 * Key dùng lưu cấu hình tạm vào sessionStorage khi khách vãng lai bấm Lưu để đăng nhập
 */
export const PC_BUILDER_GUEST_STORAGE_KEY = 'riutek_pc_builder_guest_items_v1'

/**
 * Thời gian sống của dữ liệu cấu hình lưu tạm (1 giờ)
 */
export const PC_BUILDER_GUEST_STORAGE_TTL_MS = 60 * 60 * 1000

/**
 * Lọc ra chính xác các field kỹ thuật áp dụng cho slot hiện tại để đảm bảo không gửi field thừa lên Backend
 */
export function getSlotApplicableTechnicalFilters(
  activeSlot: ComponentType,
  filters: PCBuilderTechnicalFilterState
): Partial<PCBuilderTechnicalFilterState> {
  const result: Partial<PCBuilderTechnicalFilterState> = {}

  if (filters.brands && filters.brands.length > 0) {
    result.brands = filters.brands
  }

  switch (activeSlot) {
    case ComponentType.CPU:
      if (filters.socket !== undefined) result.socket = filters.socket
      if (filters.sockets && filters.sockets.length > 0) result.sockets = filters.sockets
      if (filters.memoryType !== undefined) result.memoryType = filters.memoryType
      if (filters.memoryTypes && filters.memoryTypes.length > 0) result.memoryTypes = filters.memoryTypes
      if (filters.coreCounts && filters.coreCounts.length > 0) result.coreCounts = filters.coreCounts
      if (typeof filters.hasIntegratedGpu === 'boolean') {
        result.hasIntegratedGpu = filters.hasIntegratedGpu
      }
      break

    case ComponentType.Motherboard:
      if (filters.socket !== undefined) result.socket = filters.socket
      if (filters.sockets && filters.sockets.length > 0) result.sockets = filters.sockets
      if (filters.memoryType !== undefined) result.memoryType = filters.memoryType
      if (filters.memoryTypes && filters.memoryTypes.length > 0) result.memoryTypes = filters.memoryTypes
      if (filters.motherboardFormFactor !== undefined) {
        result.motherboardFormFactor = filters.motherboardFormFactor
      }
      if (filters.motherboardFormFactors && filters.motherboardFormFactors.length > 0) {
        result.motherboardFormFactors = filters.motherboardFormFactors
      }
      if (typeof filters.hasWifi === 'boolean') {
        result.hasWifi = filters.hasWifi
      }
      break

    case ComponentType.GPU:
      if (filters.vramGbs && filters.vramGbs.length > 0) result.vramGbs = filters.vramGbs
      if (filters.gpuLengthsMm && filters.gpuLengthsMm.length > 0) result.gpuLengthsMm = filters.gpuLengthsMm
      if (typeof filters.requires12VHPWR === 'boolean') {
        result.requires12VHPWR = filters.requires12VHPWR
      }
      break

    case ComponentType.RAM:
      if (filters.memoryType !== undefined) result.memoryType = filters.memoryType
      if (filters.memoryTypes && filters.memoryTypes.length > 0) result.memoryTypes = filters.memoryTypes
      if (filters.ramFormFactor !== undefined) result.ramFormFactor = filters.ramFormFactor
      if (filters.ramFormFactors && filters.ramFormFactors.length > 0) result.ramFormFactors = filters.ramFormFactors
      if (filters.ramCapacitiesGb && filters.ramCapacitiesGb.length > 0) result.ramCapacitiesGb = filters.ramCapacitiesGb
      if (filters.ramSpeedsMhz && filters.ramSpeedsMhz.length > 0) result.ramSpeedsMhz = filters.ramSpeedsMhz
      if (typeof filters.hasRgb === 'boolean') {
        result.hasRgb = filters.hasRgb
      }
      break

    case ComponentType.Storage:
      if (filters.storageType !== undefined) result.storageType = filters.storageType
      if (filters.storageTypes && filters.storageTypes.length > 0) result.storageTypes = filters.storageTypes
      if (filters.storageInterface !== undefined) {
        result.storageInterface = filters.storageInterface
      }
      if (filters.storageInterfaces && filters.storageInterfaces.length > 0) {
        result.storageInterfaces = filters.storageInterfaces
      }
      if (filters.storageCapacitiesGb && filters.storageCapacitiesGb.length > 0) {
        result.storageCapacitiesGb = filters.storageCapacitiesGb
      }
      break

    case ComponentType.PSU:
      if (filters.psuEfficiency !== undefined) result.psuEfficiency = filters.psuEfficiency
      if (filters.psuEfficiencies && filters.psuEfficiencies.length > 0) result.psuEfficiencies = filters.psuEfficiencies
      if (filters.psuModularity !== undefined) result.psuModularity = filters.psuModularity
      if (filters.psuModularities && filters.psuModularities.length > 0) result.psuModularities = filters.psuModularities
      if (filters.psuFormFactor !== undefined) result.psuFormFactor = filters.psuFormFactor
      if (filters.psuFormFactors && filters.psuFormFactors.length > 0) result.psuFormFactors = filters.psuFormFactors
      if (filters.psuWattages && filters.psuWattages.length > 0) result.psuWattages = filters.psuWattages
      if (typeof filters.has12VHPWR === 'boolean') {
        result.has12VHPWR = filters.has12VHPWR
      }
      break

    case ComponentType.Case:
      if (filters.motherboardFormFactor !== undefined) {
        result.motherboardFormFactor = filters.motherboardFormFactor
      }
      if (filters.motherboardFormFactors && filters.motherboardFormFactors.length > 0) {
        result.motherboardFormFactors = filters.motherboardFormFactors
      }
      break

    case ComponentType.Cooler:
      if (filters.socket !== undefined) result.socket = filters.socket
      if (filters.sockets && filters.sockets.length > 0) result.sockets = filters.sockets
      if (filters.coolerType !== undefined) result.coolerType = filters.coolerType
      if (filters.coolerTypes && filters.coolerTypes.length > 0) result.coolerTypes = filters.coolerTypes
      if (typeof filters.hasRgb === 'boolean') {
        result.hasRgb = filters.hasRgb
      }
      break

    case ComponentType.Accessory:
    default:
      // Không có technical filters cho Accessory
      break
  }

  return result
}
