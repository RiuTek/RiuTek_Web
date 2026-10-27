import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { useAddresses } from '../addresses/AddressContext'
import { useProductDetail } from '../products/useProductDetail'
import { buyNowProduct } from './buyNowApi'
import type { BuyNowProductRequest } from './buyNowTypes'
import type { PaymentMethod } from '../orders/orderTypes'
import {
  CHECKOUT_ERROR_MESSAGES,
  MAX_NOTES_LENGTH,
} from '../checkout/checkoutConstants'
import {
  savePendingStripeCheckout,
  validateStripeRedirectUrl,
} from '../checkout/stripeCheckoutSession'

export function useProductBuyNow() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const {
    addresses,
    status: addressStatus,
    error: addressError,
    loadAddresses,
  } = useAddresses()

  // 1. Tải product bằng logic product detail hiện có
  const {
    product,
    isLoading: isProductLoading,
    error: productError,
    isNotFound: isProductNotFound,
    retry: retryProduct,
  } = useProductDetail(slug)

  // 2. Parse và validate quantity từ query string (1..99)
  const rawQtyParam = searchParams.get('quantity')
  const parsedQty = rawQtyParam ? parseInt(rawQtyParam, 10) : 1
  const normalizedUrlQty =
    isNaN(parsedQty) || parsedQty < 1 ? 1 : Math.min(99, parsedQty)

  // Bounded theo stockQuantity của sản phẩm một khi product đã load
  const quantity = useMemo(() => {
    if (!product) return normalizedUrlQty
    const maxStock = Math.max(1, product.stockQuantity)
    return Math.min(normalizedUrlQty, maxStock)
  }, [product, normalizedUrlQty])

  // 3. Quản lý Address selection
  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)

  const selectedAddressId = useMemo(() => {
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [addresses, userSelectedAddressId])

  // 4. Quản lý Payment Method & Notes
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 5. Idempotency tracking
  const idempotencyKeyRef = useRef<string | null>(null)
  const lastFingerprintRef = useRef<string | null>(null)

  // Helper retry 401 token refresh
  const withAuthRetry = useCallback(
    async <T,>(operation: (token: string) => Promise<T>): Promise<T> => {
      let token = await getAccessToken(false)
      if (!token) {
        throw new Error('Chưa đăng nhập.')
      }

      try {
        return await operation(token)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          token = await getAccessToken(true)
          if (!token) {
            throw new Error('Chưa đăng nhập.', { cause: err })
          }
          return await operation(token)
        }
        throw err
      }
    },
    [getAccessToken]
  )

  // Product availability flags
  const isOutOfStock = Boolean(product && product.stockQuantity <= 0)
  const isInactive = Boolean(product && !product.isActive)
  const isProductUnavailable = isOutOfStock || isInactive

  const canSubmit =
    Boolean(product) &&
    !isProductUnavailable &&
    Boolean(selectedAddressId) &&
    quantity >= 1 &&
    notes.trim().length <= MAX_NOTES_LENGTH &&
    !isSubmitting

  const handleBuyNowSubmit = async () => {
    if (!canSubmit || !product || !selectedAddressId || !user?.id) return

    const cleanNotes = notes.trim()
    if (cleanNotes.length > MAX_NOTES_LENGTH) {
      setSubmitError(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`)
      return
    }

    // Quản lý Idempotency-Key
    const normalizedNotes = cleanNotes.length > 0 ? cleanNotes : ''
    const currentFingerprint = `${user.id}:${product.id}:${quantity}:${selectedAddressId}:${paymentMethod}:${normalizedNotes}`

    let idempotencyKey = idempotencyKeyRef.current
    if (!idempotencyKey || lastFingerprintRef.current !== currentFingerprint) {
      idempotencyKey = crypto.randomUUID()
      idempotencyKeyRef.current = idempotencyKey
      lastFingerprintRef.current = currentFingerprint
    }

    const request: BuyNowProductRequest = {
      addressId: selectedAddressId,
      quantity,
      paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const order = await withAuthRetry((token) =>
        buyNowProduct(product.id, request, idempotencyKey!, token)
      )

      if (paymentMethod === 'COD') {
        // Clear attempt
        idempotencyKeyRef.current = null
        lastFingerprintRef.current = null

        // Tuyệt đối không xóa hoặc reload Cart của user
        navigate(`/checkout/success?orderId=${encodeURIComponent(order.id)}`)
        return
      }

      if (paymentMethod === 'Stripe') {
        const action = order.paymentAction
        if (
          action?.type === 'Redirect' &&
          action.url &&
          validateStripeRedirectUrl(action.url)
        ) {
          // Lưu metadata source: 'product' trước khi chuyển hướng sang Stripe
          savePendingStripeCheckout({
            source: 'product',
            userId: user.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            idempotencyKey: idempotencyKey!,
            addressId: selectedAddressId,
            productId: product.id,
            quantity,
          })

          // Tuyệt đối không xóa hoặc reload Cart của user
          window.location.assign(action.url)
          return
        }

        setSubmitError(
          'Không thể khởi tạo cổng thanh toán Stripe an toàn. Vui lòng thử lại.'
        )
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
          setSubmitError(CHECKOUT_ERROR_MESSAGES[err.code])
        } else {
          setSubmitError(err.message || 'Không thể đặt mua sản phẩm lúc này.')
        }

        if (err.code === 'Checkout.AddressNotFound') {
          loadAddresses().catch(() => {})
        }

        // Với lỗi business xác định, xoay key
        if (
          err.code === 'Checkout.ProductInactive' ||
          err.code === 'Checkout.InsufficientStock' ||
          err.code === 'Checkout.InventoryChanged' ||
          err.code === 'Checkout.InvalidPrice'
        ) {
          idempotencyKeyRef.current = null
          lastFingerprintRef.current = null
        }
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    slug,
    quantity,
    product,
    isProductLoading,
    productError,
    isProductNotFound,
    retryProduct,
    isProductUnavailable,
    isOutOfStock,
    isInactive,
    addresses,
    addressStatus,
    addressError,
    loadAddresses,
    selectedAddressId,
    setSelectedAddressId: setUserSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    notes,
    setNotes,
    isSubmitting,
    submitError,
    canSubmit,
    handleBuyNowSubmit,
  }
}
