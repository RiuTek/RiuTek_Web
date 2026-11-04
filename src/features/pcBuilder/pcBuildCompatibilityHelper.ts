import type { CompatibilityIssue } from './pcBuilderTypes'

export const COMPATIBILITY_GUIDANCE_NOTICE =
  'Bạn vẫn có thể lưu cấu hình và mua linh kiện sau khi xem các lưu ý này.'

export const COMPATIBILITY_UNVERIFIED_NOTICE =
  'Chưa thể kiểm tra tương thích. Bạn có thể thử kiểm tra lại hoặc vẫn lưu cấu hình.'

export const COMPATIBILITY_LABELS = {
  error: 'Có xung đột tương thích',
  warning: 'Có lưu ý cần kiểm tra',
  clean: 'Chưa phát hiện xung đột theo thông số hiện có',
  incomplete: 'Cấu hình chưa đầy đủ',
  complete: 'Đủ linh kiện cơ bản',
  unverified: 'Chưa thể kiểm tra tương thích',
} as const

export interface ClassifiedIssues {
  errors: CompatibilityIssue[]
  warnings: CompatibilityIssue[]
  others: CompatibilityIssue[]
  hasErrors: boolean
  hasWarnings: boolean
  hasOthers: boolean
  totalCount: number
}

/**
 * Phân loại danh sách issues theo severity do Backend trả về:
 * - Error: Lỗi tương thích phần cứng (vd: COMP-13 PSU dài hơn case, COMP-10 thiếu công suất ước tính)
 * - Warning: Lưu ý phần cứng (vd: COMP-12 CPU không iGPU và chưa có card rời, công suất dưới khuyến nghị)
 * - Others: Các mức độ khác (Info hoặc mã severity mới trong tương lai) - giữ nguyên message, không loại bỏ
 */
export function classifyCompatibilityIssues(
  issues: CompatibilityIssue[] | null | undefined
): ClassifiedIssues {
  const safeIssues = Array.isArray(issues) ? issues : []
  const errors: CompatibilityIssue[] = []
  const warnings: CompatibilityIssue[] = []
  const others: CompatibilityIssue[] = []

  for (const issue of safeIssues) {
    if (!issue || typeof issue !== 'object') continue
    const sev = (issue.severity ?? '').trim().toLowerCase()
    if (sev === 'error') {
      errors.push(issue)
    } else if (sev === 'warning') {
      warnings.push(issue)
    } else {
      others.push(issue)
    }
  }

  return {
    errors,
    warnings,
    others,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    hasOthers: others.length > 0,
    totalCount: safeIssues.length,
  }
}

export type CompatibilityLevel = 'error' | 'warning' | 'clean' | 'unverified'

export interface CompatibilityAssessment {
  level: CompatibilityLevel
  badgeLabel: string
  title: string
  requiresConfirmation: boolean
  classifiedIssues: ClassifiedIssues
  guidanceMessage: string
  isGenericErrorNotice: boolean
}

/**
 * Đánh giá tổng quan tương thích cho một cấu hình PC:
 * - Error: Có issues severity Error HOẶC isCompatible === false
 * - Warning: Không có Error nhưng có ít nhất 1 issue Warning (isCompatible=true không được che Warning)
 * - Clean: Không có Error, không có Warning, và isCompatible === true (không bao giờ khẳng định 100% / hoàn toàn)
 * - Unverified: Chưa có dữ liệu preview hoặc preview bị lỗi
 */
export function evaluateCompatibility(params: {
  isCompatible?: boolean | null
  issues?: CompatibilityIssue[] | null
  hasPreviewError?: boolean
}): CompatibilityAssessment {
  const { isCompatible, issues, hasPreviewError } = params
  const classified = classifyCompatibilityIssues(issues)

  if (hasPreviewError) {
    return {
      level: 'unverified',
      badgeLabel: COMPATIBILITY_LABELS.unverified,
      title: COMPATIBILITY_LABELS.unverified,
      requiresConfirmation: true,
      classifiedIssues: classified,
      guidanceMessage: COMPATIBILITY_UNVERIFIED_NOTICE,
      isGenericErrorNotice: false,
    }
  }

  const isExplicitlyIncompatible = isCompatible === false
  const hasErrors = classified.hasErrors || isExplicitlyIncompatible

  if (hasErrors) {
    return {
      level: 'error',
      badgeLabel: COMPATIBILITY_LABELS.error,
      title: COMPATIBILITY_LABELS.error,
      requiresConfirmation: true,
      classifiedIssues: classified,
      guidanceMessage: COMPATIBILITY_GUIDANCE_NOTICE,
      isGenericErrorNotice: isExplicitlyIncompatible && !classified.hasErrors,
    }
  }

  if (classified.hasWarnings) {
    return {
      level: 'warning',
      badgeLabel: COMPATIBILITY_LABELS.warning,
      title: COMPATIBILITY_LABELS.warning,
      requiresConfirmation: false,
      classifiedIssues: classified,
      guidanceMessage: COMPATIBILITY_GUIDANCE_NOTICE,
      isGenericErrorNotice: false,
    }
  }

  if (isCompatible === true) {
    return {
      level: 'clean',
      badgeLabel: COMPATIBILITY_LABELS.clean,
      title: COMPATIBILITY_LABELS.clean,
      requiresConfirmation: false,
      classifiedIssues: classified,
      guidanceMessage: COMPATIBILITY_GUIDANCE_NOTICE,
      isGenericErrorNotice: false,
    }
  }

  return {
    level: 'unverified',
    badgeLabel: COMPATIBILITY_LABELS.unverified,
    title: COMPATIBILITY_LABELS.unverified,
    requiresConfirmation: true,
    classifiedIssues: classified,
    guidanceMessage: COMPATIBILITY_UNVERIFIED_NOTICE,
    isGenericErrorNotice: false,
  }
}
