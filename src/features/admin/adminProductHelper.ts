import { ApiError } from '../../lib/api'
import {
  ComponentType,
  CoolerType,
  CpuSocket,
  MotherboardFormFactor,
  PsuEfficiency,
  PsuFormFactor,
  PsuModularity,
  RamFormFactor,
  RamType,
  StorageInterface,
  StorageType,
  type AccessorySpecification,
  type CaseSpecification,
  type ComponentSpecification,
  type CoolerSpecification,
  type CpuSpecification,
  type GpuSpecification,
  type MotherboardSpecification,
  type ProductDetail,
  type PsuSpecification,
  type RamSpecification,
  type StorageSpecification,
} from '../products/productTypes'
import { isValidUuid } from './adminApi'
import { isValidComponentType } from './adminCategoryHelper'
import { mapAdminApiError } from './adminConstants'
import type {
  AccessorySpecDraft,
  AdjustStockRequest,
  AnySpecificationDraft,
  CaseSpecDraft,
  CoolerSpecDraft,
  CpuSpecDraft,
  CreateProductRequest,
  FlattenedCategoryNode,
  GpuSpecDraft,
  MotherboardSpecDraft,
  ProductFormDraft,
  PsuSpecDraft,
  RamSpecDraft,
  StockAdjustmentResultDto,
  StorageSpecDraft,
  UpdateProductRequest,
} from './adminTypes'

const MAX_INT32 = 2147483647

const VALID_CPU_SOCKETS = new Set<number>([
  CpuSocket.LGA1700,
  CpuSocket.LGA1851,
  CpuSocket.LGA1200,
  CpuSocket.AM4,
  CpuSocket.AM5,
  CpuSocket.TR4,
  CpuSocket.sTRX4,
  CpuSocket.Other,
])

const VALID_RAM_TYPES = new Set<number>([
  RamType.DDR4,
  RamType.DDR5,
  RamType.DDR3,
  RamType.LPDDR5,
])

const VALID_RAM_FORM_FACTORS = new Set<number>([
  RamFormFactor.DIMM,
  RamFormFactor.SODIMM,
])

const VALID_MB_FORM_FACTORS = new Set<number>([
  MotherboardFormFactor.ATX,
  MotherboardFormFactor.MicroATX,
  MotherboardFormFactor.MiniITX,
  MotherboardFormFactor.EATX,
])

const VALID_STORAGE_TYPES = new Set<number>([
  StorageType.NVMeM2,
  StorageType.SataSSD,
  StorageType.Hdd35,
  StorageType.Hdd25,
])

const VALID_STORAGE_INTERFACES = new Set<number>([
  StorageInterface.PCIe30,
  StorageInterface.PCIe40,
  StorageInterface.PCIe50,
  StorageInterface.SATA3,
])

const VALID_PSU_EFFICIENCIES = new Set<number>([
  PsuEfficiency.Plus80,
  PsuEfficiency.Plus80Bronze,
  PsuEfficiency.Plus80Silver,
  PsuEfficiency.Plus80Gold,
  PsuEfficiency.Plus80Platinum,
  PsuEfficiency.Plus80Titanium,
])

const VALID_PSU_MODULARITIES = new Set<number>([
  PsuModularity.NonModular,
  PsuModularity.SemiModular,
  PsuModularity.FullModular,
])

const VALID_PSU_FORM_FACTORS = new Set<number>([
  PsuFormFactor.ATX,
  PsuFormFactor.SFX,
  PsuFormFactor.SFXL,
  PsuFormFactor.TFX,
])

const VALID_COOLER_TYPES = new Set<number>([
  CoolerType.Air,
  CoolerType.AIO120,
  CoolerType.AIO240,
  CoolerType.AIO280,
  CoolerType.AIO360,
  CoolerType.AIO420,
  CoolerType.CustomLoop,
])

export function isAioCoolerType(coolerType: number): boolean {
  return (
    coolerType === CoolerType.AIO120 ||
    coolerType === CoolerType.AIO240 ||
    coolerType === CoolerType.AIO280 ||
    coolerType === CoolerType.AIO360 ||
    coolerType === CoolerType.AIO420
  )
}

function parseStrictInt(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && Number.isFinite(raw) ? raw : null
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed || !/^-?\d+$/.test(trimmed)) return null
  const num = Number(trimmed)
  if (!Number.isSafeInteger(num) || num > MAX_INT32 || num < -MAX_INT32) {
    return null
  }
  return num
}

function parseStrictFloat(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

/**
 * Kiểm tra URL ảnh hợp lệ theo đúng rule backend BeAValidHttpsUrl + MaxLength(1000).
 */
export function isValidHttpsUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > 1000) return false
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Chuẩn hóa danh sách ảnh phụ khớp với ProductMediaHelper.NormalizeAdditionalImages:
 * - Trim từng URL, bỏ chuỗi rỗng
 * - Loại bỏ URL trùng với ảnh chính (case-insensitive) hoặc trùng lặp với ảnh phụ trước đó
 * - Giữ nguyên thứ tự xuất hiện đầu tiên
 */
export function normalizeAdditionalImages(
  primaryImageUrl: string,
  additionalImages: string[]
): string[] {
  const normalizedPrimary = (primaryImageUrl ?? '').trim()
  const seen = new Set<string>()
  if (normalizedPrimary) {
    seen.add(normalizedPrimary.toLowerCase())
  }

  const result: string[] = []
  if (!Array.isArray(additionalImages)) return result

  for (const raw of additionalImages) {
    const candidate = typeof raw === 'string' ? raw.trim() : ''
    if (!candidate) continue
    const lower = candidate.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)
    result.push(candidate)
  }

  return result
}

export interface ProductMediaValidationResult {
  isValid: boolean
  imageUrlError?: string
  additionalImagesError?: string
  normalizedImageUrl: string
  normalizedAdditionalImages: string[]
}

/**
 * Validate ảnh chính và danh sách ảnh phụ theo đúng CreateProductCommandValidator / UpdateProductCommandValidator:
 * - imageUrl bắt buộc, <= 1000 ký tự, HTTPS hợp lệ
 * - additionalImages: không chứa phần tử rỗng nếu người dùng đang thêm dòng trống chưa xóa?
 *   Lưu ý: loại bỏ dòng trống hoàn toàn trước khi kiểm tra hoặc báo lỗi nếu URL không hợp lệ,
 *   không được trùng với imageUrl (báo lỗi rõ ràng), tối đa 10 URL sau chuẩn hóa, mỗi URL <= 1000 ký tự và là HTTPS.
 */
export function validateProductMedia(
  primaryImageUrl: string,
  additionalImages: string[]
): ProductMediaValidationResult {
  const normalizedImageUrl = (primaryImageUrl ?? '').trim()
  let imageUrlError: string | undefined
  let additionalImagesError: string | undefined

  if (!normalizedImageUrl) {
    imageUrlError = 'URL hình ảnh chính không được để trống.'
  } else if (normalizedImageUrl.length > 1000) {
    imageUrlError = 'URL hình ảnh chính không được vượt quá 1000 ký tự.'
  } else if (!isValidHttpsUrl(normalizedImageUrl)) {
    imageUrlError = 'URL hình ảnh chính phải bắt đầu bằng https:// và hợp lệ.'
  }

  const nonEmptyGallery = (Array.isArray(additionalImages) ? additionalImages : [])
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0)

  const seenGallery = new Set<string>()
  const normalizedAdditionalImages: string[] = []

  for (let i = 0; i < nonEmptyGallery.length; i++) {
    const url = nonEmptyGallery[i]
    if (url.length > 1000) {
      additionalImagesError = `Ảnh phụ #${i + 1} vượt quá 1000 ký tự.`
      break
    }
    if (!isValidHttpsUrl(url)) {
      additionalImagesError = `Ảnh phụ #${i + 1} phải là URL hợp lệ bắt đầu bằng https://.`
      break
    }
    if (
      normalizedImageUrl &&
      url.toLowerCase() === normalizedImageUrl.toLowerCase()
    ) {
      additionalImagesError = `Ảnh phụ #${i + 1} không được trùng với ảnh chính.`
      break
    }
    const lower = url.toLowerCase()
    if (seenGallery.has(lower)) {
      continue
    }
    seenGallery.add(lower)
    normalizedAdditionalImages.push(url)
  }

  if (!additionalImagesError && normalizedAdditionalImages.length > 10) {
    additionalImagesError = 'Danh sách ảnh phụ tối đa 10 hình ảnh.'
  }

  return {
    isValid: !imageUrlError && !additionalImagesError,
    imageUrlError,
    additionalImagesError,
    normalizedImageUrl,
    normalizedAdditionalImages,
  }
}

export function moveGalleryImage(
  images: string[],
  index: number,
  direction: 'up' | 'down'
): string[] {
  if (!Array.isArray(images)) return []
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (
    index < 0 ||
    index >= images.length ||
    targetIndex < 0 ||
    targetIndex >= images.length
  ) {
    return [...images]
  }
  const next = [...images]
  const temp = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = temp
  return next
}

/**
 * Khởi tạo draft thông số kỹ thuật rỗng cho từng ComponentType (1..9).
 * Tuyệt đối không tự bịa giá trị phần cứng mặc định (mọi số/enum/string để '', mảng để [], boolean để false).
 */
export function createEmptySpecificationDraft(
  componentType: ComponentType
): AnySpecificationDraft {
  switch (componentType) {
    case ComponentType.CPU:
      return {
        socket: '',
        coreCount: '',
        threadCount: '',
        baseClockGhz: '',
        boostClockGhz: '',
        tdpWattage: '',
        hasIntegratedGpu: false,
        supportedMemoryType: '',
        maxMemorySpeedMhz: '',
      } satisfies CpuSpecDraft
    case ComponentType.Motherboard:
      return {
        socket: '',
        chipset: '',
        formFactor: '',
        memoryType: '',
        memorySlots: '',
        maxMemoryCapacityGb: '',
        m2Slots: '',
        sataPorts: '',
        pcieSlots: '',
        hasWifi: false,
      } satisfies MotherboardSpecDraft
    case ComponentType.GPU:
      return {
        chipset: '',
        vramGb: '',
        vramType: '',
        lengthMm: '',
        slotWidth: '',
        tdpWattage: '',
        recommendedPsuWattage: '',
        requires12VHPWR: false,
        powerConnectors: '',
      } satisfies GpuSpecDraft
    case ComponentType.RAM:
      return {
        memoryType: '',
        formFactor: '',
        capacityGb: '',
        moduleCount: '',
        speedMhz: '',
        casLatency: '',
        hasRgb: false,
      } satisfies RamSpecDraft
    case ComponentType.Storage:
      return {
        storageType: '',
        interface: '',
        capacityGb: '',
        readSpeedMBs: '',
        writeSpeedMBs: '',
        formFactor: '',
      } satisfies StorageSpecDraft
    case ComponentType.PSU:
      return {
        wattage: '',
        efficiency: '',
        modularity: '',
        formFactor: '',
        has12VHPWR: false,
        lengthMm: '',
      } satisfies PsuSpecDraft
    case ComponentType.Case:
      return {
        supportedFormFactors: [],
        maxGpuLengthMm: '',
        maxCpuCoolerHeightMm: '',
        maxPsuLengthMm: '',
        supportedRadiatorSizesMm: '',
        includedFans: '',
      } satisfies CaseSpecDraft
    case ComponentType.Cooler:
      return {
        coolerType: '',
        supportedSockets: [],
        heightMm: '',
        radiatorSizeMm: '',
        maxTdpRating: '',
        hasRgb: false,
      } satisfies CoolerSpecDraft
    case ComponentType.Accessory:
      return {
        details: '',
      } satisfies AccessorySpecDraft
  }
}

/**
 * Chuyển đổi ComponentSpecification từ backend sang draft để hiển thị trong form Edit.
 */
export function mapSpecificationToDraft(
  spec: ComponentSpecification
): AnySpecificationDraft {
  switch (spec.$type) {
    case 'cpu':
      return {
        socket: String(spec.socket),
        coreCount: String(spec.coreCount),
        threadCount: String(spec.threadCount),
        baseClockGhz: String(spec.baseClockGhz),
        boostClockGhz: String(spec.boostClockGhz),
        tdpWattage: String(spec.tdpWattage),
        hasIntegratedGpu: Boolean(spec.hasIntegratedGpu),
        supportedMemoryType: String(spec.supportedMemoryType),
        maxMemorySpeedMhz: String(spec.maxMemorySpeedMhz),
      } satisfies CpuSpecDraft
    case 'motherboard':
      return {
        socket: String(spec.socket),
        chipset: spec.chipset ?? '',
        formFactor: String(spec.formFactor),
        memoryType: String(spec.memoryType),
        memorySlots: String(spec.memorySlots),
        maxMemoryCapacityGb: String(spec.maxMemoryCapacityGb),
        m2Slots: String(spec.m2Slots),
        sataPorts: String(spec.sataPorts),
        pcieSlots: String(spec.pcieSlots),
        hasWifi: Boolean(spec.hasWifi),
      } satisfies MotherboardSpecDraft
    case 'gpu':
      return {
        chipset: spec.chipset ?? '',
        vramGb: String(spec.vramGb),
        vramType: spec.vramType ?? '',
        lengthMm: String(spec.lengthMm),
        slotWidth: String(spec.slotWidth),
        tdpWattage: String(spec.tdpWattage),
        recommendedPsuWattage: String(spec.recommendedPsuWattage),
        requires12VHPWR: Boolean(spec.requires12VHPWR),
        powerConnectors: spec.powerConnectors ?? '',
      } satisfies GpuSpecDraft
    case 'ram':
      return {
        memoryType: String(spec.memoryType),
        formFactor: String(spec.formFactor),
        capacityGb: String(spec.capacityGb),
        moduleCount: String(spec.moduleCount),
        speedMhz: String(spec.speedMhz),
        casLatency: String(spec.casLatency),
        hasRgb: Boolean(spec.hasRgb),
      } satisfies RamSpecDraft
    case 'storage':
      return {
        storageType: String(spec.storageType),
        interface: String(spec.interface),
        capacityGb: String(spec.capacityGb),
        readSpeedMBs: String(spec.readSpeedMBs),
        writeSpeedMBs: String(spec.writeSpeedMBs),
        formFactor: spec.formFactor ?? '',
      } satisfies StorageSpecDraft
    case 'psu':
      return {
        wattage: String(spec.wattage),
        efficiency: String(spec.efficiency),
        modularity: String(spec.modularity),
        formFactor: String(spec.formFactor),
        has12VHPWR: Boolean(spec.has12VHPWR),
        lengthMm: String(spec.lengthMm),
      } satisfies PsuSpecDraft
    case 'case':
      return {
        supportedFormFactors: Array.isArray(spec.supportedFormFactors)
          ? [...spec.supportedFormFactors]
          : [],
        maxGpuLengthMm: String(spec.maxGpuLengthMm),
        maxCpuCoolerHeightMm: String(spec.maxCpuCoolerHeightMm),
        maxPsuLengthMm: String(spec.maxPsuLengthMm),
        supportedRadiatorSizesMm: Array.isArray(spec.supportedRadiatorSizesMm)
          ? spec.supportedRadiatorSizesMm.join(', ')
          : '',
        includedFans: String(spec.includedFans),
      } satisfies CaseSpecDraft
    case 'cooler':
      return {
        coolerType: String(spec.coolerType),
        supportedSockets: Array.isArray(spec.supportedSockets)
          ? [...spec.supportedSockets]
          : [],
        heightMm: String(spec.heightMm),
        radiatorSizeMm: String(spec.radiatorSizeMm),
        maxTdpRating: String(spec.maxTdpRating),
        hasRgb: Boolean(spec.hasRgb),
      } satisfies CoolerSpecDraft
    case 'accessory':
      return {
        details: spec.details ?? '',
      } satisfies AccessorySpecDraft
  }
}

/**
 * Kiểm tra xem thông số kỹ thuật hiện tại có khác với trạng thái rỗng ban đầu hay không.
 */
export function isSpecificationDraftDirty(
  specDraft: AnySpecificationDraft,
  componentType: ComponentType
): boolean {
  const empty = createEmptySpecificationDraft(componentType)
  return JSON.stringify(specDraft) !== JSON.stringify(empty)
}

export interface SpecificationValidationResult {
  isValid: boolean
  errors: Record<string, string>
  specification: ComponentSpecification | null
}

/**
 * Validate và build payload specifications có $type discriminator chuẩn cho cả 9 loại linh kiện,
 * khớp 100% với ComponentSpecificationValidator.cs ở Backend.
 */
export function validateAndBuildSpecification(
  componentType: ComponentType,
  specDraft: AnySpecificationDraft
): SpecificationValidationResult {
  const errors: Record<string, string> = {}

  switch (componentType) {
    case ComponentType.CPU: {
      const d = specDraft as CpuSpecDraft
      const socket = parseStrictInt(d.socket)
      if (socket === null || !VALID_CPU_SOCKETS.has(socket)) {
        errors['spec.socket'] = 'Vui lòng chọn socket CPU hợp lệ.'
      }

      const coreCount = parseStrictInt(d.coreCount)
      if (coreCount === null || coreCount <= 0) {
        errors['spec.coreCount'] = 'Số nhân CPU phải là số nguyên lớn hơn 0.'
      }

      const threadCount = parseStrictInt(d.threadCount)
      if (threadCount === null || threadCount <= 0) {
        errors['spec.threadCount'] = 'Số luồng CPU phải là số nguyên lớn hơn 0.'
      }

      const baseClockGhz = parseStrictFloat(d.baseClockGhz)
      if (baseClockGhz === null || baseClockGhz <= 0) {
        errors['spec.baseClockGhz'] = 'Xung nhịp cơ bản phải lớn hơn 0 GHz.'
      }

      const boostClockGhz = parseStrictFloat(d.boostClockGhz)
      if (boostClockGhz === null || boostClockGhz <= 0) {
        errors['spec.boostClockGhz'] = 'Xung nhịp boost phải lớn hơn 0 GHz.'
      } else if (baseClockGhz !== null && boostClockGhz < baseClockGhz) {
        errors['spec.boostClockGhz'] =
          'Xung nhịp boost phải lớn hơn hoặc bằng xung nhịp cơ bản.'
      }

      const tdpWattage = parseStrictInt(d.tdpWattage)
      if (tdpWattage === null || tdpWattage <= 0) {
        errors['spec.tdpWattage'] = 'TDP phải là số nguyên lớn hơn 0 W.'
      }

      const supportedMemoryType = parseStrictInt(d.supportedMemoryType)
      if (
        supportedMemoryType === null ||
        !VALID_RAM_TYPES.has(supportedMemoryType)
      ) {
        errors['spec.supportedMemoryType'] =
          'Vui lòng chọn loại bộ nhớ RAM hỗ trợ.'
      }

      const maxMemorySpeedMhz = parseStrictInt(d.maxMemorySpeedMhz)
      if (maxMemorySpeedMhz === null || maxMemorySpeedMhz <= 0) {
        errors['spec.maxMemorySpeedMhz'] =
          'Tốc độ RAM tối đa phải là số nguyên lớn hơn 0 MHz.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: CpuSpecification = {
        $type: 'cpu',
        componentType: 1,
        socket: socket as CpuSocket,
        coreCount: coreCount!,
        threadCount: threadCount!,
        baseClockGhz: baseClockGhz!,
        boostClockGhz: boostClockGhz!,
        tdpWattage: tdpWattage!,
        hasIntegratedGpu: Boolean(d.hasIntegratedGpu),
        supportedMemoryType: supportedMemoryType as RamType,
        maxMemorySpeedMhz: maxMemorySpeedMhz!,
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.Motherboard: {
      const d = specDraft as MotherboardSpecDraft
      const socket = parseStrictInt(d.socket)
      if (socket === null || !VALID_CPU_SOCKETS.has(socket)) {
        errors['spec.socket'] = 'Vui lòng chọn socket bo mạch chủ hợp lệ.'
      }

      const chipset = (d.chipset ?? '').trim()
      if (!chipset) {
        errors['spec.chipset'] = 'Chipset bo mạch chủ là bắt buộc.'
      }

      const formFactor = parseStrictInt(d.formFactor)
      if (formFactor === null || !VALID_MB_FORM_FACTORS.has(formFactor)) {
        errors['spec.formFactor'] = 'Vui lòng chọn kích thước (Form Factor) hợp lệ.'
      }

      const memoryType = parseStrictInt(d.memoryType)
      if (memoryType === null || !VALID_RAM_TYPES.has(memoryType)) {
        errors['spec.memoryType'] = 'Vui lòng chọn loại RAM hỗ trợ.'
      }

      const memorySlots = parseStrictInt(d.memorySlots)
      if (memorySlots === null || memorySlots <= 0) {
        errors['spec.memorySlots'] = 'Số khe RAM phải là số nguyên lớn hơn 0.'
      }

      const maxMemoryCapacityGb = parseStrictInt(d.maxMemoryCapacityGb)
      if (maxMemoryCapacityGb === null || maxMemoryCapacityGb <= 0) {
        errors['spec.maxMemoryCapacityGb'] =
          'Dung lượng RAM tối đa phải là số nguyên lớn hơn 0 GB.'
      }

      const m2Slots = parseStrictInt(d.m2Slots)
      if (m2Slots === null || m2Slots < 0) {
        errors['spec.m2Slots'] = 'Số khe M.2 phải là số nguyên từ 0 trở lên.'
      }

      const sataPorts = parseStrictInt(d.sataPorts)
      if (sataPorts === null || sataPorts < 0) {
        errors['spec.sataPorts'] = 'Số cổng SATA phải là số nguyên từ 0 trở lên.'
      }

      const pcieSlots = parseStrictInt(d.pcieSlots)
      if (pcieSlots === null || pcieSlots < 0) {
        errors['spec.pcieSlots'] = 'Số khe PCIe phải là số nguyên từ 0 trở lên.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: MotherboardSpecification = {
        $type: 'motherboard',
        componentType: 2,
        socket: socket as CpuSocket,
        chipset,
        formFactor: formFactor as MotherboardFormFactor,
        memoryType: memoryType as RamType,
        memorySlots: memorySlots!,
        maxMemoryCapacityGb: maxMemoryCapacityGb!,
        m2Slots: m2Slots!,
        sataPorts: sataPorts!,
        pcieSlots: pcieSlots!,
        hasWifi: Boolean(d.hasWifi),
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.GPU: {
      const d = specDraft as GpuSpecDraft
      const chipset = (d.chipset ?? '').trim()
      if (!chipset) {
        errors['spec.chipset'] = 'Chipset GPU là bắt buộc.'
      }

      const vramGb = parseStrictInt(d.vramGb)
      if (vramGb === null || vramGb <= 0) {
        errors['spec.vramGb'] = 'Dung lượng VRAM phải là số nguyên lớn hơn 0 GB.'
      }

      const lengthMm = parseStrictInt(d.lengthMm)
      if (lengthMm === null || lengthMm <= 0) {
        errors['spec.lengthMm'] = 'Chiều dài card phải là số nguyên lớn hơn 0 mm.'
      }

      const slotWidth = parseStrictFloat(d.slotWidth)
      if (slotWidth === null || slotWidth <= 0) {
        errors['spec.slotWidth'] = 'Độ dày (Slot Width) phải lớn hơn 0.'
      }

      const tdpWattage = parseStrictInt(d.tdpWattage)
      if (tdpWattage === null || tdpWattage <= 0) {
        errors['spec.tdpWattage'] = 'TDP của GPU phải là số nguyên lớn hơn 0 W.'
      }

      const recommendedPsuWattage = parseStrictInt(d.recommendedPsuWattage)
      if (recommendedPsuWattage === null || recommendedPsuWattage <= 0) {
        errors['spec.recommendedPsuWattage'] =
          'Công suất nguồn khuyến nghị phải là số nguyên lớn hơn 0 W.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: GpuSpecification = {
        $type: 'gpu',
        componentType: 3,
        chipset,
        vramGb: vramGb!,
        vramType: (d.vramType ?? '').trim(),
        lengthMm: lengthMm!,
        slotWidth: slotWidth!,
        tdpWattage: tdpWattage!,
        recommendedPsuWattage: recommendedPsuWattage!,
        requires12VHPWR: Boolean(d.requires12VHPWR),
        powerConnectors: (d.powerConnectors ?? '').trim(),
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.RAM: {
      const d = specDraft as RamSpecDraft
      const memoryType = parseStrictInt(d.memoryType)
      if (memoryType === null || !VALID_RAM_TYPES.has(memoryType)) {
        errors['spec.memoryType'] = 'Vui lòng chọn chuẩn bộ nhớ RAM.'
      }

      const formFactor = parseStrictInt(d.formFactor)
      if (formFactor === null || !VALID_RAM_FORM_FACTORS.has(formFactor)) {
        errors['spec.formFactor'] = 'Vui lòng chọn kiểu chân cắm RAM (DIMM/SO-DIMM).'
      }

      const capacityGb = parseStrictInt(d.capacityGb)
      if (capacityGb === null || capacityGb <= 0) {
        errors['spec.capacityGb'] = 'Dung lượng RAM phải là số nguyên lớn hơn 0 GB.'
      }

      const moduleCount = parseStrictInt(d.moduleCount)
      if (moduleCount === null || moduleCount <= 0) {
        errors['spec.moduleCount'] = 'Số thanh RAM phải là số nguyên lớn hơn 0.'
      }

      const speedMhz = parseStrictInt(d.speedMhz)
      if (speedMhz === null || speedMhz <= 0) {
        errors['spec.speedMhz'] = 'Tốc độ bus RAM phải là số nguyên lớn hơn 0 MHz.'
      }

      const casLatency = parseStrictInt(d.casLatency)
      if (casLatency === null || casLatency <= 0) {
        errors['spec.casLatency'] = 'Độ trễ CAS (CL) phải là số nguyên lớn hơn 0.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: RamSpecification = {
        $type: 'ram',
        componentType: 4,
        memoryType: memoryType as RamType,
        formFactor: formFactor as RamFormFactor,
        capacityGb: capacityGb!,
        moduleCount: moduleCount!,
        speedMhz: speedMhz!,
        casLatency: casLatency!,
        hasRgb: Boolean(d.hasRgb),
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.Storage: {
      const d = specDraft as StorageSpecDraft
      const storageType = parseStrictInt(d.storageType)
      if (storageType === null || !VALID_STORAGE_TYPES.has(storageType)) {
        errors['spec.storageType'] = 'Vui lòng chọn loại ổ cứng hợp lệ.'
      }

      const storageInterface = parseStrictInt(d.interface)
      if (
        storageInterface === null ||
        !VALID_STORAGE_INTERFACES.has(storageInterface)
      ) {
        errors['spec.interface'] = 'Vui lòng chọn chuẩn giao tiếp ổ cứng hợp lệ.'
      }

      const capacityGb = parseStrictInt(d.capacityGb)
      if (capacityGb === null || capacityGb <= 0) {
        errors['spec.capacityGb'] =
          'Dung lượng lưu trữ phải là số nguyên lớn hơn 0 GB.'
      }

      const readSpeedMBs = parseStrictInt(d.readSpeedMBs)
      if (readSpeedMBs === null || readSpeedMBs < 0) {
        errors['spec.readSpeedMBs'] =
          'Tốc độ đọc phải là số nguyên từ 0 MB/s trở lên.'
      }

      const writeSpeedMBs = parseStrictInt(d.writeSpeedMBs)
      if (writeSpeedMBs === null || writeSpeedMBs < 0) {
        errors['spec.writeSpeedMBs'] =
          'Tốc độ ghi phải là số nguyên từ 0 MB/s trở lên.'
      }

      const formFactor = (d.formFactor ?? '').trim()
      if (!formFactor) {
        errors['spec.formFactor'] =
          'Kích thước ổ cứng (Form Factor, ví dụ: M.2 2280, 2.5") là bắt buộc.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: StorageSpecification = {
        $type: 'storage',
        componentType: 5,
        storageType: storageType as StorageType,
        interface: storageInterface as StorageInterface,
        capacityGb: capacityGb!,
        readSpeedMBs: readSpeedMBs!,
        writeSpeedMBs: writeSpeedMBs!,
        formFactor,
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.PSU: {
      const d = specDraft as PsuSpecDraft
      const wattage = parseStrictInt(d.wattage)
      if (wattage === null || wattage <= 0) {
        errors['spec.wattage'] = 'Công suất nguồn phải là số nguyên lớn hơn 0 W.'
      }

      const efficiency = parseStrictInt(d.efficiency)
      if (efficiency === null || !VALID_PSU_EFFICIENCIES.has(efficiency)) {
        errors['spec.efficiency'] = 'Vui lòng chọn chuẩn hiệu suất 80 Plus.'
      }

      const modularity = parseStrictInt(d.modularity)
      if (modularity === null || !VALID_PSU_MODULARITIES.has(modularity)) {
        errors['spec.modularity'] = 'Vui lòng chọn kiểu cáp nguồn (Modularity).'
      }

      const formFactor = parseStrictInt(d.formFactor)
      if (formFactor === null || !VALID_PSU_FORM_FACTORS.has(formFactor)) {
        errors['spec.formFactor'] = 'Vui lòng chọn chuẩn kích thước nguồn (ATX/SFX).'
      }

      const lengthMm = parseStrictInt(d.lengthMm)
      if (lengthMm === null || lengthMm <= 0) {
        errors['spec.lengthMm'] = 'Chiều dài nguồn phải là số nguyên lớn hơn 0 mm.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: PsuSpecification = {
        $type: 'psu',
        componentType: 6,
        wattage: wattage!,
        efficiency: efficiency as PsuEfficiency,
        modularity: modularity as PsuModularity,
        formFactor: formFactor as PsuFormFactor,
        has12VHPWR: Boolean(d.has12VHPWR),
        lengthMm: lengthMm!,
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.Case: {
      const d = specDraft as CaseSpecDraft
      const rawFactors = Array.isArray(d.supportedFormFactors)
        ? d.supportedFormFactors
        : []
      const uniqueFactors = Array.from(new Set(rawFactors))
      if (uniqueFactors.length === 0) {
        errors['spec.supportedFormFactors'] =
          'Vui lòng chọn ít nhất 1 chuẩn Mainboard hỗ trợ.'
      } else if (
        uniqueFactors.length !== rawFactors.length ||
        uniqueFactors.some((f) => !VALID_MB_FORM_FACTORS.has(f))
      ) {
        errors['spec.supportedFormFactors'] =
          'Danh sách chuẩn Mainboard hỗ trợ không hợp lệ hoặc bị trùng lặp.'
      }

      const maxGpuLengthMm = parseStrictInt(d.maxGpuLengthMm)
      if (maxGpuLengthMm === null || maxGpuLengthMm <= 0) {
        errors['spec.maxGpuLengthMm'] =
          'Chiều dài GPU tối đa phải là số nguyên lớn hơn 0 mm.'
      }

      const maxCpuCoolerHeightMm = parseStrictInt(d.maxCpuCoolerHeightMm)
      if (maxCpuCoolerHeightMm === null || maxCpuCoolerHeightMm <= 0) {
        errors['spec.maxCpuCoolerHeightMm'] =
          'Chiều cao tản nhiệt CPU tối đa phải là số nguyên lớn hơn 0 mm.'
      }

      const maxPsuLengthMm = parseStrictInt(d.maxPsuLengthMm)
      if (maxPsuLengthMm === null || maxPsuLengthMm <= 0) {
        errors['spec.maxPsuLengthMm'] =
          'Chiều dài nguồn tối đa phải là số nguyên lớn hơn 0 mm.'
      }

      const radiatorSizes: number[] = []
      const rawRadStr = (d.supportedRadiatorSizesMm ?? '').trim()
      if (rawRadStr.length > 0) {
        const tokens = rawRadStr
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
        for (const token of tokens) {
          const parsed = parseStrictInt(token)
          if (parsed === null || parsed < 0) {
            errors['spec.supportedRadiatorSizesMm'] =
              'Kích thước radiator hỗ trợ phải là các số nguyên không âm, phân tách bằng dấu phẩy (ví dụ: 120, 240, 360).'
            break
          }
          radiatorSizes.push(parsed)
        }
      }

      const includedFans = parseStrictInt(d.includedFans)
      if (includedFans === null || includedFans < 0) {
        errors['spec.includedFans'] =
          'Số quạt kèm theo phải là số nguyên từ 0 trở lên.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: CaseSpecification = {
        $type: 'case',
        componentType: 7,
        supportedFormFactors: uniqueFactors as MotherboardFormFactor[],
        maxGpuLengthMm: maxGpuLengthMm!,
        maxCpuCoolerHeightMm: maxCpuCoolerHeightMm!,
        maxPsuLengthMm: maxPsuLengthMm!,
        supportedRadiatorSizesMm: radiatorSizes,
        includedFans: includedFans!,
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.Cooler: {
      const d = specDraft as CoolerSpecDraft
      const coolerType = parseStrictInt(d.coolerType)
      if (coolerType === null || !VALID_COOLER_TYPES.has(coolerType)) {
        errors['spec.coolerType'] = 'Vui lòng chọn loại tản nhiệt hợp lệ.'
      }

      const rawSockets = Array.isArray(d.supportedSockets)
        ? d.supportedSockets
        : []
      const uniqueSockets = Array.from(new Set(rawSockets))
      if (uniqueSockets.length === 0) {
        errors['spec.supportedSockets'] =
          'Vui lòng chọn ít nhất 1 socket CPU hỗ trợ.'
      } else if (
        uniqueSockets.length !== rawSockets.length ||
        uniqueSockets.some((s) => !VALID_CPU_SOCKETS.has(s))
      ) {
        errors['spec.supportedSockets'] =
          'Danh sách socket hỗ trợ không hợp lệ hoặc bị trùng lặp.'
      }

      const rawHeight = (d.heightMm ?? '').trim()
      const heightMm =
        rawHeight === '' && coolerType !== null && coolerType !== CoolerType.Air
          ? 0
          : parseStrictInt(rawHeight)

      if (heightMm === null || heightMm < 0) {
        errors['spec.heightMm'] =
          'Chiều cao tản nhiệt phải là số nguyên từ 0 mm trở lên.'
      } else if (coolerType === CoolerType.Air && heightMm <= 0) {
        errors['spec.heightMm'] =
          'Tản nhiệt khí (Air) bắt buộc có chiều cao lớn hơn 0 mm.'
      }

      const rawRad = (d.radiatorSizeMm ?? '').trim()
      const radiatorSizeMm =
        rawRad === '' && coolerType !== null && !isAioCoolerType(coolerType)
          ? 0
          : parseStrictInt(rawRad)

      if (radiatorSizeMm === null || radiatorSizeMm < 0) {
        errors['spec.radiatorSizeMm'] =
          'Kích thước radiator phải là số nguyên từ 0 mm trở lên.'
      } else if (
        coolerType !== null &&
        isAioCoolerType(coolerType) &&
        radiatorSizeMm <= 0
      ) {
        errors['spec.radiatorSizeMm'] =
          'Tản nhiệt nước AIO bắt buộc có kích thước radiator lớn hơn 0 mm.'
      }

      const maxTdpRating = parseStrictInt(d.maxTdpRating)
      if (maxTdpRating === null || maxTdpRating <= 0) {
        errors['spec.maxTdpRating'] =
          'Công suất tản nhiệt tối đa (Max TDP) phải là số nguyên lớn hơn 0 W.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: CoolerSpecification = {
        $type: 'cooler',
        componentType: 8,
        coolerType: coolerType as CoolerType,
        supportedSockets: uniqueSockets as CpuSocket[],
        heightMm: heightMm!,
        radiatorSizeMm: radiatorSizeMm!,
        maxTdpRating: maxTdpRating!,
        hasRgb: Boolean(d.hasRgb),
      }
      return { isValid: true, errors: {}, specification }
    }

    case ComponentType.Accessory: {
      const d = specDraft as AccessorySpecDraft
      const details = (d.details ?? '').trim()
      if (!details) {
        errors['spec.details'] = 'Chi tiết thông số phụ kiện không được để trống.'
      } else if (details.length > 2000) {
        errors['spec.details'] =
          'Chi tiết thông số phụ kiện không được vượt quá 2000 ký tự.'
      }

      if (Object.keys(errors).length > 0) {
        return { isValid: false, errors, specification: null }
      }

      const specification: AccessorySpecification = {
        $type: 'accessory',
        componentType: 9,
        details,
      }
      return { isValid: true, errors: {}, specification }
    }
  }
}

export function createInitialProductFormDraft(
  defaultType: ComponentType = ComponentType.CPU
): ProductFormDraft {
  return {
    name: '',
    sku: '',
    brand: '',
    categoryId: '',
    componentType: defaultType,
    price: '',
    originalPrice: '',
    stockQuantity: '0',
    isActive: true,
    imageUrl: '',
    additionalImages: [],
    specDraft: createEmptySpecificationDraft(defaultType),
  }
}

export function mapProductDetailToFormDraft(
  product: ProductDetail
): ProductFormDraft {
  return {
    name: product.name ?? '',
    sku: product.sku ?? '',
    brand: product.brand ?? '',
    categoryId: product.categoryId ?? '',
    componentType: product.componentType,
    price: String(product.price),
    originalPrice:
      product.originalPrice !== null && product.originalPrice !== undefined
        ? String(product.originalPrice)
        : '',
    stockQuantity: String(product.stockQuantity ?? 0),
    isActive: Boolean(product.isActive),
    imageUrl: product.imageUrl ?? '',
    additionalImages: Array.isArray(product.additionalImages)
      ? [...product.additionalImages]
      : [],
    specDraft: mapSpecificationToDraft(product.specifications),
  }
}

/**
 * Áp dụng chuyển đổi ComponentType sau khi đã xác nhận (hoặc khi specDraft chưa dirty):
 * - Reset specDraft về đúng subtype mới (không giữ field cũ gây lệch schema)
 * - Nếu categoryId hiện tại không thuộc ComponentType mới thì reset categoryId về ''
 */
export function applyConfirmedComponentTypeSwitch(params: {
  currentDraft: ProductFormDraft
  nextType: ComponentType
  categories: FlattenedCategoryNode[]
}): ProductFormDraft {
  const { currentDraft, nextType, categories } = params
  if (currentDraft.componentType === nextType) {
    return currentDraft
  }

  const currentCatId = currentDraft.categoryId.trim().toLowerCase()
  const matchedCat = currentCatId
    ? categories.find((c) => c.id.trim().toLowerCase() === currentCatId)
    : undefined

  const nextCategoryId =
    matchedCat && matchedCat.componentType === nextType
      ? currentDraft.categoryId
      : ''

  return {
    ...currentDraft,
    componentType: nextType,
    categoryId: nextCategoryId,
    specDraft: createEmptySpecificationDraft(nextType),
  }
}

/**
 * Kiểm tra yêu cầu chuyển đổi ComponentType trên form sản phẩm:
 * - Nếu specDraft hiện tại đã có dữ liệu chỉnh sửa (dirty so với empty draft của type hiện tại),
 *   trả về requiresConfirmation = true và giữ nguyên currentDraft cho tới khi user xác nhận.
 * - Nếu specDraft đang rỗng, áp dụng ngay lập tức.
 */
export function requestComponentTypeSwitch(params: {
  currentDraft: ProductFormDraft
  nextType: ComponentType
  categories: FlattenedCategoryNode[]
}): {
  requiresConfirmation: boolean
  nextDraft: ProductFormDraft
} {
  const { currentDraft, nextType, categories } = params
  if (currentDraft.componentType === nextType) {
    return {
      requiresConfirmation: false,
      nextDraft: currentDraft,
    }
  }

  if (isSpecificationDraftDirty(currentDraft.specDraft, currentDraft.componentType)) {
    return {
      requiresConfirmation: true,
      nextDraft: currentDraft,
    }
  }

  return {
    requiresConfirmation: false,
    nextDraft: applyConfirmedComponentTypeSwitch({
      currentDraft,
      nextType,
      categories,
    }),
  }
}

/**
 * Kiểm tra form sản phẩm có thay đổi chưa lưu so với baseline hay không.
 * Lưu ý: ở chế độ 'edit', stockQuantity được quản lý ở khu vực Điều chỉnh tồn kho riêng biệt,
 * nên cập nhật stockQuantity không bao giờ làm sai lệch trạng thái isDirty của ProductForm.
 */
export function computeProductFormIsDirty(
  baseline: ProductFormDraft | null,
  current: ProductFormDraft,
  mode: 'create' | 'edit' = 'edit'
): boolean {
  const effectiveBaseline =
    baseline ?? createInitialProductFormDraft(ComponentType.CPU)

  const normalizeForCompare = (d: ProductFormDraft) => ({
    name: d.name.trim(),
    sku: d.sku.trim(),
    brand: d.brand.trim(),
    categoryId: d.categoryId.trim().toLowerCase(),
    componentType: d.componentType,
    price: d.price.trim(),
    originalPrice: d.originalPrice.trim(),
    stockQuantity: mode === 'create' ? d.stockQuantity.trim() : 'ignored_in_edit',
    isActive: Boolean(d.isActive),
    imageUrl: d.imageUrl.trim(),
    additionalImages: d.additionalImages
      .map((u) => u.trim())
      .filter((u) => u.length > 0),
    specDraft: d.specDraft,
  })

  return (
    JSON.stringify(normalizeForCompare(effectiveBaseline)) !==
    JSON.stringify(normalizeForCompare(current))
  )
}

export interface ProductPayloadValidationResult {
  isValid: boolean
  errors: Record<string, string>
  createPayload: CreateProductRequest | null
  updatePayload: UpdateProductRequest | null
}

/**
 * Validate toàn bộ ProductFormDraft và dựng payload chuẩn cho:
 * - POST /api/v1/products (có stockQuantity, không có isActive)
 * - PUT /api/v1/products/{id} (có isActive, tuyệt đối KHÔNG có stockQuantity)
 */
export function validateAndBuildProductPayload(params: {
  mode: 'create' | 'edit'
  draft: ProductFormDraft
  categories: FlattenedCategoryNode[]
  categoriesLoaded: boolean
}): ProductPayloadValidationResult {
  const { mode, draft, categories, categoriesLoaded } = params
  const errors: Record<string, string> = {}

  const cleanName = (draft.name ?? '').trim()
  if (!cleanName) {
    errors.name = 'Tên sản phẩm không được để trống.'
  } else if (cleanName.length > 255) {
    errors.name = 'Tên sản phẩm không được vượt quá 255 ký tự.'
  }

  const cleanSku = (draft.sku ?? '').trim()
  if (!cleanSku) {
    errors.sku = 'Mã SKU không được để trống.'
  } else if (cleanSku.length > 100) {
    errors.sku = 'Mã SKU không được vượt quá 100 ký tự.'
  }

  const cleanBrand = (draft.brand ?? '').trim()
  if (!cleanBrand) {
    errors.brand = 'Thương hiệu (Brand) không được để trống.'
  } else if (cleanBrand.length > 100) {
    errors.brand = 'Thương hiệu không được vượt quá 100 ký tự.'
  }

  if (!isValidComponentType(draft.componentType)) {
    errors.componentType = 'Loại linh kiện không hợp lệ.'
  }

  const cleanCategoryId = (draft.categoryId ?? '').trim()
  let resolvedCategoryId = ''
  if (!categoriesLoaded) {
    errors.categoryId =
      'Danh sách danh mục chưa tải xong. Vui lòng tải lại danh mục trước khi lưu.'
  } else if (!cleanCategoryId || !isValidUuid(cleanCategoryId)) {
    errors.categoryId = 'Vui lòng chọn danh mục hợp lệ.'
  } else {
    const matchedCategory = categories.find(
      (c) => c.id.trim().toLowerCase() === cleanCategoryId.toLowerCase()
    )
    if (!matchedCategory) {
      errors.categoryId = 'Danh mục đã chọn không tồn tại.'
    } else if (matchedCategory.componentType !== draft.componentType) {
      errors.categoryId =
        'Danh mục đã chọn phải có cùng loại linh kiện với sản phẩm.'
    } else {
      resolvedCategoryId = matchedCategory.id
    }
  }

  const parsedPrice = parseStrictFloat(draft.price)
  if (parsedPrice === null || parsedPrice <= 0) {
    errors.price = 'Giá bán phải là số lớn hơn 0.'
  }

  const rawOriginalPrice = (draft.originalPrice ?? '').trim()
  let resolvedOriginalPrice: number | null = null
  if (rawOriginalPrice.length > 0) {
    const parsedOrig = parseStrictFloat(rawOriginalPrice)
    if (parsedOrig === null || parsedOrig <= 0) {
      errors.originalPrice = 'Giá gốc phải là số lớn hơn 0 (hoặc để trống).'
    } else if (parsedPrice !== null && parsedOrig < parsedPrice) {
      errors.originalPrice =
        'Giá gốc (niêm yết) phải lớn hơn hoặc bằng giá bán hiện tại.'
    } else {
      resolvedOriginalPrice = parsedOrig
    }
  }

  let resolvedStockQuantity = 0
  if (mode === 'create') {
    const parsedStock = parseStrictInt(draft.stockQuantity)
    if (parsedStock === null || parsedStock < 0) {
      errors.stockQuantity =
        'Số lượng tồn kho ban đầu phải là số nguyên từ 0 trở lên.'
    } else {
      resolvedStockQuantity = parsedStock
    }
  }

  const mediaValidation = validateProductMedia(
    draft.imageUrl,
    draft.additionalImages
  )
  if (mediaValidation.imageUrlError) {
    errors.imageUrl = mediaValidation.imageUrlError
  }
  if (mediaValidation.additionalImagesError) {
    errors.additionalImages = mediaValidation.additionalImagesError
  }

  const specValidation = validateAndBuildSpecification(
    draft.componentType,
    draft.specDraft
  )
  if (!specValidation.isValid || !specValidation.specification) {
    Object.assign(errors, specValidation.errors)
  }

  if (Object.keys(errors).length > 0 || !specValidation.specification) {
    return {
      isValid: false,
      errors,
      createPayload: null,
      updatePayload: null,
    }
  }

  if (mode === 'create') {
    const createPayload: CreateProductRequest = {
      categoryId: resolvedCategoryId,
      name: cleanName,
      sku: cleanSku,
      brand: cleanBrand,
      price: parsedPrice!,
      originalPrice: resolvedOriginalPrice,
      stockQuantity: resolvedStockQuantity,
      imageUrl: mediaValidation.normalizedImageUrl,
      additionalImages: mediaValidation.normalizedAdditionalImages,
      componentType: draft.componentType,
      specifications: specValidation.specification,
    }
    return {
      isValid: true,
      errors: {},
      createPayload,
      updatePayload: null,
    }
  }

  const updatePayload: UpdateProductRequest = {
    categoryId: resolvedCategoryId,
    name: cleanName,
    sku: cleanSku,
    brand: cleanBrand,
    price: parsedPrice!,
    originalPrice: resolvedOriginalPrice,
    isActive: Boolean(draft.isActive),
    imageUrl: mediaValidation.normalizedImageUrl,
    additionalImages: mediaValidation.normalizedAdditionalImages,
    componentType: draft.componentType,
    specifications: specValidation.specification,
  }

  return {
    isValid: true,
    errors: {},
    createPayload: null,
    updatePayload,
  }
}

export interface StockAdjustmentValidationResult {
  isValid: boolean
  errors: Record<string, string>
  payload: AdjustStockRequest | null
  previewStockAfter: number | null
}

/**
 * Validate form điều chỉnh tồn kho khớp với AdjustStockCommandValidator:
 * - expectedStockQuantity: số nguyên >= 0
 * - quantityDelta: số nguyên != 0
 * - 0 <= expectedStockQuantity + quantityDelta <= 2147483647
 * - note: sau trim dài 3..500 ký tự
 */
export function validateStockAdjustmentDraft(params: {
  expectedStockQuantity: number
  quantityDeltaRaw: string
  noteRaw: string
}): StockAdjustmentValidationResult {
  const { expectedStockQuantity, quantityDeltaRaw, noteRaw } = params
  const errors: Record<string, string> = {}

  const expectedInt = parseStrictInt(expectedStockQuantity)
  if (expectedInt === null || expectedInt < 0) {
    errors.expectedStockQuantity = 'Số lượng tồn kho hiện tại không hợp lệ.'
  }

  const deltaInt = parseStrictInt(quantityDeltaRaw)
  let previewStockAfter: number | null = null

  if (deltaInt === null) {
    errors.quantityDelta = 'Biến động tồn kho phải là một số nguyên (ví dụ: 5 hoặc -2).'
  } else if (deltaInt === 0) {
    errors.quantityDelta = 'Biến động tồn kho phải khác 0.'
  } else if (expectedInt !== null) {
    const nextStock = expectedInt + deltaInt
    previewStockAfter = nextStock
    if (nextStock < 0) {
      errors.quantityDelta =
        'Số lượng tồn kho sau điều chỉnh không được nhỏ hơn 0.'
    } else if (nextStock > MAX_INT32) {
      errors.quantityDelta =
        'Số lượng tồn kho sau điều chỉnh vượt quá giới hạn tối đa.'
    }
  }

  const cleanNote = (noteRaw ?? '').trim()
  if (!cleanNote) {
    errors.note = 'Vui lòng nhập ghi chú lý do điều chỉnh tồn kho.'
  } else if (cleanNote.length < 3) {
    errors.note = 'Ghi chú lý do điều chỉnh phải có ít nhất 3 ký tự.'
  } else if (cleanNote.length > 500) {
    errors.note = 'Ghi chú lý do điều chỉnh không được vượt quá 500 ký tự.'
  }

  if (Object.keys(errors).length > 0 || expectedInt === null || deltaInt === null) {
    return {
      isValid: false,
      errors,
      payload: null,
      previewStockAfter,
    }
  }

  return {
    isValid: true,
    errors: {},
    payload: {
      expectedStockQuantity: expectedInt,
      quantityDelta: deltaInt,
      note: cleanNote,
    },
    previewStockAfter,
  }
}

export interface ExecuteStockAdjustmentDeps {
  productId: string
  expectedStockQuantity: number
  quantityDeltaRaw: string
  noteRaw: string
  isAdjustingStock: boolean
  isSavingProduct: boolean
  isContextCurrent: () => boolean
  adjustStock: (
    productId: string,
    payload: AdjustStockRequest
  ) => Promise<StockAdjustmentResultDto>
  reloadLatestProductStock: (productId: string) => Promise<number | null>
  reloadStockMovements: () => Promise<void>
  onValidationError: (errors: Record<string, string>) => void
  onAdjustingChange: (adjusting: boolean) => void
  onApiError: (message: string | null) => void
  onSuccessMessage: (message: string | null) => void
  onExpectedStockUpdated: (newStockQuantity: number) => void
  onResetAdjustmentInputs: () => void
}

/**
 * Thực thi POST /api/v1/products/{id}/stock-adjustments:
 * - Chặn chạy song song với Lưu thông tin sản phẩm (cross-lock) hoặc double-submit
 * - Khi 200 OK: cập nhật expectedStockQuantity = result.stockAfter, tải lại lịch sử biến động trang 1,
 *   KHÔNG làm mất dữ liệu chưa lưu ở ProductFormDraft
 * - Khi 409 Inventory.StockConflict: tự động đọc lại stockQuantity mới nhất từ GET /products/{id},
 *   cập nhật expectedStockQuantity nhưng KHÔNG tự động gửi lại POST và KHÔNG ghi đè ProductFormDraft
 * - Khi lỗi mạng/timeout: không tự động retry POST để tránh cộng/trừ kho 2 lần
 */
export async function executeStockAdjustmentMutation(
  deps: ExecuteStockAdjustmentDeps
): Promise<boolean> {
  if (deps.isAdjustingStock || deps.isSavingProduct) {
    return false
  }

  const validation = validateStockAdjustmentDraft({
    expectedStockQuantity: deps.expectedStockQuantity,
    quantityDeltaRaw: deps.quantityDeltaRaw,
    noteRaw: deps.noteRaw,
  })

  if (!validation.isValid || !validation.payload) {
    deps.onValidationError(validation.errors)
    return false
  }

  if (!isValidUuid(deps.productId)) {
    deps.onApiError('Id sản phẩm không hợp lệ.')
    return false
  }

  deps.onValidationError({})
  deps.onApiError(null)
  deps.onSuccessMessage(null)
  deps.onAdjustingChange(true)

  try {
    const result = await deps.adjustStock(
      deps.productId.trim(),
      validation.payload
    )
    if (!deps.isContextCurrent()) return false

    deps.onExpectedStockUpdated(result.stockAfter)
    deps.onResetAdjustmentInputs()
    deps.onSuccessMessage(
      `Đã điều chỉnh tồn kho từ ${result.stockBefore} sang ${result.stockAfter} (${
        result.quantityDelta > 0 ? `+${result.quantityDelta}` : result.quantityDelta
      }).`
    )

    await deps.reloadStockMovements()
    return true
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return false
    if (err instanceof Error && err.name === 'AbortError') return false

    if (
      err instanceof ApiError &&
      (err.status === 409 || err.code === 'Inventory.StockConflict')
    ) {
      try {
        const latestStock = await deps.reloadLatestProductStock(
          deps.productId.trim()
        )
        if (!deps.isContextCurrent()) return false
        if (typeof latestStock === 'number' && Number.isFinite(latestStock)) {
          deps.onExpectedStockUpdated(latestStock)
        }
      } catch {
        // Nếu tải lại stock thất bại thì vẫn hiển thị thông báo conflict chuẩn
      }
      if (!deps.isContextCurrent()) return false
      deps.onApiError(
        mapAdminApiError(
          err,
          'Số lượng tồn kho trên hệ thống đã thay đổi. Vui lòng kiểm tra tồn kho mới nhất và xác nhận lại.'
        )
      )
      return false
    }

    deps.onApiError(
      mapAdminApiError(
        err,
        'Không thể điều chỉnh tồn kho. Vui lòng kiểm tra lại tồn kho trước khi thử lại.'
      )
    )
    return false
  } finally {
    if (deps.isContextCurrent()) {
      deps.onAdjustingChange(false)
    }
  }
}

export interface ExecuteProductSaveDeps {
  mode: 'create' | 'edit'
  productId?: string
  draft: ProductFormDraft
  categories: FlattenedCategoryNode[]
  categoriesLoaded: boolean
  isSavingProduct: boolean
  isAdjustingStock?: boolean
  isContextCurrent: () => boolean
  createProduct: (payload: CreateProductRequest) => Promise<ProductDetail>
  updateProduct: (
    id: string,
    payload: UpdateProductRequest
  ) => Promise<ProductDetail>
  onValidationError: (errors: Record<string, string>) => void
  onSavingChange: (saving: boolean) => void
  onApiError: (message: string | null) => void
  onSaveSuccess: (savedProduct: ProductDetail) => void
}

/**
 * Thực thi lưu sản phẩm (Create POST /products hoặc Edit PUT /products/{id}):
 * - Chặn double-click hoặc chạy chồng với điều chỉnh tồn kho
 * - Không tự động retry khi timeout/network error để tránh tạo trùng hoặc ghi đè ngoài ý muốn
 * - Kiểm tra isContextCurrent() sau mỗi await
 */
export async function executeProductFormSave(
  deps: ExecuteProductSaveDeps
): Promise<boolean> {
  if (deps.isSavingProduct || deps.isAdjustingStock) {
    return false
  }

  const validation = validateAndBuildProductPayload({
    mode: deps.mode,
    draft: deps.draft,
    categories: deps.categories,
    categoriesLoaded: deps.categoriesLoaded,
  })

  if (!validation.isValid) {
    deps.onValidationError(validation.errors)
    return false
  }

  if (deps.mode === 'edit' && !isValidUuid(deps.productId)) {
    deps.onApiError('Id sản phẩm cần cập nhật không hợp lệ.')
    return false
  }

  deps.onValidationError({})
  deps.onApiError(null)
  deps.onSavingChange(true)

  try {
    const saved =
      deps.mode === 'create'
        ? await deps.createProduct(validation.createPayload!)
        : await deps.updateProduct(
            deps.productId!.trim(),
            validation.updatePayload!
          )

    if (!deps.isContextCurrent()) return false

    deps.onSaveSuccess(saved)
    return true
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return false
    if (err instanceof Error && err.name === 'AbortError') return false

    deps.onApiError(
      mapAdminApiError(
        err,
        'Không thể lưu thông tin sản phẩm. Vui lòng kiểm tra lại dữ liệu.'
      )
    )
    return false
  } finally {
    if (deps.isContextCurrent()) {
      deps.onSavingChange(false)
    }
  }
}

export interface AsyncRequestTicket {
  seq: number
  ownerId: string | null
  targetId: string | null
  isCurrent: () => boolean
}

/**
 * Bộ theo dõi request bất đồng bộ chống stale response (out-of-order) và đổi phiên đăng nhập (ownerId) / đổi route (:id).
 */
export function createAsyncRequestTracker(
  getCurrentContext: () => {
    mounted: boolean
    ownerId: string | null
    targetId?: string | null
  }
) {
  let latestSeq = 0

  return {
    issueTicket(): AsyncRequestTicket {
      latestSeq += 1
      const ticketSeq = latestSeq
      const snapshot = getCurrentContext()
      const ticketOwner = snapshot.ownerId
      const ticketTarget = snapshot.targetId ?? null

      return {
        seq: ticketSeq,
        ownerId: ticketOwner,
        targetId: ticketTarget,
        isCurrent(): boolean {
          const now = getCurrentContext()
          if (!now.mounted) return false
          if (ticketSeq !== latestSeq) return false
          if (now.ownerId !== ticketOwner) return false
          if ((now.targetId ?? null) !== ticketTarget) return false
          return true
        },
      }
    },
    invalidateAll(): void {
      latestSeq += 1
    },
  }
}

/**
 * Quyết định có chặn điều hướng (useBlocker / beforeunload) khi form sản phẩm đang dirty hay không.
 * Khi lưu thành công và chuẩn bị navigate, saveSuccessBypass = true sẽ bypass đồng bộ để không bật nhầm hộp thoại.
 */
export function shouldBlockDirtyProductNavigation(params: {
  isDirty: boolean
  saveSuccessBypass: boolean
  currentPathname: string
  nextPathname: string
}): boolean {
  if (params.saveSuccessBypass) return false
  if (!params.isDirty) return false
  if (params.currentPathname === params.nextPathname) return false
  return true
}

