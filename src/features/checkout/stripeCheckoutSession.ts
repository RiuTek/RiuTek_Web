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

    const parsed = JSON.parse(raw) as Partial<PendingStripeCheckout>

    if (parsed.version !== 1 || !parsed.userId || !parsed.orderId) {
      clearPendingStripeCheckout()
      return null
    }

    if (parsed.userId !== currentUserId) {
      // Thuộc về tài khoản khác -> không sử dụng
      clearPendingStripeCheckout()
      return null
    }

    if (parsed.createdAt) {
      const createdTime = new Date(parsed.createdAt).getTime()
      if (
        isNaN(createdTime) ||
        Date.now() - createdTime > PENDING_STRIPE_TTL_MS
      ) {
        clearPendingStripeCheckout()
        return null
      }
    }

    return parsed as PendingStripeCheckout
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
