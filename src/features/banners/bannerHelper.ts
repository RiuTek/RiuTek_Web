import {
  createProductMediaUploadRequest,
  confirmProductMediaUpload,
} from '../admin/adminApi'
import {
  defaultDirectUploadToR2,
  validateAndResolveLocalImageFile,
} from '../admin/adminProductImportHelper'

export interface BannerFieldValidationResult {
  isValid: boolean
  error: string | null
}

export interface BannerOrderValidationResult {
  isValid: boolean
  value: number
  error: string | null
}

/**
 * Kiểm tra tiêu đề banner:
 * - Bắt buộc (sau khi trim không được rỗng)
 * - Tối đa 160 ký tự theo contract Backend
 */
export function validateBannerTitle(rawTitle: string): BannerFieldValidationResult {
  const title = (rawTitle ?? '').trim()
  if (!title) {
    return { isValid: false, error: 'Tiêu đề banner không được để trống.' }
  }
  if (title.length > 160) {
    return {
      isValid: false,
      error: `Tiêu đề banner không được vượt quá 160 ký tự (hiện có ${title.length} ký tự).`,
    }
  }
  return { isValid: true, error: null }
}

/**
 * Kiểm tra đường dẫn liên kết đích (targetUrl) của banner:
 * - Bắt buộc, tối đa 2048 ký tự
 * - Chỉ chấp nhận đường dẫn nội bộ bắt đầu bằng duy nhất một dấu "/"
 * - Không cho phép URL tuyệt đối (http/https), URL tương đối giao thức (//host), gạch chéo ngược (\)
 *   hoặc ký tự điều khiển (ASCII < 32 hoặc 127).
 * - Được phép chứa query string và hash an toàn (ví dụ: /products?categoryId=... hoặc /products/intel-core-i5-13400f).
 */
export function validateBannerTargetUrl(rawUrl: string): BannerFieldValidationResult {
  const url = (rawUrl ?? '').trim()
  if (!url) {
    return { isValid: false, error: 'Đường dẫn liên kết không được để trống.' }
  }
  if (url.length > 2048) {
    return {
      isValid: false,
      error: `Đường dẫn liên kết không được vượt quá 2048 ký tự (hiện có ${url.length} ký tự).`,
    }
  }
  if (!url.startsWith('/')) {
    return {
      isValid: false,
      error: 'Đường dẫn liên kết phải là đường dẫn nội bộ bắt đầu bằng dấu "/" (ví dụ: /products/<slug> hoặc /pc-builder).',
    }
  }
  if (url.startsWith('//')) {
    return {
      isValid: false,
      error: 'Đường dẫn liên kết không được bắt đầu bằng "//".',
    }
  }
  if (url.includes('\\')) {
    return {
      isValid: false,
      error: 'Đường dẫn liên kết không được chứa ký tự gạch chéo ngược ("\\").',
    }
  }
  // Ký tự điều khiển (ASCII 0x00..0x1F, 0x7F)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(url)) {
    return {
      isValid: false,
      error: 'Đường dẫn liên kết chứa ký tự điều khiển không hợp lệ.',
    }
  }
  // Ngăn chặn các scheme kịch bản hoặc liên kết tuyệt đối giả mạo
  if (/^(\/|)(https?:|javascript:|data:|vbscript:)/i.test(url)) {
    return {
      isValid: false,
      error: 'Đường dẫn liên kết không được chứa scheme bên ngoài hoặc mã kịch bản.',
    }
  }
  return { isValid: true, error: null }
}

/**
 * Kiểm tra thứ tự hiển thị (displayOrder):
 * - Là số nguyên int32 >= 0
 * - Không chấp nhận số thập phân (1.5) hoặc chuỗi lai (1abc)
 */
export function validateBannerDisplayOrder(rawOrder: unknown): BannerOrderValidationResult {
  if (typeof rawOrder === 'number') {
    if (!Number.isInteger(rawOrder) || rawOrder < 0 || rawOrder > 2147483647) {
      return {
        isValid: false,
        value: 0,
        error: 'Thứ tự hiển thị phải là số nguyên dương hoặc 0 (tối đa 2.147.483.647).',
      }
    }
    return { isValid: true, value: rawOrder, error: null }
  }

  const str = String(rawOrder ?? '').trim()
  if (!str) {
    return { isValid: true, value: 0, error: null }
  }

  if (!/^\d+$/.test(str)) {
    return {
      isValid: false,
      value: 0,
      error: 'Thứ tự hiển thị phải là số nguyên không âm (ví dụ: 0, 1, 2...).',
    }
  }

  const parsed = Number(str)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 2147483647) {
    return {
      isValid: false,
      value: 0,
      error: 'Thứ tự hiển thị vượt quá giới hạn số nguyên 32-bit cho phép.',
    }
  }

  return { isValid: true, value: parsed, error: null }
}

/**
 * Kiểm tra nhanh xem targetUrl có an toàn để điều hướng qua React Router Link hay không
 */
export function isSafeInternalTargetUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return false
  }
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return false
  }
  if (/^(\/|)(https?:|javascript:|data:|vbscript:)/i.test(trimmed)) {
    return false
  }
  return true
}

export interface BannerUploadResult {
  objectKey: string
  publicUrl: string
}

/**
 * Thực hiện toàn bộ quy trình upload ảnh banner lên Cloudflare R2:
 * 1. Kiểm tra định dạng (.jpg, .png, .webp) và kích thước file
 * 2. POST /product-media/upload-requests xin presigned URL
 * 3. PUT nhị phân trực tiếp lên R2 bằng fetch (credentials omit, không Bearer)
 * 4. POST /product-media/confirmations xác nhận objectKey đã lưu
 */
export async function uploadBannerImage(params: {
  file: File
  token: string
  signal?: AbortSignal
}): Promise<BannerUploadResult> {
  const { file, token, signal } = params

  // 1. Kiểm tra file client
  const validation = validateAndResolveLocalImageFile({
    name: file.name,
    size: file.size,
    type: file.type,
  })

  if (!validation.isValid || !validation.resolvedContentType) {
    throw new Error(validation.error ?? 'Định dạng tệp ảnh không hợp lệ.')
  }

  // 2. Xin presigned upload URL
  const uploadRequest = await createProductMediaUploadRequest(
    {
      fileName: file.name,
      contentType: validation.resolvedContentType,
      contentLength: file.size,
    },
    token,
    signal
  )

  // 3. PUT trực tiếp lên Cloudflare R2
  await defaultDirectUploadToR2({
    uploadUrl: uploadRequest.uploadUrl,
    httpMethod: uploadRequest.httpMethod || 'PUT',
    requiredHeaders: uploadRequest.requiredHeaders,
    file,
    signal,
  })

  // 4. Xác nhận tải lên thành công
  const confirmation = await confirmProductMediaUpload(
    { objectKey: uploadRequest.objectKey },
    token,
    signal
  )

  return {
    objectKey: confirmation.objectKey,
    publicUrl: confirmation.publicUrl || uploadRequest.publicUrl,
  }
}
