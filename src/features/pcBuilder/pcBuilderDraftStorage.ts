import {
  MAX_BUILD_ITEMS,
  MAX_MULTI_CHOICE_QUANTITY,
  MIN_QUANTITY,
} from './pcBuilderConstants'

/**
 * Phiên bản schema của draft payload lưu trong sessionStorage
 */
export const DRAFT_SCHEMA_VERSION = 1

/**
 * Thời gian sống của bản nháp: 1 giờ kể từ lần sửa đổi selection cuối cùng
 */
export const DRAFT_TTL_MS = 60 * 60 * 1000

/**
 * Khóa lưu trữ bản nháp của khách vãng lai
 */
export const DRAFT_GUEST_KEY = 'riutek_pc_builder_draft_guest_v1'

/**
 * Khóa lưu trữ bản nháp của tài khoản đã đăng nhập (cố định, chứa ownerUserId trong payload)
 */
export const DRAFT_USER_KEY = 'riutek_pc_builder_draft_user_v1'

/**
 * Khóa đánh dấu intent khi khách chủ động bấm Lưu cấu hình rồi điều hướng đến đăng nhập
 */
export const DRAFT_INTENT_KEY = 'riutek_pc_builder_draft_intent_v1'

/**
 * Khóa legacy từ bản trước cần migrate an toàn
 */
export const LEGACY_GUEST_STORAGE_KEY = 'riutek_pc_builder_guest_items_v1'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface PCBuilderDraftItem {
  productId: string
  quantity: number
}

export interface PCBuilderDraftPayload {
  schemaVersion: number
  owner: string
  updatedAt: number
  items: PCBuilderDraftItem[]
}

export interface SaveIntentPayload {
  schemaVersion: number
  createdAt: number
  draftUpdatedAt: number
}

export interface DraftValidationResult {
  payload: PCBuilderDraftPayload | null
  isExpired: boolean
  isCorrupt: boolean
  isOwnerMismatch: boolean
}

export type StorageReadResult =
  | { status: 'ok'; value: string }
  | { status: 'missing' }
  | { status: 'error'; error: unknown }

/**
 * Truy cập an toàn đối tượng window.sessionStorage
 */
export function getSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

/**
 * Đọc an toàn giá trị từ sessionStorage, phân biệt rõ missing với read error
 */
export function safeStorageGet(key: string): StorageReadResult {
  const storage = getSessionStorage()
  if (!storage) {
    return { status: 'error', error: new Error('Storage is not available') }
  }
  try {
    const value = storage.getItem(key)
    if (value === null) {
      return { status: 'missing' }
    }
    return { status: 'ok', value }
  } catch (err) {
    return { status: 'error', error: err }
  }
}

/**
 * Đọc tương thích chuỗi giá trị (trả về null nếu missing hoặc error)
 */
export function storageGet(key: string): string | null {
  const res = safeStorageGet(key)
  return res.status === 'ok' ? res.value : null
}

/**
 * Ghi an toàn giá trị vào sessionStorage
 */
export function storageSet(key: string, value: string): boolean {
  const storage = getSessionStorage()
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Xóa an toàn khóa khỏi sessionStorage
 */
export function storageRemove(key: string): boolean {
  const storage = getSessionStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/**
 * Kiểm tra xem sessionStorage có khả dụng hay không
 */
export function isStorageAvailable(): boolean {
  return getSessionStorage() !== null
}

/**
 * Kiểm tra tính hợp lệ của chuỗi JSON draft theo schema, owner và TTL
 */
export function validateDraftPayload(
  raw: string | null,
  expectedOwner: string
): DraftValidationResult {
  if (!raw) {
    return { payload: null, isExpired: false, isCorrupt: false, isOwnerMismatch: false }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { payload: null, isExpired: false, isCorrupt: true, isOwnerMismatch: false }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { payload: null, isExpired: false, isCorrupt: true, isOwnerMismatch: false }
  }

  const data = parsed as Record<string, unknown>

  if (
    typeof data.schemaVersion !== 'number' ||
    data.schemaVersion !== DRAFT_SCHEMA_VERSION ||
    typeof data.owner !== 'string' ||
    typeof data.updatedAt !== 'number' ||
    !Number.isFinite(data.updatedAt) ||
    data.updatedAt <= 0 ||
    !Array.isArray(data.items)
  ) {
    return { payload: null, isExpired: false, isCorrupt: true, isOwnerMismatch: false }
  }

  const now = Date.now()
  // Timestamp phải finite và không ở tương lai (clock browser thống nhất, không allowance tương lai)
  if (data.updatedAt > now) {
    return { payload: null, isExpired: false, isCorrupt: true, isOwnerMismatch: false }
  }

  // Kiểm tra thời hạn TTL 1 giờ
  if (now - data.updatedAt > DRAFT_TTL_MS) {
    return { payload: null, isExpired: true, isCorrupt: false, isOwnerMismatch: false }
  }

  // Validate từng item: UUID hợp lệ, quantity integer 1..20, tối đa 30 items, deduplicate IDs
  const validItems: PCBuilderDraftItem[] = []
  const seenIds = new Set<string>()

  for (const item of data.items.slice(0, MAX_BUILD_ITEMS)) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).productId === 'string' &&
      UUID_REGEX.test(((item as Record<string, unknown>).productId as string).trim()) &&
      typeof (item as Record<string, unknown>).quantity === 'number' &&
      Number.isInteger((item as Record<string, unknown>).quantity) &&
      ((item as Record<string, unknown>).quantity as number) >= MIN_QUANTITY &&
      ((item as Record<string, unknown>).quantity as number) <= MAX_MULTI_CHOICE_QUANTITY
    ) {
      const cleanId = ((item as Record<string, unknown>).productId as string)
        .trim()
        .toLowerCase()
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId)
        validItems.push({
          productId: cleanId,
          quantity: (item as Record<string, unknown>).quantity as number,
        })
      }
    }
  }

  if (validItems.length === 0) {
    return { payload: null, isExpired: false, isCorrupt: true, isOwnerMismatch: false }
  }

  // Phân biệt: Payload hợp lệ nhưng thuộc user khác (owner mismatch) KHÔNG phải dữ liệu hỏng
  if (data.owner !== expectedOwner) {
    return { payload: null, isExpired: false, isCorrupt: false, isOwnerMismatch: true }
  }

  return {
    payload: {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      owner: data.owner,
      updatedAt: data.updatedAt,
      items: validItems,
    },
    isExpired: false,
    isCorrupt: false,
    isOwnerMismatch: false,
  }
}

/**
 * Di chuyển dữ liệu từ key legacy cũ (nếu có) sang định dạng draft chuẩn.
 * Chỉ xóa key legacy sau khi cả draft mới và intent được ghi thành công 100%.
 * Nếu đã có draft guest mới hơn thì không ghi đè và dọn dẹp an toàn.
 */
export function migrateLegacyGuestStorage(): { migrated: boolean; error?: boolean } {
  const legacyRead = safeStorageGet(LEGACY_GUEST_STORAGE_KEY)
  if (legacyRead.status === 'missing') {
    return { migrated: false }
  }
  if (legacyRead.status === 'error') {
    return { migrated: false, error: true }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(legacyRead.value)
  } catch {
    storageRemove(LEGACY_GUEST_STORAGE_KEY)
    return { migrated: false }
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).savedAt !== 'number' ||
    !Array.isArray((parsed as Record<string, unknown>).items)
  ) {
    storageRemove(LEGACY_GUEST_STORAGE_KEY)
    return { migrated: false }
  }

  const legacySavedAt = (parsed as Record<string, unknown>).savedAt as number
  const now = Date.now()

  if (
    !Number.isFinite(legacySavedAt) ||
    legacySavedAt <= 0 ||
    legacySavedAt > now ||
    now - legacySavedAt > DRAFT_TTL_MS
  ) {
    storageRemove(LEGACY_GUEST_STORAGE_KEY)
    return { migrated: false }
  }

  // Kiểm tra nếu DRAFT_GUEST_KEY hiện có draft mới hơn
  const existingGuestRead = safeStorageGet(DRAFT_GUEST_KEY)
  if (existingGuestRead.status === 'ok') {
    try {
      const existing = JSON.parse(existingGuestRead.value) as { updatedAt?: number }
      if (
        existing &&
        typeof existing.updatedAt === 'number' &&
        existing.updatedAt >= legacySavedAt
      ) {
        // Guest draft hiện tại mới hơn legacy: không ghi đè, dọn legacy an toàn
        storageRemove(LEGACY_GUEST_STORAGE_KEY)
        return { migrated: false }
      }
    } catch {
      // Nếu existing corrupt thì cho phép ghi đè
    }
  }

  const legacyItems = (parsed as Record<string, unknown>).items as Array<Record<string, unknown>>
  const validItems: PCBuilderDraftItem[] = []
  const seenIds = new Set<string>()

  for (const item of legacyItems.slice(0, MAX_BUILD_ITEMS)) {
    if (
      item &&
      typeof item.productId === 'string' &&
      UUID_REGEX.test(item.productId.trim()) &&
      typeof item.quantity === 'number' &&
      Number.isInteger(item.quantity) &&
      item.quantity >= MIN_QUANTITY &&
      item.quantity <= MAX_MULTI_CHOICE_QUANTITY
    ) {
      const cleanId = item.productId.trim().toLowerCase()
      if (!seenIds.has(cleanId)) {
        seenIds.add(cleanId)
        validItems.push({
          productId: cleanId,
          quantity: item.quantity,
        })
      }
    }
  }

  if (validItems.length === 0) {
    storageRemove(LEGACY_GUEST_STORAGE_KEY)
    return { migrated: false }
  }

  const migratedPayload: PCBuilderDraftPayload = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    owner: 'guest',
    updatedAt: legacySavedAt,
    items: validItems,
  }

  // Ghi cả draft và intent: chỉ xóa nguồn khi cả hai ghi thành công
  const draftWritten = storageSet(DRAFT_GUEST_KEY, JSON.stringify(migratedPayload))
  const intentWritten = recordSaveIntent(legacySavedAt)

  if (draftWritten && intentWritten) {
    storageRemove(LEGACY_GUEST_STORAGE_KEY)
    return { migrated: true }
  }

  // Nếu thất bại: giữ nguyên legacy để thử lại sau
  return { migrated: false, error: true }
}

/**
 * Đọc và xác thực bản nháp của một chủ sở hữu (guest hoặc userId cụ thể)
 */
export function loadDraft(owner: 'guest' | string): {
  draft: PCBuilderDraftPayload | null
  notice?: string
  storageUnavailable?: boolean
} {
  if (owner === 'guest') {
    migrateLegacyGuestStorage()
  }

  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY
  const readResult = safeStorageGet(storageKey)

  if (readResult.status === 'error') {
    return { draft: null, storageUnavailable: true }
  }

  if (readResult.status === 'missing') {
    return { draft: null }
  }

  const { payload, isExpired, isCorrupt, isOwnerMismatch } = validateDraftPayload(
    readResult.value,
    owner
  )

  // Nếu là owner mismatch: không xóa dữ liệu của tài khoản khác, không báo dữ liệu hỏng
  if (isOwnerMismatch) {
    return { draft: null }
  }

  if (isExpired) {
    storageRemove(storageKey)
    return {
      draft: null,
      notice: 'Bản nháp cấu hình đã quá hạn (1 giờ) và đã được xóa.',
    }
  }

  if (isCorrupt) {
    storageRemove(storageKey)
    return {
      draft: null,
      notice: 'Dữ liệu bản nháp bị hỏng và đã được làm mới.',
    }
  }

  return { draft: payload }
}

/**
 * Lưu hoặc cập nhật bản nháp vào sessionStorage.
 * Trả về true nếu thành công, false nếu storage bị chặn/lỗi quota.
 */
export function saveDraft(
  owner: 'guest' | string,
  items: Array<{ product: { id: string }; quantity: number }>,
  customUpdatedAt?: number
): boolean {
  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY

  if (!items || items.length === 0) {
    return removeDraft(owner)
  }

  const draftItems: PCBuilderDraftItem[] = items.slice(0, MAX_BUILD_ITEMS).map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }))

  const payload: PCBuilderDraftPayload = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    owner,
    updatedAt: customUpdatedAt ?? Date.now(),
    items: draftItems,
  }

  return storageSet(storageKey, JSON.stringify(payload))
}

/**
 * Xóa bản nháp khỏi sessionStorage.
 * Chỉ xóa nếu bản nháp trong key thực sự thuộc về owner này (tránh B xóa nháp của A).
 */
export function removeDraft(owner: 'guest' | string): boolean {
  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY
  const readResult = safeStorageGet(storageKey)

  if (readResult.status === 'error') {
    return false
  }

  if (readResult.status === 'missing') {
    return true
  }

  try {
    const parsed = JSON.parse(readResult.value) as { owner?: unknown }
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.owner === 'string' &&
      parsed.owner !== owner
    ) {
      // Bản nháp thuộc tài khoản khác: tuyệt đối không xóa!
      return true
    }
  } catch {
    // Nếu JSON hỏng thì cho phép dọn
  }

  return storageRemove(storageKey)
}

/**
 * Ghi nhận intent khi khách chủ động bấm Lưu cấu hình trước khi login.
 * Gắn draftUpdatedAt của bản nháp hiện tại để hạn intent không kéo dài tuổi draft.
 */
export function recordSaveIntent(draftUpdatedAt: number): boolean {
  const now = Date.now()
  const intent: SaveIntentPayload = {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    createdAt: now,
    draftUpdatedAt,
  }

  return storageSet(DRAFT_INTENT_KEY, JSON.stringify(intent))
}

/**
 * Kiểm tra xem save intent có tồn tại và còn hạn hay không (KHÔNG xóa intent).
 * Dùng để xem trước intent khi restore và cho phép retry khi gặp lỗi mạng.
 */
export function peekSaveIntent(): {
  valid: boolean
  draftUpdatedAt?: number
  isExpired?: boolean
  storageError?: boolean
} {
  const readResult = safeStorageGet(DRAFT_INTENT_KEY)
  if (readResult.status === 'error') {
    return { valid: false, storageError: true }
  }
  if (readResult.status === 'missing') {
    return { valid: false }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readResult.value)
  } catch {
    storageRemove(DRAFT_INTENT_KEY)
    return { valid: false }
  }

  if (!parsed || typeof parsed !== 'object') {
    storageRemove(DRAFT_INTENT_KEY)
    return { valid: false }
  }

  const data = parsed as Record<string, unknown>
  const now = Date.now()

  if (
    data.schemaVersion !== DRAFT_SCHEMA_VERSION ||
    typeof data.createdAt !== 'number' ||
    !Number.isFinite(data.createdAt) ||
    data.createdAt <= 0 ||
    data.createdAt > now ||
    typeof data.draftUpdatedAt !== 'number' ||
    !Number.isFinite(data.draftUpdatedAt) ||
    data.draftUpdatedAt <= 0 ||
    data.draftUpdatedAt > now
  ) {
    storageRemove(DRAFT_INTENT_KEY)
    return { valid: false }
  }

  // Hạn intent không được dài hơn tuổi draft (1 giờ từ draftUpdatedAt)
  if (
    now - data.createdAt > DRAFT_TTL_MS ||
    now - data.draftUpdatedAt > DRAFT_TTL_MS
  ) {
    storageRemove(DRAFT_INTENT_KEY)
    return { valid: false, isExpired: true }
  }

  return { valid: true, draftUpdatedAt: data.draftUpdatedAt }
}

/**
 * Tiêu thụ (xóa) intent sau khi quá trình chuyển giao hoặc khôi phục đã hoàn thành thành công.
 */
export function clearSaveIntent(): boolean {
  return storageRemove(DRAFT_INTENT_KEY)
}
