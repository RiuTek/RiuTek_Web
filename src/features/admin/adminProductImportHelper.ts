import { ApiError } from '../../lib/api'
import { COMPONENT_TYPE_LABELS } from '../products/productConstants'
import { ComponentType } from '../products/productTypes'
import { mapAdminApiError } from './adminConstants'
import { isValidHttpsUrl } from './adminProductHelper'
import type {
  CreateProductMediaUploadRequest,
  ProductImportCommitResultDto,
  ProductImportErrorDto,
  ProductImportImageMappingDto,
  ProductImportInspectResultDto,
  ProductImportInspectRowDto,
  ProductImportValidationResultDto,
  ProductMediaDto,
  ProductMediaUploadDto,
} from './adminTypes'

export const MAX_WORKBOOK_FILE_BYTES = 5 * 1024 * 1024 // 5 MiB
export const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024 // 5 MiB default R2 policy
export const MAX_IMAGE_MAPPINGS_JSON_BYTES = 512 * 1024 // 512 KiB UTF-8
export const MAX_IMAGE_MAPPINGS_SKU_COUNT = 1000
export const MAX_TOTAL_OBJECT_KEYS_COUNT = 11000
export const MAX_ADDITIONAL_IMAGES_PER_SKU = 10
export const MAX_UPLOAD_CONCURRENCY = 3

/**
 * Policy ảnh chuẩn từ Backend ProductMediaHelper:
 * Chỉ chấp nhận .jpg (image/jpeg), .png (image/png), .webp (image/webp).
 * Không quảng cáo hay cho phép .jpeg, .gif, .svg, .heic.
 */
export const SUPPORTED_IMAGE_EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const MANAGED_OBJECT_KEY_REGEX =
  /^products\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i

const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

export function naturalCompareFileNames(a: string, b: string): number {
  const cmp = NATURAL_COLLATOR.compare(a, b)
  if (cmp !== 0) return cmp
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Map string enum ComponentType từ POST /product-imports/inspect (Cpu, Motherboard, Gpu...)
 * sang numeric enum ComponentType của FE.
 */
export function mapInspectComponentTypeToEnum(
  rawType: string | number | null | undefined
): ComponentType | null {
  if (typeof rawType === 'number') {
    return rawType >= ComponentType.CPU && rawType <= ComponentType.Accessory
      ? (rawType as ComponentType)
      : null
  }
  if (typeof rawType !== 'string') return null
  const normalized = rawType.trim().toLowerCase()
  switch (normalized) {
    case 'cpu':
      return ComponentType.CPU
    case 'motherboard':
      return ComponentType.Motherboard
    case 'gpu':
      return ComponentType.GPU
    case 'ram':
      return ComponentType.RAM
    case 'storage':
      return ComponentType.Storage
    case 'psu':
      return ComponentType.PSU
    case 'case':
      return ComponentType.Case
    case 'cooler':
      return ComponentType.Cooler
    case 'accessory':
      return ComponentType.Accessory
    default:
      return null
  }
}

export function getInspectComponentTypeLabel(
  rawType: string | number | null | undefined
): string {
  const mapped = mapInspectComponentTypeToEnum(rawType)
  if (mapped !== null && COMPONENT_TYPE_LABELS[mapped]) {
    return COMPONENT_TYPE_LABELS[mapped]
  }
  return typeof rawType === 'string' && rawType.trim()
    ? rawType.trim()
    : 'Không xác định'
}

export interface WorkbookFileValidationResult {
  isValid: boolean
  error: string | null
}

/**
 * Kiểm tra file workbook .xlsx trước khi gửi lên BE (<= 5 MiB, đúng đuôi .xlsx).
 */
export function validateWorkbookFile(
  file: { name: string; size: number } | null | undefined
): WorkbookFileValidationResult {
  if (!file) {
    return { isValid: false, error: 'Vui lòng chọn file Excel (.xlsx).' }
  }
  const trimmedName = (file.name ?? '').trim()
  if (!trimmedName || !trimmedName.toLowerCase().endsWith('.xlsx')) {
    return {
      isValid: false,
      error: 'Chỉ chấp nhận file Excel định dạng .xlsx.',
    }
  }
  if (file.size <= 0) {
    return {
      isValid: false,
      error: 'File Excel tải lên không được để trống (0 bytes).',
    }
  }
  if (file.size > MAX_WORKBOOK_FILE_BYTES) {
    return {
      isValid: false,
      error: 'Dung lượng file Excel không được vượt quá 5 MiB.',
    }
  }
  return { isValid: true, error: null }
}

export interface LocalImageValidationResult {
  isValid: boolean
  resolvedContentType: string | null
  extension: string
  error: string | null
}

function getFileExtensionLower(fileName: string): string {
  const trimmed = (fileName ?? '').trim()
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return ''
  return trimmed.slice(lastDot).toLowerCase()
}

function getFileBaseNameWithoutExt(fileName: string): string {
  const trimmed = (fileName ?? '').trim()
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0) return trimmed
  return trimmed.slice(0, lastDot)
}

/**
 * Kiểm tra từng file ảnh local theo đúng policy Backend ProductMediaHelper:
 * - Chỉ hỗ trợ .jpg (image/jpeg), .png (image/png), .webp (image/webp)
 * - Từ chối rõ .jpeg, .gif, .svg, .heic... trước khi upload
 * - Nếu File.type rỗng thì suy ra từ đuôi .jpg/.png/.webp hợp lệ; không tự bịa MIME cho đuôi lạ
 * - Dung lượng > 0 và <= maxFileSizeBytes (mặc định 5 MiB)
 */
export function validateAndResolveLocalImageFile(
  file: { name: string; size: number; type?: string },
  maxFileSizeBytes = MAX_IMAGE_FILE_BYTES
): LocalImageValidationResult {
  const fileName = (file.name ?? '').trim()
  if (!fileName) {
    return {
      isValid: false,
      resolvedContentType: null,
      extension: '',
      error: 'Tên tệp ảnh không được để trống.',
    }
  }
  if (fileName.length > 255) {
    return {
      isValid: false,
      resolvedContentType: null,
      extension: '',
      error: `Tên tệp ảnh "${fileName}" vượt quá 255 ký tự.`,
    }
  }

  const ext = getFileExtensionLower(fileName)
  const expectedMime = SUPPORTED_IMAGE_EXTENSION_MIME_MAP[ext]

  if (!expectedMime) {
    if (ext === '.jpeg') {
      return {
        isValid: false,
        resolvedContentType: null,
        extension: ext,
        error: `Tệp "${fileName}" dùng phần mở rộng .jpeg không nằm trong chính sách lưu trữ của hệ thống. Vui lòng đổi sang .jpg, .png hoặc .webp.`,
      }
    }
    return {
      isValid: false,
      resolvedContentType: null,
      extension: ext,
      error: `Tệp "${fileName}" có định dạng "${ext || 'không rõ'}" không được hỗ trợ. Hệ thống chỉ chấp nhận .jpg, .png và .webp.`,
    }
  }

  const rawMime = (file.type ?? '').trim().toLowerCase()
  if (rawMime && rawMime !== expectedMime) {
    return {
      isValid: false,
      resolvedContentType: null,
      extension: ext,
      error: `Tệp "${fileName}" có kiểu MIME "${rawMime}" không khớp với phần mở rộng "${ext}" (${expectedMime}).`,
    }
  }

  if (file.size <= 0) {
    return {
      isValid: false,
      resolvedContentType: null,
      extension: ext,
      error: `Tệp ảnh "${fileName}" trống (0 bytes).`,
    }
  }

  if (file.size > maxFileSizeBytes) {
    const maxMb = (maxFileSizeBytes / (1024 * 1024)).toFixed(0)
    return {
      isValid: false,
      resolvedContentType: null,
      extension: ext,
      error: `Tệp ảnh "${fileName}" vượt quá giới hạn dung lượng ${maxMb} MiB.`,
    }
  }

  return {
    isValid: true,
    resolvedContentType: expectedMime,
    extension: ext,
    error: null,
  }
}

export interface LocalFolderFileInput {
  file: File | Blob
  name: string
  size: number
  type: string
  webkitRelativePath: string
}

export interface NormalizedFolderImageEntry {
  file: File | Blob
  fileName: string
  baseNameLower: string
  extensionLower: string
  size: number
  rawMimeType: string
  resolvedContentType: string | null
  skuFolderRaw: string
  normalizedSku: string
  relativePath: string // Chuẩn hóa <SKU>/<file>
  validationError: string | null
}

export interface FolderSkuBucket {
  normalizedSku: string
  rawFolderNames: Set<string>
  files: NormalizedFolderImageEntry[]
  blockingErrors: string[]
}

export interface FolderInventoryResult {
  rootFolderName: string | null
  totalFilesScanned: number
  globalBlockingErrors: string[]
  skuBuckets: Map<string, FolderSkuBucket>
}

const IGNORED_OS_METADATA_FILES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
])

/**
 * Xây dựng inventory từ danh sách file được chọn qua webkitdirectory:
 * - Chuẩn hóa dấu phân cách '\' -> '/'
 * - Strip đúng 1 cấp thư mục gốc được chọn (nếu có)
 * - Chỉ chấp nhận cấu trúc <SKU>/<file> (2 phân đoạn sau khi strip root)
 * - Từ chối '..', đường dẫn tuyệt đối, file nằm rời không có folder SKU, hoặc thư mục lồng sâu > 2 cấp
 * - Phát hiện đụng độ hoa/thường (case collision) ở tên thư mục SKU hoặc tên file trùng lặp
 */
export function buildFolderInventory(
  rawFiles: LocalFolderFileInput[],
  maxFileSizeBytes = MAX_IMAGE_FILE_BYTES
): FolderInventoryResult {
  const globalBlockingErrors: string[] = []
  const skuBuckets = new Map<string, FolderSkuBucket>()

  if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
    return {
      rootFolderName: null,
      totalFilesScanned: 0,
      globalBlockingErrors,
      skuBuckets,
    }
  }

  // Bước 1: Chuẩn hóa đường dẫn thô và lọc bỏ file ẩn của hệ điều hành (.DS_Store, Thumbs.db)
  const preParsed: Array<{
    input: LocalFolderFileInput
    rawPath: string
    segments: string[]
  }> = []

  for (const item of rawFiles) {
    const rawRel = (item.webkitRelativePath || item.name || '').trim()
    const normalizedSlashes = rawRel.replace(/\\/g, '/')

    if (
      !normalizedSlashes ||
      normalizedSlashes.startsWith('/') ||
      /^[a-zA-Z]:/.test(normalizedSlashes) ||
      normalizedSlashes.includes('..') ||
      normalizedSlashes.includes('//')
    ) {
      globalBlockingErrors.push(
        `Đường dẫn tệp không hợp lệ hoặc không an toàn: "${rawRel}".`
      )
      continue
    }

    const segments = normalizedSlashes
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (segments.length === 0) continue

    const lastSegmentLower = segments[segments.length - 1].toLowerCase()
    if (IGNORED_OS_METADATA_FILES.has(lastSegmentLower)) {
      continue
    }

    if (segments.some((seg) => seg === '.' || seg === '..')) {
      globalBlockingErrors.push(
        `Đường dẫn tệp chứa phân đoạn không hợp lệ: "${rawRel}".`
      )
      continue
    }

    preParsed.push({
      input: item,
      rawPath: normalizedSlashes,
      segments,
    })
  }

  if (preParsed.length === 0) {
    return {
      rootFolderName: null,
      totalFilesScanned: 0,
      globalBlockingErrors,
      skuBuckets,
    }
  }

  // Bước 2: Xác định xem có 1 thư mục gốc chung từ webkitdirectory hay không.
  // Khi chọn folder qua trình duyệt, mọi file đều có tiền tố <RootFolder>/...
  // Nếu tất cả các file cùng chia sẻ segment[0] (case-insensitive) VÀ có ít nhất 1 file >= 3 segments
  // (hoặc tất cả file đều có cùng segment[0] và không có SKU nào trùng tên root trong trường hợp 2 segments?
  // Lưu ý: nếu người dùng chọn thư mục gốc chứa file rời <RootFolder>/flat.jpg (2 segments),
  // hoặc nếu trong test truyền trực tiếp <SKU>/<file> (2 segments, nhiều SKU khác nhau),
  // ta phân biệt rõ):
  const distinctFirstSegments = new Set(
    preParsed.map((p) => p.segments[0].toLowerCase())
  )
  const hasAnyThreePlusSegments = preParsed.some((p) => p.segments.length >= 3)
  const shouldStripCommonRoot =
    distinctFirstSegments.size === 1 && hasAnyThreePlusSegments

  const rootFolderName = shouldStripCommonRoot ? preParsed[0].segments[0] : null

  const seenRelativePathsPerSku = new Map<string, Set<string>>()

  for (const entry of preParsed) {
    const effectiveSegments = shouldStripCommonRoot
      ? entry.segments.slice(1)
      : entry.segments

    if (effectiveSegments.length < 2) {
      globalBlockingErrors.push(
        `Tệp "${entry.rawPath}" nằm rời ngoài thư mục SKU. Vui lòng đặt ảnh vào đúng thư mục con theo cấu trúc <SKU>/<file> (không tự đoán SKU từ tên file rời).`
      )
      continue
    }

    if (effectiveSegments.length > 2) {
      globalBlockingErrors.push(
        `Đường dẫn "${entry.rawPath}" lồng quá sâu (${effectiveSegments.length} cấp). Chỉ chấp nhận cấu trúc đúng 1 cấp thư mục <SKU>/<file>.`
      )
      continue
    }

    const [skuFolderRaw, fileName] = effectiveSegments
    const normalizedSku = skuFolderRaw.trim().toUpperCase()
    const relativePath = `${skuFolderRaw}/${fileName}`
    const normalizedRelativePathKey = `${normalizedSku}/${fileName.toLowerCase()}`

    let bucket = skuBuckets.get(normalizedSku)
    if (!bucket) {
      bucket = {
        normalizedSku,
        rawFolderNames: new Set<string>(),
        files: [],
        blockingErrors: [],
      }
      skuBuckets.set(normalizedSku, bucket)
    }

    bucket.rawFolderNames.add(skuFolderRaw)
    if (bucket.rawFolderNames.size > 1) {
      const names = Array.from(bucket.rawFolderNames).join(', ')
      const collisionMsg = `Phát hiện trùng lặp thư mục SKU khác kiểu chữ hoa/thường (${names}). Vui lòng gộp về một thư mục duy nhất cho SKU "${normalizedSku}".`
      if (!bucket.blockingErrors.includes(collisionMsg)) {
        bucket.blockingErrors.push(collisionMsg)
      }
    }

    let seenFiles = seenRelativePathsPerSku.get(normalizedSku)
    if (!seenFiles) {
      seenFiles = new Set<string>()
      seenRelativePathsPerSku.set(normalizedSku, seenFiles)
    }
    if (seenFiles.has(normalizedRelativePathKey)) {
      bucket.blockingErrors.push(
        `Phát hiện tệp ảnh trùng tên (không phân biệt hoa/thường) trong thư mục SKU "${skuFolderRaw}": "${fileName}".`
      )
      continue
    }
    seenFiles.add(normalizedRelativePathKey)

    const validation = validateAndResolveLocalImageFile(
      {
        name: fileName,
        size: entry.input.size,
        type: entry.input.type,
      },
      maxFileSizeBytes
    )

    if (!validation.isValid && validation.error) {
      bucket.blockingErrors.push(validation.error)
    }

    bucket.files.push({
      file: entry.input.file,
      fileName,
      baseNameLower: getFileBaseNameWithoutExt(fileName).toLowerCase(),
      extensionLower: validation.extension,
      size: entry.input.size,
      rawMimeType: entry.input.type ?? '',
      resolvedContentType: validation.resolvedContentType,
      skuFolderRaw,
      normalizedSku,
      relativePath,
      validationError: validation.error,
    })
  }

  return {
    rootFolderName,
    totalFilesScanned: preParsed.length,
    globalBlockingErrors,
    skuBuckets,
  }
}

export type MatchedRowImageSource = 'local_folder' | 'url_only' | 'missing'

export interface MatchedSkuRowPlan {
  rowNumber: number
  sku: string
  normalizedSku: string
  name: string
  componentTypeRaw: string
  componentTypeLabel: string
  excelPrimaryImageFile: string | null
  excelImageUrl: string | null
  sourceType: MatchedRowImageSource
  overridesExistingUrl: boolean
  primaryFile: NormalizedFolderImageEntry | null
  additionalFiles: NormalizedFolderImageEntry[]
  blockingErrors: string[]
  warnings: string[]
}

export interface UnusedFolderWarning {
  folderName: string
  normalizedSku: string
  fileCount: number
}

export interface SkuFolderMatchSummary {
  rows: MatchedSkuRowPlan[]
  unusedFolders: UnusedFolderWarning[]
  globalBlockingErrors: string[]
  inspectErrors: ProductImportErrorDto[]
  inspectErrorsTruncated: boolean
  totalRows: number
  localMatchedRowCount: number
  urlOnlyRowCount: number
  urlOverrideRowCount: number
  blockingRowCount: number
  totalFilesToUpload: number
  hasAnyBlockingError: boolean
}

function resolveExplicitPrimaryImageFile(
  rawPrimaryImageFile: string,
  normalizedRowSku: string
): {
  isValid: boolean
  targetFileNameLower: string | null
  error: string | null
} {
  const cleaned = rawPrimaryImageFile.trim().replace(/\\/g, '/')
  if (
    !cleaned ||
    cleaned.startsWith('/') ||
    cleaned.includes('..') ||
    cleaned.includes('//') ||
    /^[a-zA-Z]:/.test(cleaned)
  ) {
    return {
      isValid: false,
      targetFileNameLower: null,
      error: `Giá trị PrimaryImageFile "${rawPrimaryImageFile}" không hợp lệ.`,
    }
  }

  const segments = cleaned
    .split('/')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (segments.length === 1) {
    return {
      isValid: true,
      targetFileNameLower: segments[0].toLowerCase(),
      error: null,
    }
  }

  if (segments.length === 2) {
    const [folderSeg, fileSeg] = segments
    if (folderSeg.toUpperCase() !== normalizedRowSku) {
      return {
        isValid: false,
        targetFileNameLower: null,
        error: `PrimaryImageFile "${rawPrimaryImageFile}" trỏ sang thư mục "${folderSeg}" không khớp với SKU "${normalizedRowSku}".`,
      }
    }
    return {
      isValid: true,
      targetFileNameLower: fileSeg.toLowerCase(),
      error: null,
    }
  }

  return {
    isValid: false,
    targetFileNameLower: null,
    error: `PrimaryImageFile "${rawPrimaryImageFile}" chỉ được phép có dạng <file> hoặc <SKU>/<file>.`,
  }
}

/**
 * Ghép kết quả inspect workbook với folder inventory theo khóa SKU (trim, case-insensitive, không prefix match).
 */
export function matchInspectRowsWithFolder(params: {
  inspectResult: ProductImportInspectResultDto
  folderInventory: FolderInventoryResult | null
}): SkuFolderMatchSummary {
  const { inspectResult, folderInventory } = params
  const inspectRows: ProductImportInspectRowDto[] = Array.isArray(
    inspectResult.rows
  )
    ? inspectResult.rows
    : []
  const inspectErrors: ProductImportErrorDto[] = Array.isArray(
    inspectResult.errors
  )
    ? inspectResult.errors
    : []

  const globalBlockingErrors: string[] = [
    ...(folderInventory?.globalBlockingErrors ?? []),
  ]

  const matchedSkuSet = new Set<string>()
  const rowPlans: MatchedSkuRowPlan[] = []

  // Gom lỗi inspect theo dòng hoặc theo SKU để hiển thị trực tiếp trên bảng ghép
  const inspectErrorsByRow = new Map<number, ProductImportErrorDto[]>()
  const inspectErrorsBySku = new Map<string, ProductImportErrorDto[]>()

  for (const err of inspectErrors) {
    if (err.sheet?.toLowerCase() === 'products' && err.row >= 2) {
      const list = inspectErrorsByRow.get(err.row) ?? []
      list.push(err)
      inspectErrorsByRow.set(err.row, list)
    } else if (err.sku?.trim()) {
      const key = err.sku.trim().toUpperCase()
      const list = inspectErrorsBySku.get(key) ?? []
      list.push(err)
      inspectErrorsBySku.set(key, list)
    }
  }

  let localMatchedRowCount = 0
  let urlOnlyRowCount = 0
  let urlOverrideRowCount = 0
  let blockingRowCount = 0
  let totalFilesToUpload = 0

  for (const row of inspectRows) {
    const rawSku = (row.sku ?? '').trim()
    const normalizedSku = rawSku.toUpperCase()
    if (normalizedSku) {
      matchedSkuSet.add(normalizedSku)
    }

    const rowBlockingErrors: string[] = []
    const rowWarnings: string[] = []

    const rowInspectErrs = [
      ...(inspectErrorsByRow.get(row.row) ?? []),
      ...(normalizedSku ? (inspectErrorsBySku.get(normalizedSku) ?? []) : []),
    ]
    for (const ie of rowInspectErrs) {
      const msg = `[${ie.sheet} dòng ${ie.row}] ${ie.message}`
      if (!rowBlockingErrors.includes(msg)) {
        rowBlockingErrors.push(msg)
      }
    }

    const bucket =
      normalizedSku && folderInventory
        ? folderInventory.skuBuckets.get(normalizedSku)
        : undefined

    if (bucket && bucket.blockingErrors.length > 0) {
      for (const bErr of bucket.blockingErrors) {
        if (!rowBlockingErrors.includes(bErr)) {
          rowBlockingErrors.push(bErr)
        }
      }
    }

    const rawPrimaryImageFile = row.primaryImageFile?.trim() || null
    const rawImageUrl = row.imageUrl?.trim() || null
    const bucketFiles = bucket?.files ?? []

    let primaryFile: NormalizedFolderImageEntry | null = null
    let additionalFiles: NormalizedFolderImageEntry[] = []
    let sourceType: MatchedRowImageSource
    let overridesExistingUrl = false

    if (bucketFiles.length > 0) {
      sourceType = 'local_folder'

      if (rawPrimaryImageFile) {
        const explicitTarget = resolveExplicitPrimaryImageFile(
          rawPrimaryImageFile,
          normalizedSku
        )
        if (!explicitTarget.isValid || !explicitTarget.targetFileNameLower) {
          rowBlockingErrors.push(
            explicitTarget.error ?? 'PrimaryImageFile không hợp lệ.'
          )
        } else {
          const foundPrimary = bucketFiles.find(
            (f) => f.fileName.toLowerCase() === explicitTarget.targetFileNameLower
          )
          if (!foundPrimary) {
            rowBlockingErrors.push(
              `Không tìm thấy ảnh chính "${rawPrimaryImageFile}" trong thư mục SKU "${normalizedSku}".`
            )
          } else {
            primaryFile = foundPrimary
            additionalFiles = bucketFiles
              .filter((f) => f !== foundPrimary)
              .sort((a, b) => naturalCompareFileNames(a.fileName, b.fileName))
          }
        }
      } else {
        const mainCandidates = bucketFiles.filter(
          (f) => f.baseNameLower === 'main'
        )
        if (mainCandidates.length === 0) {
          rowBlockingErrors.push(
            `Thư mục SKU "${normalizedSku}" chưa có ảnh chính tên "main.jpg", "main.png" hoặc "main.webp" (hoặc chưa khai báo cột PrimaryImageFile).`
          )
        } else if (mainCandidates.length > 1) {
          const mainNames = mainCandidates.map((m) => m.fileName).join(', ')
          rowBlockingErrors.push(
            `Thư mục SKU "${normalizedSku}" có nhiều hơn 1 file ảnh chính (${mainNames}). Chỉ được phép có duy nhất 1 file main.*.`
          )
        } else {
          primaryFile = mainCandidates[0]
          additionalFiles = bucketFiles
            .filter((f) => f !== primaryFile)
            .sort((a, b) => naturalCompareFileNames(a.fileName, b.fileName))
        }
      }

      if (additionalFiles.length > MAX_ADDITIONAL_IMAGES_PER_SKU) {
        rowBlockingErrors.push(
          `Thư mục SKU "${normalizedSku}" có ${additionalFiles.length} ảnh phụ, vượt quá giới hạn tối đa ${MAX_ADDITIONAL_IMAGES_PER_SKU} ảnh phụ.`
        )
      }

      if (rawImageUrl) {
        overridesExistingUrl = true
        urlOverrideRowCount += 1
        rowWarnings.push(
          'Ảnh từ thư mục local sẽ thay thế URL ảnh đang có trong cột ImageUrl của Excel.'
        )
      }
    } else if (rawPrimaryImageFile) {
      // Có khai báo PrimaryImageFile trong Excel nhưng không có thư mục/file tương ứng
      sourceType = 'missing'
      rowBlockingErrors.push(
        `Dòng Excel chỉ định PrimaryImageFile "${rawPrimaryImageFile}" nhưng không tìm thấy thư mục ảnh cho SKU "${normalizedSku}".`
      )
    } else if (rawImageUrl) {
      sourceType = 'url_only'
      if (!isValidHttpsUrl(rawImageUrl)) {
        const urlErr = `ImageUrl "${rawImageUrl}" không phải là đường dẫn HTTPS hợp lệ.`
        if (!rowBlockingErrors.some((e) => e.includes('ImageUrl') || e.includes('HTTPS'))) {
          rowBlockingErrors.push(urlErr)
        }
      }
    } else {
      sourceType = 'missing'
      rowBlockingErrors.push(
        `Sản phẩm SKU "${rawSku || '(trống)'}" chưa có ImageUrl trong Excel và không có thư mục ảnh local tương ứng.`
      )
    }

    if (sourceType === 'local_folder' && rowBlockingErrors.length === 0 && primaryFile) {
      localMatchedRowCount += 1
      totalFilesToUpload += 1 + additionalFiles.length
    } else if (sourceType === 'url_only' && rowBlockingErrors.length === 0) {
      urlOnlyRowCount += 1
    }

    if (rowBlockingErrors.length > 0) {
      blockingRowCount += 1
    }

    rowPlans.push({
      rowNumber: row.row,
      sku: rawSku,
      normalizedSku,
      name: row.name ?? '',
      componentTypeRaw: String(row.componentType ?? ''),
      componentTypeLabel: getInspectComponentTypeLabel(row.componentType),
      excelPrimaryImageFile: rawPrimaryImageFile,
      excelImageUrl: rawImageUrl,
      sourceType,
      overridesExistingUrl,
      primaryFile,
      additionalFiles,
      blockingErrors: rowBlockingErrors,
      warnings: rowWarnings,
    })
  }

  // Cảnh báo thư mục ảnh thừa không nằm trong danh sách SKU của file Excel (không upload các thư mục này)
  const unusedFolders: UnusedFolderWarning[] = []
  if (folderInventory) {
    for (const [normSku, bucket] of folderInventory.skuBuckets.entries()) {
      if (!matchedSkuSet.has(normSku)) {
        const displayName =
          Array.from(bucket.rawFolderNames)[0] ?? bucket.normalizedSku
        unusedFolders.push({
          folderName: displayName,
          normalizedSku: normSku,
          fileCount: bucket.files.length,
        })
      }
    }
    unusedFolders.sort((a, b) =>
      naturalCompareFileNames(a.folderName, b.folderName)
    )
  }

  // Kiểm tra giới hạn batch trước khi cho phép upload
  if (localMatchedRowCount > MAX_IMAGE_MAPPINGS_SKU_COUNT) {
    globalBlockingErrors.push(
      `Số lượng SKU sử dụng ảnh local (${localMatchedRowCount}) vượt quá giới hạn tối đa ${MAX_IMAGE_MAPPINGS_SKU_COUNT} SKU mỗi lần import.`
    )
  }
  if (totalFilesToUpload > MAX_TOTAL_OBJECT_KEYS_COUNT) {
    globalBlockingErrors.push(
      `Tổng số tệp ảnh cần tải lên (${totalFilesToUpload}) vượt quá giới hạn tối đa ${MAX_TOTAL_OBJECT_KEYS_COUNT} tệp.`
    )
  }

  // Ước tính kích thước UTF-8 JSON của imageMappings trước khi upload
  if (localMatchedRowCount > 0) {
    const sampleObjectKey =
      'products/2026/11/00000000-0000-4000-8000-000000000000.webp'
    const estimatedMappings: ProductImportImageMappingDto[] = rowPlans
      .filter((r) => r.sourceType === 'local_folder' && r.primaryFile)
      .map((r) => ({
        sku: r.sku,
        primaryObjectKey: sampleObjectKey,
        additionalObjectKeys: r.additionalFiles.map(() => sampleObjectKey),
      }))
    const estimatedBytes = new TextEncoder().encode(
      JSON.stringify(estimatedMappings)
    ).length
    if (estimatedBytes > MAX_IMAGE_MAPPINGS_JSON_BYTES) {
      globalBlockingErrors.push(
        `Kích thước dữ liệu ánh xạ ảnh dự kiến (${Math.ceil(
          estimatedBytes / 1024
        )} KiB) vượt quá giới hạn 512 KiB của hệ thống. Vui lòng chia nhỏ file Excel.`
      )
    }
  }

  const hasAnyBlockingError =
    !inspectResult.isValid ||
    inspectErrors.length > 0 ||
    globalBlockingErrors.length > 0 ||
    blockingRowCount > 0 ||
    inspectRows.length === 0

  return {
    rows: rowPlans,
    unusedFolders,
    globalBlockingErrors,
    inspectErrors,
    inspectErrorsTruncated: Boolean(inspectResult.errorsTruncated),
    totalRows: inspectRows.length,
    localMatchedRowCount,
    urlOnlyRowCount,
    urlOverrideRowCount,
    blockingRowCount,
    totalFilesToUpload,
    hasAnyBlockingError,
  }
}

export type UploadTaskStatus =
  | 'pending'
  | 'uploading'
  | 'confirming'
  | 'confirmed'
  | 'error'

export interface UploadTaskItem {
  taskKey: string
  sku: string
  normalizedSku: string
  role: 'primary' | 'additional'
  additionalIndex: number
  entry: NormalizedFolderImageEntry
  status: UploadTaskStatus
  presignedUpload: ProductMediaUploadDto | null
  uploadedToR2: boolean
  confirmedMedia: ProductMediaDto | null
  errorMessage: string | null
  isCorsOrNetworkError: boolean
}

/**
 * Khởi tạo danh sách task upload phẳng từ các dòng local_folder hợp lệ trong SkuFolderMatchSummary.
 * Giữ lại trạng thái đã có nếu gọi lại trên cùng tập taskKey.
 */
export function createUploadTasksFromMatchSummary(
  summary: SkuFolderMatchSummary,
  previousTasks?: Map<string, UploadTaskItem>
): UploadTaskItem[] {
  const tasks: UploadTaskItem[] = []

  for (const row of summary.rows) {
    if (
      row.sourceType !== 'local_folder' ||
      row.blockingErrors.length > 0 ||
      !row.primaryFile
    ) {
      continue
    }

    const primaryKey = `${row.normalizedSku}::primary::${row.primaryFile.relativePath}`
    const prevPrimary = previousTasks?.get(primaryKey)
    tasks.push({
      taskKey: primaryKey,
      sku: row.sku,
      normalizedSku: row.normalizedSku,
      role: 'primary',
      additionalIndex: -1,
      entry: row.primaryFile,
      status: prevPrimary?.status === 'confirmed' ? 'confirmed' : (prevPrimary?.status ?? 'pending'),
      presignedUpload: prevPrimary?.presignedUpload ?? null,
      uploadedToR2: prevPrimary?.uploadedToR2 ?? false,
      confirmedMedia: prevPrimary?.confirmedMedia ?? null,
      errorMessage: prevPrimary?.errorMessage ?? null,
      isCorsOrNetworkError: prevPrimary?.isCorsOrNetworkError ?? false,
    })

    row.additionalFiles.forEach((addFile, idx) => {
      const addKey = `${row.normalizedSku}::additional::${idx}::${addFile.relativePath}`
      const prevAdd = previousTasks?.get(addKey)
      tasks.push({
        taskKey: addKey,
        sku: row.sku,
        normalizedSku: row.normalizedSku,
        role: 'additional',
        additionalIndex: idx,
        entry: addFile,
        status: prevAdd?.status === 'confirmed' ? 'confirmed' : (prevAdd?.status ?? 'pending'),
        presignedUpload: prevAdd?.presignedUpload ?? null,
        uploadedToR2: prevAdd?.uploadedToR2 ?? false,
        confirmedMedia: prevAdd?.confirmedMedia ?? null,
        errorMessage: prevAdd?.errorMessage ?? null,
        isCorsOrNetworkError: prevAdd?.isCorsOrNetworkError ?? false,
      })
    })
  }

  return tasks
}

export function isPresignedUploadExpired(
  presigned: ProductMediaUploadDto | null | undefined,
  nowMs = Date.now(),
  safetyBufferMs = 5000
): boolean {
  if (!presigned?.expiresAt) return true
  const parsed = Date.parse(presigned.expiresAt)
  if (Number.isNaN(parsed)) return false
  return parsed <= nowMs + safetyBufferMs
}

export interface DirectR2UploadFnParams {
  uploadUrl: string
  httpMethod: string
  requiredHeaders: Record<string, string>
  file: File | Blob
  signal?: AbortSignal
}

/**
 * Upload nhị phân trực tiếp lên Cloudflare R2 qua presigned URL.
 * TUYỆT ĐỐI KHÔNG gửi Authorization Bearer token hoặc credentials cookie sang R2.
 */
export async function defaultDirectUploadToR2(
  params: DirectR2UploadFnParams
): Promise<void> {
  const headers = new Headers()
  if (params.requiredHeaders && typeof params.requiredHeaders === 'object') {
    for (const [k, v] of Object.entries(params.requiredHeaders)) {
      if (k.toLowerCase() === 'authorization') continue
      if (typeof v === 'string' && v.trim()) {
        headers.set(k, v)
      }
    }
  }

  let response: Response
  try {
    response = await fetch(params.uploadUrl, {
      method: params.httpMethod || 'PUT',
      headers,
      body: params.file,
      mode: 'cors',
      credentials: 'omit',
      signal: params.signal,
    })
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    const corsError = new Error(
      'Không thể tải tệp trực tiếp lên kho lưu trữ R2 (lỗi mạng hoặc CORS). Vui lòng kiểm tra kết nối mạng hoặc cấu hình CORS trên bucket R2 cho phép Origin hiện tại, phương thức PUT và header Content-Type.'
    )
    ;(corsError as Error & { isCorsOrNetworkError?: boolean }).isCorsOrNetworkError =
      true
    throw corsError
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: `Tải tệp lên kho lưu trữ R2 thất bại (HTTP ${response.status}).`,
    })
  }
}

export interface ExecuteUploadWorkerDeps {
  tasks: UploadTaskItem[]
  concurrency?: number
  nowMs?: () => number
  isContextCurrent: () => boolean
  signal?: AbortSignal
  onlyTaskKeys?: Set<string>
  createUploadRequest: (
    req: CreateProductMediaUploadRequest
  ) => Promise<ProductMediaUploadDto>
  directUploadToR2?: (params: DirectR2UploadFnParams) => Promise<void>
  confirmUpload: (objectKey: string) => Promise<ProductMediaDto>
  onTasksChange: (updatedTasks: UploadTaskItem[]) => void
}

export interface UploadWorkerRunResult {
  tasks: UploadTaskItem[]
  allConfirmed: boolean
  confirmedCount: number
  failedCount: number
  hasCorsError: boolean
}

/**
 * Worker tải ảnh theo lô với giới hạn tối đa 3 file song song (MAX_UPLOAD_CONCURRENCY = 3):
 * - Không bao giờ upload lại các file đã ở trạng thái 'confirmed'
 * - Nếu PUT lên R2 đã thành công trước đó nhưng bước confirm bị lỗi, khi retry sẽ thử gọi confirm trước
 * - Nếu presigned URL đã hết hạn trước khi PUT, tự động xin presigned URL mới cho đúng file đó
 * - Không tự động retry vô hạn toàn bộ batch
 */
export async function executeMatchedImagesUpload(
  deps: ExecuteUploadWorkerDeps
): Promise<UploadWorkerRunResult> {
  const maxConcurrency = Math.max(
    1,
    Math.min(deps.concurrency ?? MAX_UPLOAD_CONCURRENCY, MAX_UPLOAD_CONCURRENCY)
  )
  const getNow = deps.nowMs ?? (() => Date.now())
  const putToR2 = deps.directUploadToR2 ?? defaultDirectUploadToR2

  const workingTasks: UploadTaskItem[] = deps.tasks.map((t) => ({ ...t }))
  const notify = () => {
    if (deps.isContextCurrent()) {
      deps.onTasksChange(workingTasks.map((t) => ({ ...t })))
    }
  }

  const candidateIndices: number[] = []
  for (let i = 0; i < workingTasks.length; i++) {
    const task = workingTasks[i]
    // Không bao giờ upload lại file đã confirmed
    if (task.status === 'confirmed' && task.confirmedMedia?.objectKey) {
      continue
    }
    if (deps.onlyTaskKeys && !deps.onlyTaskKeys.has(task.taskKey)) {
      continue
    }
    candidateIndices.push(i)
  }

  let cursor = 0

  const runSingleTask = async (index: number): Promise<void> => {
    if (!deps.isContextCurrent()) return
    const task = workingTasks[index]

    if (task.status === 'confirmed' && task.confirmedMedia?.objectKey) {
      return
    }

    const contentType = task.entry.resolvedContentType
    if (!contentType) {
      task.status = 'error'
      task.errorMessage =
        task.entry.validationError ?? 'Định dạng ảnh không hợp lệ.'
      notify()
      return
    }

    try {
      // Trường hợp 1: PUT lên R2 đã thành công ở lần chạy trước, chỉ bước confirm bị lỗi -> thử confirm trước!
      if (task.uploadedToR2 && task.presignedUpload?.objectKey) {
        task.status = 'confirming'
        task.errorMessage = null
        task.isCorsOrNetworkError = false
        notify()

        try {
          const confirmed = await deps.confirmUpload(
            task.presignedUpload.objectKey
          )
          if (!deps.isContextCurrent()) return
          task.confirmedMedia = confirmed
          task.status = 'confirmed'
          task.errorMessage = null
          notify()
          return
        } catch (confirmErr: unknown) {
          if (!deps.isContextCurrent()) return
          if (confirmErr instanceof Error && confirmErr.name === 'AbortError') {
            return
          }
          // Nếu object không tồn tại hoặc metadata lỗi trên R2 thì xóa trạng thái uploadedToR2 để lần retry sau có thể xin presign mới
          if (
            confirmErr instanceof ApiError &&
            (confirmErr.status === 404 ||
              confirmErr.code === 'ProductMedia.NotFound' ||
              confirmErr.code === 'ProductMedia.InvalidMetadata')
          ) {
            task.uploadedToR2 = false
            task.presignedUpload = null
          }
          task.status = 'error'
          task.errorMessage = mapAdminApiError(
            confirmErr,
            `Xác nhận ảnh "${task.entry.relativePath}" thất bại.`
          )
          notify()
          return
        }
      }

      // Trường hợp 2: Chưa PUT lên R2 -> kiểm tra presigned URL còn hạn hay cần xin mới
      task.status = 'uploading'
      task.errorMessage = null
      task.isCorsOrNetworkError = false
      notify()

      if (
        !task.presignedUpload ||
        isPresignedUploadExpired(task.presignedUpload, getNow())
      ) {
        const presigned = await deps.createUploadRequest({
          fileName: task.entry.fileName,
          contentType,
          contentLength: task.entry.size,
        })
        if (!deps.isContextCurrent()) return
        task.presignedUpload = presigned
        task.uploadedToR2 = false
        notify()
      }

      await putToR2({
        uploadUrl: task.presignedUpload.uploadUrl,
        httpMethod: task.presignedUpload.httpMethod || 'PUT',
        requiredHeaders: task.presignedUpload.requiredHeaders ?? {
          'Content-Type': contentType,
        },
        file: task.entry.file,
        signal: deps.signal,
      })

      if (!deps.isContextCurrent()) return
      task.uploadedToR2 = true
      task.status = 'confirming'
      notify()

      const confirmed = await deps.confirmUpload(task.presignedUpload.objectKey)
      if (!deps.isContextCurrent()) return

      task.confirmedMedia = confirmed
      task.status = 'confirmed'
      task.errorMessage = null
      notify()
    } catch (err: unknown) {
      if (!deps.isContextCurrent()) return
      if (err instanceof Error && err.name === 'AbortError') return
      if (err instanceof ApiError && err.isAbortError) return

      const isCors = Boolean(
        (err as { isCorsOrNetworkError?: boolean } | null)?.isCorsOrNetworkError
      )
      task.status = 'error'
      task.isCorsOrNetworkError = isCors
      task.errorMessage = mapAdminApiError(
        err,
        `Tải ảnh "${task.entry.relativePath}" thất bại.`
      )
      notify()
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, candidateIndices.length) },
    async () => {
      while (cursor < candidateIndices.length) {
        if (!deps.isContextCurrent()) return
        if (deps.signal?.aborted) return
        const idx = candidateIndices[cursor++]
        await runSingleTask(idx)
      }
    }
  )

  await Promise.all(workers)

  const confirmedCount = workingTasks.filter(
    (t) => t.status === 'confirmed' && Boolean(t.confirmedMedia?.objectKey)
  ).length
  const failedCount = workingTasks.filter((t) => t.status === 'error').length
  const hasCorsError = workingTasks.some((t) => t.isCorsOrNetworkError)
  const allConfirmed =
    workingTasks.length > 0 && confirmedCount === workingTasks.length

  return {
    tasks: workingTasks,
    allConfirmed,
    confirmedCount,
    failedCount,
    hasCorsError,
  }
}

export function isValidManagedObjectKey(objectKey: string | null | undefined): boolean {
  if (!objectKey || typeof objectKey !== 'string') return false
  const trimmed = objectKey.trim()
  if (
    trimmed.includes('..') ||
    trimmed.includes('//') ||
    trimmed.includes('?') ||
    trimmed.includes('#')
  ) {
    return false
  }
  return MANAGED_OBJECT_KEY_REGEX.test(trimmed)
}

export interface ImageMappingsBuildResult {
  isValid: boolean
  errors: string[]
  mappings: ProductImportImageMappingDto[]
  jsonByteLength: number
}

/**
 * Xây dựng mảng imageMappings [{ sku, primaryObjectKey, additionalObjectKeys }]
 * CHỈ từ các objectKey đã được confirm (POST /product-media/confirmations), gắn đúng theo khóa SKU (không theo index dòng).
 * Các dòng URL-only không tạo phần tử trong imageMappings.
 */
export function buildConfirmedImageMappings(
  matchSummary: SkuFolderMatchSummary,
  uploadTasks: UploadTaskItem[]
): ImageMappingsBuildResult {
  const errors: string[] = []
  const taskMap = new Map<string, UploadTaskItem>()
  for (const t of uploadTasks) {
    taskMap.set(t.taskKey, t)
  }

  const mappings: ProductImportImageMappingDto[] = []
  const seenSkus = new Set<string>()
  let totalKeys = 0

  for (const row of matchSummary.rows) {
    if (row.sourceType !== 'local_folder') {
      continue
    }

    if (!row.sku.trim()) {
      errors.push(`Dòng ${row.rowNumber} thiếu mã SKU để tạo ánh xạ ảnh.`)
      continue
    }

    if (seenSkus.has(row.normalizedSku)) {
      errors.push(
        `Mã SKU "${row.sku}" bị trùng lặp khi tạo danh sách imageMappings.`
      )
      continue
    }
    seenSkus.add(row.normalizedSku)

    if (!row.primaryFile) {
      errors.push(`SKU "${row.sku}" thiếu tệp ảnh chính.`)
      continue
    }

    const primaryTaskKey = `${row.normalizedSku}::primary::${row.primaryFile.relativePath}`
    const primaryTask = taskMap.get(primaryTaskKey)
    const primaryObjectKey = primaryTask?.confirmedMedia?.objectKey?.trim() ?? ''

    if (
      !primaryTask ||
      primaryTask.status !== 'confirmed' ||
      !primaryObjectKey
    ) {
      errors.push(
        `Ảnh chính "${row.primaryFile.relativePath}" của SKU "${row.sku}" chưa được tải lên và xác nhận hoàn tất.`
      )
      continue
    }

    if (!isValidManagedObjectKey(primaryObjectKey)) {
      errors.push(
        `ObjectKey ảnh chính "${primaryObjectKey}" của SKU "${row.sku}" không đúng định dạng quản lý.`
      )
      continue
    }

    const additionalObjectKeys: string[] = []
    const seenKeysInSku = new Set<string>([primaryObjectKey.toLowerCase()])

    for (let idx = 0; idx < row.additionalFiles.length; idx++) {
      const addFile = row.additionalFiles[idx]
      const addTaskKey = `${row.normalizedSku}::additional::${idx}::${addFile.relativePath}`
      const addTask = taskMap.get(addTaskKey)
      const addObjectKey = addTask?.confirmedMedia?.objectKey?.trim() ?? ''

      if (!addTask || addTask.status !== 'confirmed' || !addObjectKey) {
        errors.push(
          `Ảnh phụ "${addFile.relativePath}" của SKU "${row.sku}" chưa được tải lên và xác nhận hoàn tất.`
        )
        continue
      }

      if (!isValidManagedObjectKey(addObjectKey)) {
        errors.push(
          `ObjectKey ảnh phụ "${addObjectKey}" của SKU "${row.sku}" không đúng định dạng quản lý.`
        )
        continue
      }

      const lowerKey = addObjectKey.toLowerCase()
      if (seenKeysInSku.has(lowerKey)) {
        errors.push(
          `ObjectKey ảnh phụ "${addObjectKey}" của SKU "${row.sku}" bị trùng lặp.`
        )
        continue
      }
      seenKeysInSku.add(lowerKey)
      additionalObjectKeys.push(addObjectKey)
    }

    if (additionalObjectKeys.length > MAX_ADDITIONAL_IMAGES_PER_SKU) {
      errors.push(
        `SKU "${row.sku}" vượt quá tối đa ${MAX_ADDITIONAL_IMAGES_PER_SKU} ảnh phụ.`
      )
      continue
    }

    totalKeys += 1 + additionalObjectKeys.length
    mappings.push({
      sku: row.sku.trim(),
      primaryObjectKey,
      additionalObjectKeys,
    })
  }

  if (mappings.length > MAX_IMAGE_MAPPINGS_SKU_COUNT) {
    errors.push(
      `Số lượng SKU trong imageMappings (${mappings.length}) vượt quá giới hạn ${MAX_IMAGE_MAPPINGS_SKU_COUNT}.`
    )
  }

  if (totalKeys > MAX_TOTAL_OBJECT_KEYS_COUNT) {
    errors.push(
      `Tổng số lượng objectKey trong imageMappings (${totalKeys}) vượt quá giới hạn ${MAX_TOTAL_OBJECT_KEYS_COUNT}.`
    )
  }

  const serialized = JSON.stringify(mappings)
  const jsonByteLength = new TextEncoder().encode(serialized).length

  if (jsonByteLength > MAX_IMAGE_MAPPINGS_JSON_BYTES) {
    errors.push(
      `Kích thước JSON của imageMappings (${Math.ceil(
        jsonByteLength / 1024
      )} KiB) vượt quá giới hạn 512 KiB.`
    )
  }

  return {
    isValid: errors.length === 0,
    errors,
    mappings,
    jsonByteLength,
  }
}

/**
 * Tạo khóa snapshot đại diện cho phiên bản hiện tại của (workbookFile + imageMappings)
 * để đảm bảo khi đổi workbook, đổi folder, hoặc thay đổi bất kỳ mapping nào,
 * kết quả validate cũ lập tức bị vô hiệu hóa (không thể bấm Import trên dữ liệu đã thay đổi).
 */
export function createImportSnapshotSignature(params: {
  workbookFile: { name: string; size: number; lastModified?: number } | null
  imageMappings: ProductImportImageMappingDto[]
}): string {
  if (!params.workbookFile) return ''
  const fileSig = `${params.workbookFile.name}::${params.workbookFile.size}::${
    params.workbookFile.lastModified ?? 0
  }`
  const mappingsSig = JSON.stringify(params.imageMappings ?? [])
  return `${fileSig}##${mappingsSig}`
}

export function canCommitValidatedImport(params: {
  validationResult: ProductImportValidationResultDto | null
  validatedSignature: string | null
  currentSignature: string
  isBusy: boolean
}): boolean {
  if (params.isBusy) return false
  if (!params.validationResult || !params.validationResult.isValid) return false
  if (params.validationResult.totalRows <= 0) return false
  if (params.validationResult.validRows <= 0) return false
  if (!params.validatedSignature || !params.currentSignature) return false
  return params.validatedSignature === params.currentSignature
}

export interface ExecuteImportCommitDeps {
  workbookFile: File | Blob
  workbookFileName?: string
  imageMappings: ProductImportImageMappingDto[]
  validationResult: ProductImportValidationResultDto | null
  validatedSignature: string | null
  currentSignature: string
  isSubmitting: boolean
  isContextCurrent: () => boolean
  commitImport: (params: {
    file: File | Blob
    fileName?: string
    imageMappings?: ProductImportImageMappingDto[] | null
  }) => Promise<ProductImportCommitResultDto>
  onSubmittingChange: (submitting: boolean) => void
  onError: (message: string | null, isAmbiguousTimeoutOrNetwork?: boolean) => void
  onValidationFailedWithoutCommit: (
    validation: ProductImportValidationResultDto
  ) => void
  onCommittedSuccess: (result: ProductImportCommitResultDto) => void
}

/**
 * Thực thi POST /api/v1/product-imports/import:
 * - Chặn double-click hoặc chạy khi validation đã bị vô hiệu hóa bởi thay đổi file/mapping
 * - Khi 201 Created và isCommitted === true -> báo thành công kèm danh sách SKU vừa tạo
 * - Khi 200 OK và isCommitted === false -> cập nhật lại bảng lỗi validation, TUYỆT ĐỐI không báo thành công giả
 * - Khi timeout / lỗi mạng / 5xx -> KHÔNG tự động retry POST để tránh tạo trùng hoặc báo lỗi sai;
 *   hiển thị cảnh báo trạng thái chưa xác định và hướng dẫn kiểm tra danh sách sản phẩm trước khi thử lại.
 */
export async function executeProductImportCommit(
  deps: ExecuteImportCommitDeps
): Promise<boolean> {
  if (
    !canCommitValidatedImport({
      validationResult: deps.validationResult,
      validatedSignature: deps.validatedSignature,
      currentSignature: deps.currentSignature,
      isBusy: deps.isSubmitting,
    })
  ) {
    return false
  }

  deps.onError(null, false)
  deps.onSubmittingChange(true)

  try {
    const result = await deps.commitImport({
      file: deps.workbookFile,
      fileName: deps.workbookFileName,
      imageMappings:
        deps.imageMappings.length > 0 ? deps.imageMappings : undefined,
    })

    if (!deps.isContextCurrent()) return false

    if (!result.isCommitted) {
      deps.onValidationFailedWithoutCommit(result.validation)
      deps.onError(
        'Dữ liệu không vượt qua bước kiểm tra cuối cùng. Không có sản phẩm nào được tạo.',
        false
      )
      return false
    }

    deps.onCommittedSuccess(result)
    return true
  } catch (err: unknown) {
    if (!deps.isContextCurrent()) return false
    if (err instanceof Error && err.name === 'AbortError') return false
    if (err instanceof ApiError && err.isAbortError) return false

    const isAmbiguous =
      (err instanceof ApiError &&
        (err.isNetworkError || err.status >= 500 || err.status === 0)) ||
      !(err instanceof ApiError)

    if (isAmbiguous) {
      deps.onError(
        'Yêu cầu import bị gián đoạn kết nối hoặc quá thời gian phản hồi. Hệ thống KHÔNG tự động gửi lại để tránh trùng lặp. Vui lòng kiểm tra các mã SKU trong Danh sách sản phẩm trước khi thử lại.',
        true
      )
      return false
    }

    deps.onError(
      mapAdminApiError(
        err,
        'Không thể thực hiện import sản phẩm. Vui lòng kiểm tra lại dữ liệu.'
      ),
      false
    )
    return false
  } finally {
    if (deps.isContextCurrent()) {
      deps.onSubmittingChange(false)
    }
  }
}

/**
 * Bộ quản lý vòng đời ObjectURL cho ảnh xem trước (thumbnails) và tệp tải về:
 * đảm bảo thu hồi toàn bộ ObjectURL khi thay đổi thư mục ảnh hoặc khi unmount trang.
 */
export function createObjectUrlPool(urlApi: {
  createObjectURL: (blob: Blob) => string
  revokeObjectURL: (url: string) => void
} = URL) {
  const map = new Map<string, string>()

  return {
    getOrCreate(key: string, blob: Blob): string {
      const existing = map.get(key)
      if (existing) return existing
      const created = urlApi.createObjectURL(blob)
      map.set(key, created)
      return created
    },
    revokeAll(): void {
      for (const url of map.values()) {
        try {
          urlApi.revokeObjectURL(url)
        } catch {
          // Bỏ qua nếu trình duyệt đã thu hồi
        }
      }
      map.clear()
    },
    get activeCount(): number {
      return map.size
    },
  }
}

/**
 * Kích hoạt tải file Blob trên trình duyệt và chỉ thu hồi ObjectURL sau khi trình duyệt đã nhận lệnh tải (mặc định 60 giây).
 */
export function triggerBrowserBlobDownload(params: {
  blob: Blob
  fileName: string
  revokeDelayMs?: number
  urlApi?: {
    createObjectURL: (blob: Blob) => string
    revokeObjectURL: (url: string) => void
  }
  scheduleRevoke?: (fn: () => void, delayMs: number) => void
}): string {
  const urlApi = params.urlApi ?? URL
  const schedule =
    params.scheduleRevoke ?? ((fn, delay) => window.setTimeout(fn, delay))
  const delayMs = params.revokeDelayMs ?? 60_000

  const objectUrl = urlApi.createObjectURL(params.blob)

  if (typeof document !== 'undefined') {
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = params.fileName || 'riutek-product-import-v1.0.xlsx'
    anchor.style.display = 'none'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  schedule(() => {
    try {
      urlApi.revokeObjectURL(objectUrl)
    } catch {
      // Ignore
    }
  }, delayMs)

  return objectUrl
}