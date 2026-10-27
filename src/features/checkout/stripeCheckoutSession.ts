import {
  PENDING_STRIPE_STORAGE_KEY,
  PENDING_STRIPE_TTL_MS,
  STRIPE_CHECKOUT_HOSTNAME,
} from './checkoutConstants'
import type { PendingStripeCheckout } from './checkoutTypes'

/**
 * Kiểm tra tính hợp lệ của Stripe redirect URL.
 * Bắt buộc HTTPS và domain checkout.stripe.com.
 */
export function validateStripeRedirectUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === STRIPE_CHECKOUT_HOSTNAME
    )
  } catch {
    return false
  }
}

/**
 * Lưu pending Stripe checkout metadata vào sessionStorage.
 * TUYỆT ĐỐI không lưu token, PII, giỏ hàng hay ghi chú.
 */
export function savePendingStripeCheckout(
  data: Omit<PendingStripeCheckout, 'version' | 'createdAt'>
): void {
  try {
    const payload: PendingStripeCheckout = {
      version: 1,
      userId: data.userId,
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      idempotencyKey: data.idempotencyKey,
      addressId: data.addressId,
      expectedCartVersion: data.expectedCartVersion,
      createdAt: new Date().toISOString(),
    }
    sessionStorage.setItem(PENDING_STRIPE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage có thể bị chặn ở incognito mode hoặc quota exceeded
  }
}

/**
 * Lấy pending Stripe checkout metadata từ sessionStorage.
 * Kiểm tra:
 * 1. Thuộc về đúng currentUserId
 * 2. Version === 1
 * 3. Chưa quá 24h (TTL)
 */
export function getPendingStripeCheckout(
  currentUserId: string
): PendingStripeCheckout | null {
  try {
    const raw = sessionStorage.getItem(PENDING_STRIPE_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') {
      clearPendingStripeCheckout()
      return null
    }

    if (parsed.version !== 1) {
      clearPendingStripeCheckout()
      return null
    }

    if (
      typeof parsed.userId !== 'string' ||
      !parsed.userId.trim() ||
      parsed.userId !== currentUserId
    ) {
      clearPendingStripeCheckout()
      return null
    }

    if (typeof parsed.orderId !== 'string' || !parsed.orderId.trim()) {
      clearPendingStripeCheckout()
      return null
    }

    if (typeof parsed.orderNumber !== 'string' || !parsed.orderNumber.trim()) {
      clearPendingStripeCheckout()
      return null
    }

    if (
      typeof parsed.idempotencyKey !== 'string' ||
      parsed.idempotencyKey.trim().length < 16 ||
      parsed.idempotencyKey.trim().length > 128
    ) {
      clearPendingStripeCheckout()
      return null
    }

    if (typeof parsed.addressId !== 'string' || !parsed.addressId.trim()) {
      clearPendingStripeCheckout()
      return null
    }

    if (
      typeof parsed.expectedCartVersion !== 'number' ||
      !Number.isInteger(parsed.expectedCartVersion) ||
      parsed.expectedCartVersion < 1
    ) {
      clearPendingStripeCheckout()
      return null
    }

    if (typeof parsed.createdAt !== 'string') {
      clearPendingStripeCheckout()
      return null
    }

    const createdTime = new Date(parsed.createdAt).getTime()
    if (isNaN(createdTime)) {
      clearPendingStripeCheckout()
      return null
    }

    const age = Date.now() - createdTime
    if (age < 0 || age > PENDING_STRIPE_TTL_MS) {
      clearPendingStripeCheckout()
      return null
    }

    return {
      version: 1,
      userId: parsed.userId,
      orderId: parsed.orderId,
      orderNumber: parsed.orderNumber,
      idempotencyKey: parsed.idempotencyKey.trim(),
      addressId: parsed.addressId,
      expectedCartVersion: parsed.expectedCartVersion,
      createdAt: parsed.createdAt,
    }
  } catch {
    clearPendingStripeCheckout()
    return null
  }
}

/**
 * Xóa pending Stripe checkout metadata.
 */
export function clearPendingStripeCheckout(): void {
  try {
    sessionStorage.removeItem(PENDING_STRIPE_STORAGE_KEY)
  } catch {
    // Ignore error
  }
}
