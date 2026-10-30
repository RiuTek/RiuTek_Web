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
}

export interface DraftValidationResult {
  payload: PCBuilderDraftPayload | null
  isExpired: boolean
  isCorrupt: boolean
}

/**
 * Kiểm tra tính hợp lệ của chuỗi JSON draft theo schema, owner và TTL
 */
export function validateDraftPayload(
  raw: string | null,
  expectedOwner: string
): DraftValidationResult {
  if (!raw) {
    return { payload: null, isExpired: false, isCorrupt: false }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { payload: null, isExpired: false, isCorrupt: true }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { payload: null, isExpired: false, isCorrupt: true }
  }

  const data = parsed as Record<string, unknown>

  if (
    typeof data.schemaVersion !== 'number' ||
    data.schemaVersion !== DRAFT_SCHEMA_VERSION ||
    typeof data.owner !== 'string' ||
    data.owner !== expectedOwner ||
    typeof data.updatedAt !== 'number' ||
    !Number.isFinite(data.updatedAt) ||
    !Array.isArray(data.items)
  ) {
    return { payload: null, isExpired: false, isCorrupt: true }
  }

  const now = Date.now()
  // Không chấp nhận timestamp ở tương lai (cho phép lệch tối đa 5s do chênh lệch clock)
  if (data.updatedAt > now + 5000) {
    return { payload: null, isExpired: false, isCorrupt: true }
  }

  // Kiểm tra thời hạn TTL 1 giờ
  if (now - data.updatedAt > DRAFT_TTL_MS) {
    return { payload: null, isExpired: true, isCorrupt: false }
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
    return { payload: null, isExpired: false, isCorrupt: true }
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
  }
}

/**
 * Di chuyển dữ liệu từ key legacy cũ (nếu có) sang định dạng draft chuẩn và dọn dẹp key cũ
 */
export function migrateLegacyGuestStorage(): PCBuilderDraftPayload | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null
  try {
    const raw = sessionStorage.getItem(LEGACY_GUEST_STORAGE_KEY)
    if (!raw) return null

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      sessionStorage.removeItem(LEGACY_GUEST_STORAGE_KEY)
      return null
    }

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as Record<string, unknown>).savedAt !== 'number' ||
      !Array.isArray((parsed as Record<string, unknown>).items)
    ) {
      sessionStorage.removeItem(LEGACY_GUEST_STORAGE_KEY)
      return null
    }

    const legacySavedAt = (parsed as Record<string, unknown>).savedAt as number
    const now = Date.now()

    if (
      !Number.isFinite(legacySavedAt) ||
      legacySavedAt > now + 5000 ||
      now - legacySavedAt > DRAFT_TTL_MS
    ) {
      sessionStorage.removeItem(LEGACY_GUEST_STORAGE_KEY)
      return null
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
      sessionStorage.removeItem(LEGACY_GUEST_STORAGE_KEY)
      return null
    }

    const migrated: PCBuilderDraftPayload = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      owner: 'guest',
      updatedAt: legacySavedAt,
      items: validItems,
    }

    sessionStorage.setItem(DRAFT_GUEST_KEY, JSON.stringify(migrated))
    sessionStorage.setItem(
      DRAFT_INTENT_KEY,
      JSON.stringify({ schemaVersion: DRAFT_SCHEMA_VERSION, createdAt: legacySavedAt })
    )
    sessionStorage.removeItem(LEGACY_GUEST_STORAGE_KEY)

    return migrated
  } catch {
    return null
  }
}

/**
 * Đọc và xác thực bản nháp của một chủ sở hữu (guest hoặc userId cụ thể)
 */
export function loadDraft(owner: 'guest' | string): {
  draft: PCBuilderDraftPayload | null
  notice?: string
} {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { draft: null }
  }

  if (owner === 'guest') {
    migrateLegacyGuestStorage()
  }

  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY

  try {
    const raw = sessionStorage.getItem(storageKey)
    if (!raw) return { draft: null }

    const { payload, isExpired, isCorrupt } = validateDraftPayload(raw, owner)

    if (isExpired) {
      sessionStorage.removeItem(storageKey)
      return {
        draft: null,
        notice: 'Bản nháp cấu hình đã quá hạn (1 giờ) và đã được xóa.',
      }
    }

    if (isCorrupt) {
      sessionStorage.removeItem(storageKey)
      return {
        draft: null,
        notice: 'Dữ liệu bản nháp bị hỏng và đã được làm mới.',
      }
    }

    return { draft: payload }
  } catch {
    return { draft: null }
  }
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
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return false
  }

  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY

  if (!items || items.length === 0) {
    try {
      sessionStorage.removeItem(storageKey)
      return true
    } catch {
      return false
    }
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

  try {
    sessionStorage.setItem(storageKey, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

/**
 * Xóa bản nháp khỏi sessionStorage
 */
export function removeDraft(owner: 'guest' | string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return
  const storageKey = owner === 'guest' ? DRAFT_GUEST_KEY : DRAFT_USER_KEY
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    // Bỏ qua lỗi storage
  }
}

/**
 * Ghi nhận intent khi khách chủ động bấm Lưu cấu hình trước khi login
 */
export function recordSaveIntent(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false
  try {
    const intent: SaveIntentPayload = {
      schemaVersion: DRAFT_SCHEMA_VERSION,
      createdAt: Date.now(),
    }
    sessionStorage.setItem(DRAFT_INTENT_KEY, JSON.stringify(intent))
    return true
  } catch {
    return false
  }
}

/**
 * Kiểm tra và tiêu thụ intent chuyển giao cấu hình từ guest sang tài khoản (chỉ dùng 1 lần)
 */
export function consumeSaveIntent(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false
  try {
    const raw = sessionStorage.getItem(DRAFT_INTENT_KEY)
    if (!raw) return false

    sessionStorage.removeItem(DRAFT_INTENT_KEY)

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return false
    }

    if (!parsed || typeof parsed !== 'object') return false
    const data = parsed as Record<string, unknown>

    if (
      data.schemaVersion === DRAFT_SCHEMA_VERSION &&
      typeof data.createdAt === 'number' &&
      Number.isFinite(data.createdAt) &&
      data.createdAt <= Date.now() + 5000 &&
      Date.now() - data.createdAt <= DRAFT_TTL_MS
    ) {
      return true
    }
    return false
  } catch {
    try {
      sessionStorage.removeItem(DRAFT_INTENT_KEY)
    } catch {
      // Bỏ qua lỗi storage
    }
    return false
  }
}
