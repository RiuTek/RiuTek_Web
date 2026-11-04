import {
  evaluateCompatibility,
  type CompatibilityAssessment,
} from './pcBuildCompatibilityHelper'
import type {
  PCBuildItemInput,
  PCBuildPreviewResult,
} from './pcBuilderTypes'

export type SaveActionDecision =
  | 'wait_loading'
  | 'unverified_preview'
  | 'confirm_required'
  | 'save_directly'

export interface SaveDecisionParams {
  previewResult: PCBuildPreviewResult | null
  isPreviewLoading: boolean
  previewError: string | null
}

/**
 * Xác định hành vi submit theo bảng quyết định của kế hoạch:
 * - Preview đang tải: 'wait_loading' (chờ kết quả selection hiện tại, không dùng kết quả cũ)
 * - Preview đã thất bại hoặc thiếu sau tải xong: 'unverified_preview' (chưa thể kiểm tra tương thích, cho phép thử lại hoặc vẫn lưu)
 * - Có Error hoặc isCompatible=false: 'confirm_required' (mở bước xác nhận trước khi gọi POST/PUT)
 * - Chỉ Warning, chỉ thiếu linh kiện hoặc không phát hiện xung đột: 'save_directly' (lưu trực tiếp)
 */
export function determineSaveDecision(params: SaveDecisionParams): SaveActionDecision {
  const { previewResult, isPreviewLoading, previewError } = params

  if (isPreviewLoading) {
    return 'wait_loading'
  }

  if (previewError || !previewResult) {
    return 'unverified_preview'
  }

  const assessment = evaluateCompatibility({
    isCompatible: previewResult.isCompatible,
    issues: previewResult.issues,
    hasPreviewError: false,
  })

  if (assessment.requiresConfirmation) {
    return 'confirm_required'
  }

  return 'save_directly'
}

export interface SaveConfirmationSnapshot {
  flow: 'create' | 'edit'
  configKey: string
  ownerId: string
  buildId?: string | null
  payload: {
    name: string
    description?: string | null
    items: PCBuildItemInput[]
  }
  assessment: CompatibilityAssessment
  isCompleteSystem: boolean
  missingComponents: string[]
  estimatedWattage: number
  recommendedPsuWattage: number
  previewResult: PCBuildPreviewResult | null
  previewError: string | null
  createdAt: number
}

/**
 * Tạo snapshot xác nhận lưu cấu hình gắn liền với context hiển thị hiện hành.
 * Không lưu vào sessionStorage/localStorage/server.
 */
export function createSaveConfirmationSnapshot(params: {
  flow: 'create' | 'edit'
  configKey: string
  ownerId: string
  buildId?: string | null
  payload: {
    name: string
    description?: string | null
    items: PCBuildItemInput[]
  }
  previewResult: PCBuildPreviewResult | null
  previewError: string | null
}): SaveConfirmationSnapshot {
  const assessment = evaluateCompatibility({
    isCompatible: params.previewResult?.isCompatible,
    issues: params.previewResult?.issues,
    hasPreviewError: Boolean(params.previewError || !params.previewResult),
  })

  return {
    flow: params.flow,
    configKey: params.configKey,
    ownerId: params.ownerId.trim(),
    buildId: params.buildId?.trim() || null,
    payload: {
      name: params.payload.name.trim(),
      description: params.payload.description?.trim() || null,
      items: params.payload.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    },
    assessment,
    isCompleteSystem: params.previewResult?.isCompleteSystem ?? false,
    missingComponents: params.previewResult?.missingComponents ?? [],
    estimatedWattage: params.previewResult?.estimatedWattage ?? 0,
    recommendedPsuWattage: params.previewResult?.recommendedPsuWattage ?? 0,
    previewResult: params.previewResult,
    previewError: params.previewError,
    createdAt: Date.now(),
  }
}

/**
 * Kiểm tra snapshot xác nhận còn khớp hoàn toàn với context, selection và preview hiện hành hay không:
 * - Cùng ownerId, buildId (nếu là edit), cùng configKey (linh kiện & số lượng)
 * - Cùng tên và mô tả đã nhập
 * - Không đang trong trạng thái loading preview mới
 * - Kết quả đánh giá tương thích không bị thay đổi bởi response preview mới
 */
export function isSaveConfirmationValid(params: {
  snapshot: SaveConfirmationSnapshot | null
  currentConfigKey: string
  currentOwnerId: string | null
  currentBuildId?: string | null
  currentPayload: {
    name: string
    description?: string | null
    items: PCBuildItemInput[]
  }
  previewResult: PCBuildPreviewResult | null
  isPreviewLoading: boolean
  previewError: string | null
}): boolean {
  const {
    snapshot,
    currentConfigKey,
    currentOwnerId,
    currentBuildId,
    currentPayload,
    previewResult,
    isPreviewLoading,
    previewError,
  } = params

  if (!snapshot || !currentOwnerId || !currentOwnerId.trim()) {
    return false
  }

  if (isPreviewLoading) {
    return false
  }

  if (snapshot.ownerId !== currentOwnerId.trim()) {
    return false
  }

  const cleanBuildId = currentBuildId?.trim() || null
  if (snapshot.buildId !== cleanBuildId) {
    return false
  }

  if (snapshot.configKey !== currentConfigKey) {
    return false
  }

  if (snapshot.payload.name !== currentPayload.name.trim()) {
    return false
  }

  const cleanDesc = currentPayload.description?.trim() || null
  if (snapshot.payload.description !== cleanDesc) {
    return false
  }

  // So sánh danh sách items
  if (snapshot.payload.items.length !== currentPayload.items.length) {
    return false
  }

  for (let i = 0; i < snapshot.payload.items.length; i++) {
    const a = snapshot.payload.items[i]
    const b = currentPayload.items[i]
    if (a.productId !== b.productId || a.quantity !== b.quantity) {
      return false
    }
  }

  // Kiểm tra đánh giá tương thích hiện tại không bị thay đổi ngầm
  const currentAssessment = evaluateCompatibility({
    isCompatible: previewResult?.isCompatible,
    issues: previewResult?.issues,
    hasPreviewError: Boolean(previewError || !previewResult),
  })

  if (snapshot.assessment.level !== currentAssessment.level) {
    return false
  }
  if (
    snapshot.assessment.classifiedIssues.totalCount !==
    currentAssessment.classifiedIssues.totalCount
  ) {
    return false
  }
  if (
    snapshot.assessment.classifiedIssues.errors.length !==
    currentAssessment.classifiedIssues.errors.length
  ) {
    return false
  }

  return true
}

/**
 * Khóa đồng bộ đơn lượt (synchronous in-flight lock) chống double-click và Enter kép trước khi React kịp rerender
 */
export function createSingleFlightLock() {
  let inFlight = false

  return {
    tryAcquire: (): boolean => {
      if (inFlight) return false
      inFlight = true
      return true
    },
    release: (): void => {
      inFlight = false
    },
    isInFlight: (): boolean => inFlight,
  }
}
