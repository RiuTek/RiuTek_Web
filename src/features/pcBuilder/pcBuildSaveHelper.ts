import { ApiError } from '../../lib/api'
import {
  evaluateCompatibility,
  type CompatibilityAssessment,
} from './pcBuildCompatibilityHelper'
import type {
  CompatibilityIssue,
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

/**
 * Tạo chữ ký chuẩn hóa (canonical assessment signature) cho toàn bộ nội dung đánh giá hiển thị:
 * - isCompatible, isCompleteSystem, missingComponents (đã sort)
 * - estimatedWattage, recommendedPsuWattage, totalPrice
 * - issues đầy đủ: ruleId, severity, message, componentTypes (đã sort)
 * - Độc lập thứ tự response nhưng nhạy với mọi thay đổi nội dung
 */
export function computeAssessmentSignature(params: {
  previewResult: PCBuildPreviewResult | null
  previewError: string | null
}): string {
  if (params.previewError || !params.previewResult) {
    return `unverified:${params.previewError ?? 'null'}`
  }

  const p = params.previewResult
  const sortedIssues = (p.issues ?? [])
    .map((issue) => {
      const compA = issue.componentA ?? ''
      const compB = issue.componentB ?? ''
      const compTypes = Array.isArray((issue as unknown as { componentTypes?: string[] }).componentTypes)
        ? [...((issue as unknown as { componentTypes: string[] }).componentTypes)].sort().join(',')
        : ''
      const rule = issue.ruleId ?? ''
      const sev = (issue.severity ?? '').trim().toLowerCase()
      const msg = issue.message ?? ''
      return `${rule}|${sev}|${msg}|${compA}|${compB}|${compTypes}`
    })
    .sort()
    .join(';;')

  const sortedMissing = (p.missingComponents ?? []).slice().sort().join(',')

  return [
    `comp:${Boolean(p.isCompatible)}`,
    `sys:${Boolean(p.isCompleteSystem)}`,
    `missing:${sortedMissing}`,
    `estWatt:${p.estimatedWattage ?? 0}`,
    `recPsu:${p.recommendedPsuWattage ?? 0}`,
    `totalPrice:${p.totalPrice ?? 0}`,
    `issues:${sortedIssues}`,
  ].join('##')
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
  assessmentSignature: string
  isCompleteSystem: boolean
  missingComponents: string[]
  estimatedWattage: number
  recommendedPsuWattage: number
  previewResult: PCBuildPreviewResult | null
  previewError: string | null
  createdAt: number
}

/**
 * Deep-clone danh sách issues để tạo bản sao bất biến không bị mutate từ bên ngoài
 */
function cloneIssues(issues?: CompatibilityIssue[] | null): CompatibilityIssue[] {
  if (!Array.isArray(issues)) return []
  return issues.map((i) => {
    const raw = i as unknown as { componentTypes?: string[] }
    const cloned: CompatibilityIssue = {
      ruleId: i.ruleId,
      message: i.message,
      severity: i.severity,
      componentA: i.componentA ?? '',
      componentB: i.componentB ?? '',
    }
    if (Array.isArray(raw.componentTypes)) {
      (cloned as unknown as { componentTypes: string[] }).componentTypes = [...raw.componentTypes]
    }
    return cloned
  })
}

/**
 * Deep-clone previewResult để lưu snapshot bất biến
 */
function clonePreviewResult(
  preview: PCBuildPreviewResult | null
): PCBuildPreviewResult | null {
  if (!preview) return null
  return {
    isCompatible: preview.isCompatible,
    isCompleteSystem: preview.isCompleteSystem,
    canPurchaseAll: preview.canPurchaseAll ?? true,
    totalPrice: preview.totalPrice,
    estimatedWattage: preview.estimatedWattage,
    recommendedPsuWattage: preview.recommendedPsuWattage,
    missingComponents: Array.isArray(preview.missingComponents)
      ? [...preview.missingComponents]
      : [],
    items: Array.isArray(preview.items) ? [...preview.items] : [],
    issues: cloneIssues(preview.issues),
  }
}

/**
 * Tạo snapshot xác nhận lưu cấu hình gắn liền với context hiển thị hiện hành.
 * Lưu bản sao bất biến của nội dung đánh giá thực sự hiển thị (không giữ reference có thể bị mutate).
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
  const clonedPreview = clonePreviewResult(params.previewResult)
  const assessment = evaluateCompatibility({
    isCompatible: clonedPreview?.isCompatible,
    issues: clonedPreview?.issues,
    hasPreviewError: Boolean(params.previewError || !clonedPreview),
  })

  const assessmentSignature = computeAssessmentSignature({
    previewResult: clonedPreview,
    previewError: params.previewError,
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
    assessmentSignature,
    isCompleteSystem: clonedPreview?.isCompleteSystem ?? false,
    missingComponents: clonedPreview?.missingComponents ?? [],
    estimatedWattage: clonedPreview?.estimatedWattage ?? 0,
    recommendedPsuWattage: clonedPreview?.recommendedPsuWattage ?? 0,
    previewResult: clonedPreview,
    previewError: params.previewError,
    createdAt: Date.now(),
  }
}

/**
 * Kiểm tra snapshot xác nhận còn khớp hoàn toàn với context, selection và preview hiện hành hay không:
 * - Cùng ownerId, buildId (nếu là edit), cùng configKey (linh kiện & số lượng)
 * - Cùng tên và mô tả đã nhập
 * - Không đang trong trạng thái loading preview mới
 * - Chữ ký đánh giá tương thích (assessmentSignature) khớp hoàn toàn với preview hiện tại:
 *   nếu thay đổi bất kỳ ruleId, message, severity, component, missingComponents,
 *   wattage, giá tạm tính hoặc error state -> lập tức trả về false.
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
  if (snapshot.flow === 'edit') {
    if (!cleanBuildId || snapshot.buildId !== cleanBuildId) {
      return false
    }
  } else {
    // flow === 'create'
    if (cleanBuildId !== null || snapshot.buildId !== null) {
      return false
    }
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

  // So sánh danh sách items độc lập thứ tự phần tử
  const snapshotItemsKey = snapshot.payload.items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(';')
  const currentItemsKey = currentPayload.items
    .map((i) => `${i.productId}:${i.quantity}`)
    .sort()
    .join(';')

  if (snapshotItemsKey !== currentItemsKey) {
    return false
  }

  // So sánh chữ ký đánh giá toàn diện
  const currentSignature = computeAssessmentSignature({
    previewResult,
    previewError,
  })

  if (snapshot.assessmentSignature !== currentSignature) {
    return false
  }

  return true
}

export type SaveLockLease = symbol

export interface SingleFlightLock {
  tryAcquire: () => SaveLockLease | null
  release: (lease?: SaveLockLease | null) => boolean
  resetForContextChange: () => void
  isInFlight: () => boolean
}

/**
 * Khóa đồng bộ đơn lượt (synchronous in-flight lock) theo cơ chế lease token:
 * - tryAcquire() trả về một unique lease (Symbol) cho lần acquire thành công, hoặc null nếu đang bận
 * - release(lease) chỉ giải phóng nếu lease đúng với lease đang giữ khóa (idempotent, no-op nếu lease sai/cũ)
 * - resetForContextChange() vô hiệu hóa lease cũ và giải phóng để context mới có thể acquire ngay
 * - isInFlight() kiểm tra xem khóa có đang được giữ bởi một lease nào hay không
 */
export function createSingleFlightLock(): SingleFlightLock {
  let activeLease: SaveLockLease | null = null

  return {
    tryAcquire: (): SaveLockLease | null => {
      if (activeLease !== null) {
        return null
      }
      const lease = Symbol('save-lock-lease')
      activeLease = lease
      return lease
    },
    release: (lease?: SaveLockLease | null): boolean => {
      if (!lease || activeLease === null || activeLease !== lease) {
        return false
      }
      activeLease = null
      return true
    },
    resetForContextChange: () => {
      activeLease = null
    },
    isInFlight: (): boolean => activeLease !== null,
  }
}

export type SaveOperationLock = SingleFlightLock

export interface SaveOperationContext {
  isAlive: () => boolean
}

/**
 * Quản lý vòng đời và thế hệ (generation) của context lưu PC Build:
 * Đảm bảo unmount, đổi account, đổi build hoặc StrictMode unmount-remount
 * không gây rò rỉ request hoặc thực thi callback trên generation cũ.
 */
export class PCBuildSaveLifecycle {
  private generation = 0
  private isMounted = true
  private activeSession: string | null = null
  private activeBuildId: string | null = null

  constructor(session: string | null = null, buildId: string | null = null) {
    this.activeSession = session
    this.activeBuildId = buildId
  }

  mount() {
    this.isMounted = true
  }

  unmount() {
    this.isMounted = false
    this.generation++
  }

  updateContext(session: string | null, buildId: string | null = null) {
    if (this.activeSession !== session || this.activeBuildId !== buildId) {
      this.activeSession = session
      this.activeBuildId = buildId
      this.generation++
    }
  }

  createOperationContext(): SaveOperationContext {
    const gen = this.generation
    const expectedSession = this.activeSession
    const expectedBuildId = this.activeBuildId
    return {
      isAlive: () =>
        this.isMounted &&
        this.generation === gen &&
        this.activeSession === expectedSession &&
        this.activeBuildId === expectedBuildId,
    }
  }
}

export interface ExecutePCBuildSaveParams<TPayload, TResult> {
  payload: TPayload
  getAccessToken: (forceRefresh?: boolean) => Promise<string | null>
  mutationFn: (payload: TPayload, token: string) => Promise<TResult>
  context: SaveOperationContext
  lock: SaveOperationLock
  onStart?: () => void
  onSuccess?: (result: TResult) => void
  onError?: (err: unknown) => void
  onSettled?: () => void
}

/**
 * Helper production thực thi quy trình lưu bất đồng bộ dùng chung cho cả Create và Edit:
 * 1. Khóa synchronous single-flight lock lấy lease token
 * 2. Kiểm tra context.isAlive() trước và sau mỗi điểm await (token, 401 refresh, mutation)
 * 3. Nếu unmount trước khi gửi mutation -> mutation calls = 0
 * 4. Xử lý retry 401 với fresh token đúng tối đa 1 lần
 * 5. Bỏ qua response và không gọi callbacks nếu context đã unmount hoặc đổi session/build
 * 6. Chỉ giải phóng khóa bằng đúng lease của operation này trong finally
 */
export async function executePCBuildSaveOperation<TPayload, TResult>(
  params: ExecutePCBuildSaveParams<TPayload, TResult>
): Promise<boolean> {
  const {
    payload,
    getAccessToken,
    mutationFn,
    context,
    lock,
    onStart,
    onSuccess,
    onError,
    onSettled,
  } = params

  const lease = lock.tryAcquire()
  if (!lease) {
    return false
  }

  try {
    if (!context.isAlive()) {
      return false
    }

    try {
      onStart?.()
    } catch {
      return false
    }

    const token = await getAccessToken(false)
    if (!context.isAlive()) {
      return false
    }

    if (!token) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }

    let result: TResult
    try {
      result = await mutationFn(payload, token)
    } catch (err: unknown) {
      if (!context.isAlive()) {
        return false
      }
      if (err instanceof ApiError && err.status === 401) {
        const freshToken = await getAccessToken(true)
        if (!context.isAlive()) {
          return false
        }
        if (!freshToken) {
          throw err
        }
        result = await mutationFn(payload, freshToken)
      } else {
        throw err
      }
    }

    if (!context.isAlive()) {
      return false
    }

    onSuccess?.(result)
    return true
  } catch (err: unknown) {
    if (context.isAlive()) {
      onError?.(err)
    }
    return false
  } finally {
    lock.release(lease)
    if (context.isAlive()) {
      onSettled?.()
    }
  }
}
