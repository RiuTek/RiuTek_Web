import {
  PENDING_STRIPE_STORAGE_KEY,
  PENDING_STRIPE_TTL_MS,
  STRIPE_CHECKOUT_HOSTNAME,
} from './checkoutConstants'
import type { PendingStripeCheckout } from './checkoutTypes'

export type SavePendingStripeData =
  | {
      source: 'cart'
      userId: string
      orderId: string
      orderNumber: string
      idempotencyKey: string
      addressId: string
      expectedCartVersion: number
    }
  | {
      source: 'product'
      userId: string
      orderId: string
      orderNumber: string
      idempotencyKey: string
      addressId: string
      productId: string
      quantity: number
    }
  | {
      source: 'pc-build'
      userId: string
      orderId: string
      orderNumber: string
      idempotencyKey: string
      addressId: string
      buildId: string
    }

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
 * Lưu pending Stripe checkout metadata vào sessionStorage theo schema version 2.
 * TUYỆT ĐỐI không lưu token, PII, giỏ hàng hay ghi chú.
 * Trả về true nếu ghi thành công, false nếu sessionStorage bị chặn hoặc throw.
 */
export function savePendingStripeCheckout(data: SavePendingStripeData): boolean {
  try {
    let payload: PendingStripeCheckout
    if (data.source === 'cart') {
      payload = {
        version: 2,
        source: 'cart',
        userId: data.userId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        idempotencyKey: data.idempotencyKey,
        addressId: data.addressId,
        expectedCartVersion: data.expectedCartVersion,
        createdAt: new Date().toISOString(),
      }
    } else if (data.source === 'product') {
      payload = {
        version: 2,
        source: 'product',
        userId: data.userId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        idempotencyKey: data.idempotencyKey,
        addressId: data.addressId,
        productId: data.productId,
        quantity: data.quantity,
        createdAt: new Date().toISOString(),
      }
    } else {
      payload = {
        version: 2,
        source: 'pc-build',
        userId: data.userId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        idempotencyKey: data.idempotencyKey,
        addressId: data.addressId,
        buildId: data.buildId,
        createdAt: new Date().toISOString(),
      }
    }
    sessionStorage.setItem(PENDING_STRIPE_STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    // sessionStorage có thể bị chặn ở incognito mode hoặc quota exceeded
    return false
  }
}

/**
 * Lấy pending Stripe checkout metadata từ sessionStorage.
 * Hỗ trợ:
 * 1. Schema version 2 (discriminated union: cart | product)
 * 2. Schema version 1 (backward compatibility: chuẩn hóa in-memory thành source 'cart')
 * Kiểm tra:
 * - Thuộc về đúng currentUserId
 * - Idempotency-Key từ 16 đến 128 ký tự
 * - Chưa quá 24h (TTL)
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

    // Common validations
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

    // Version 1 (legacy cart backward compatibility)
    if (parsed.version === 1) {
      if (
        typeof parsed.expectedCartVersion !== 'number' ||
        !Number.isInteger(parsed.expectedCartVersion) ||
        parsed.expectedCartVersion < 1
      ) {
        clearPendingStripeCheckout()
        return null
      }

      return {
        version: 2,
        source: 'cart',
        userId: parsed.userId,
        orderId: parsed.orderId,
        orderNumber: parsed.orderNumber,
        idempotencyKey: parsed.idempotencyKey.trim(),
        addressId: parsed.addressId,
        expectedCartVersion: parsed.expectedCartVersion,
        createdAt: parsed.createdAt,
      }
    }

    // Version 2 (discriminated union)
    if (parsed.version === 2) {
      if (parsed.source === 'cart') {
        if (
          typeof parsed.expectedCartVersion !== 'number' ||
          !Number.isInteger(parsed.expectedCartVersion) ||
          parsed.expectedCartVersion < 1
        ) {
          clearPendingStripeCheckout()
          return null
        }

        return {
          version: 2,
          source: 'cart',
          userId: parsed.userId,
          orderId: parsed.orderId,
          orderNumber: parsed.orderNumber,
          idempotencyKey: parsed.idempotencyKey.trim(),
          addressId: parsed.addressId,
          expectedCartVersion: parsed.expectedCartVersion,
          createdAt: parsed.createdAt,
        }
      }

      if (parsed.source === 'product') {
        if (typeof parsed.productId !== 'string' || !parsed.productId.trim()) {
          clearPendingStripeCheckout()
          return null
        }

        if (
          typeof parsed.quantity !== 'number' ||
          !Number.isInteger(parsed.quantity) ||
          parsed.quantity < 1 ||
          parsed.quantity > 99
        ) {
          clearPendingStripeCheckout()
          return null
        }

        return {
          version: 2,
          source: 'product',
          userId: parsed.userId,
          orderId: parsed.orderId,
          orderNumber: parsed.orderNumber,
          idempotencyKey: parsed.idempotencyKey.trim(),
          addressId: parsed.addressId,
          productId: parsed.productId.trim(),
          quantity: parsed.quantity,
          createdAt: parsed.createdAt,
        }
      }

      if (parsed.source === 'pc-build') {
        if (typeof parsed.buildId !== 'string' || !parsed.buildId.trim()) {
          clearPendingStripeCheckout()
          return null
        }

        return {
          version: 2,
          source: 'pc-build',
          userId: parsed.userId,
          orderId: parsed.orderId,
          orderNumber: parsed.orderNumber,
          idempotencyKey: parsed.idempotencyKey.trim(),
          addressId: parsed.addressId,
          buildId: parsed.buildId.trim(),
          createdAt: parsed.createdAt,
        }
      }

      clearPendingStripeCheckout()
      return null
    }

    clearPendingStripeCheckout()
    return null
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

/**
 * Xóa pending Stripe checkout metadata chỉ khi session khớp đúng currentUserId và orderId.
 * Trả về true nếu đã xóa thành công, false nếu không khớp hoặc không có dữ liệu.
 */
export function clearPendingStripeCheckoutForOrder(
  currentUserId: string,
  orderId: string
): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_STRIPE_STORAGE_KEY)
    if (!raw) return false

    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return false

    if (parsed.userId !== currentUserId || parsed.orderId !== orderId) {
      return false
    }

    clearPendingStripeCheckout()
    return true
  } catch {
    return false
  }
}
