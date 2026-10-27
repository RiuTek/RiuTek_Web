import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { useAuth } from '../auth/AuthContext'
import { useAddresses } from '../addresses/AddressContext'
import { useCart } from '../cart/CartContext'
import { checkoutCart, getCheckoutQuote } from './checkoutApi'
import {
  CHECKOUT_ERROR_MESSAGES,
  MAX_NOTES_LENGTH,
} from './checkoutConstants'
import {
  savePendingStripeCheckout,
  validateStripeRedirectUrl,
} from './stripeCheckoutSession'
import type {
  CheckoutCartRequest,
  CheckoutOrderDto,
  CheckoutQuoteDto,
  PaymentMethod,
} from './checkoutTypes'

export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error'

function mapCheckoutError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
      return CHECKOUT_ERROR_MESSAGES[err.code]
    }
    if (err.description) return err.description
    if (err.message) return err.message
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Đã xảy ra lỗi trong quá trình xử lý đơn hàng. Vui lòng thử lại.'
}

export function useCartCheckout() {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const {
    addresses,
    status: addressStatus,
    error: addressError,
    loadAddresses,
  } = useAddresses()
  const { cart, loadCart } = useCart()

  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [notes, setNotes] = useState('')

  // Tự động phân giải địa chỉ đang chọn từ user preference hoặc fallback default/first
  const selectedAddressId = useMemo(() => {
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [addresses, userSelectedAddressId])

  const [quote, setQuote] = useState<CheckoutQuoteDto | null>(null)
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>(() =>
    selectedAddressId ? 'loading' : 'idle'
  )
  const [quoteError, setQuoteError] = useState<string | null>(null)

  // Điều chỉnh quote state ngay trong render khi selectedAddressId thay đổi (không dùng useEffect)
  const [prevAddressId, setPrevAddressId] = useState(selectedAddressId)
  if (selectedAddressId !== prevAddressId) {
    setPrevAddressId(selectedAddressId)
    setQuote(null)
    setQuoteStatus(selectedAddressId ? 'loading' : 'idle')
    setQuoteError(null)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Tracking sequence để huỷ response quote cũ nếu user đổi địa chỉ nhanh
  const quoteRequestIdRef = useRef(0)

  // Idempotency tracking
  const idempotencyKeyRef = useRef<string | null>(null)
  const lastFingerprintRef = useRef<string | null>(null)

  /**
   * Helper private gọi API với token và retry 1 lần khi 401
   */
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

  /**
   * Tải báo giá quote khi selectedAddressId thay đổi
   */
  useEffect(() => {
    if (!selectedAddressId) return

    let cancelled = false
    const currentRequestId = ++quoteRequestIdRef.current

    withAuthRetry((token) => getCheckoutQuote(selectedAddressId, token))
      .then((result) => {
        if (!cancelled && currentRequestId === quoteRequestIdRef.current) {
          setQuote(result)
          setQuoteStatus('ready')
          setQuoteError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && currentRequestId === quoteRequestIdRef.current) {
          const msg = mapCheckoutError(err)
          setQuoteError(msg)
          setQuoteStatus('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [selectedAddressId, withAuthRetry])

  const refetchQuote = useCallback(async () => {
    if (!selectedAddressId) return
    const currentRequestId = ++quoteRequestIdRef.current
    setQuoteStatus('loading')
    setQuoteError(null)

    try {
      const result = await withAuthRetry((token) =>
        getCheckoutQuote(selectedAddressId, token)
      )
      if (currentRequestId === quoteRequestIdRef.current) {
        setQuote(result)
        setQuoteStatus('ready')
        setQuoteError(null)
      }
    } catch (err: unknown) {
      if (currentRequestId === quoteRequestIdRef.current) {
        const msg = mapCheckoutError(err)
        setQuoteError(msg)
        setQuoteStatus('error')
      }
    }
  }, [selectedAddressId, withAuthRetry])

  /**
   * Xử lý gửi đơn đặt hàng
   */
  const handleCheckout = async (): Promise<CheckoutOrderDto | void> => {
    if (isSubmitting) return

    if (!selectedAddressId) {
      setSubmitError('Vui lòng chọn hoặc thêm địa chỉ nhận hàng.')
      return
    }

    if (!quote || quoteStatus !== 'ready') {
      setSubmitError('Chưa có thông tin báo giá hợp lệ. Vui lòng thử lại.')
      return
    }

    if (!quote.canCheckout || quote.items.length === 0) {
      setSubmitError('Giỏ hàng chưa đủ điều kiện để thanh toán. Vui lòng kiểm tra lại.')
      return
    }

    const cleanNotes = notes.trim()
    if (cleanNotes.length > MAX_NOTES_LENGTH) {
      setSubmitError(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`)
      return
    }

    // Quản lý Idempotency-Key
    const normalizedNotes = cleanNotes.length > 0 ? cleanNotes : ''
    const currentFingerprint = `${selectedAddressId}:${quote.cartVersion}:${paymentMethod}:${normalizedNotes}`

    let idempotencyKey = idempotencyKeyRef.current
    if (!idempotencyKey || lastFingerprintRef.current !== currentFingerprint) {
      idempotencyKey = crypto.randomUUID()
      idempotencyKeyRef.current = idempotencyKey
      lastFingerprintRef.current = currentFingerprint
    }

    const request: CheckoutCartRequest = {
      addressId: selectedAddressId,
      expectedCartVersion: quote.cartVersion,
      paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const order = await withAuthRetry((token) =>
        checkoutCart(request, idempotencyKey!, token)
      )

      if (paymentMethod === 'COD') {
        // Clear attempt
        idempotencyKeyRef.current = null
        lastFingerprintRef.current = null

        // Đồng bộ lại Cart Provider với giỏ hàng đã bị Backend xóa
        loadCart().catch(() => {
          // Lỗi reload Cart không làm hỏng flow đặt hàng thành công
        })

        // Điều hướng tới trang hoàn tất
        navigate(`/checkout/success?orderId=${encodeURIComponent(order.id)}`)
        return order
      }

      if (paymentMethod === 'Stripe') {
        const action = order.paymentAction
        if (
          action?.type === 'Redirect' &&
          action.url &&
          validateStripeRedirectUrl(action.url)
        ) {
          // Lưu metadata trước khi chuyển hướng sang Stripe
          if (user?.id) {
            savePendingStripeCheckout({
              source: 'cart',
              userId: user.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              idempotencyKey: idempotencyKey!,
              addressId: selectedAddressId,
              expectedCartVersion: quote.cartVersion,
            })
          }

          // Đồng bộ lại Cart Provider
          loadCart().catch(() => {})

          // Chuyển hướng trình duyệt sang Stripe Checkout
          window.location.assign(action.url)
          return order
        }

        // Action hoặc URL không hợp lệ
        setSubmitError(
          'Không thể khởi tạo cổng thanh toán Stripe. Đơn hàng đã được tạo, vui lòng thử lại sau.'
        )
      }
    } catch (err) {
      const errorMsg = mapCheckoutError(err)
      setSubmitError(errorMsg)

      if (err instanceof ApiError) {
        // Nhóm lỗi giỏ hàng hoặc tồn kho thay đổi: tải lại cart và quote, xoá key
        if (
          err.code === 'Checkout.CartChanged' ||
          err.code === 'Checkout.EmptyCart' ||
          err.code === 'Checkout.ProductNotFound' ||
          err.code === 'Checkout.ProductInactive' ||
          err.code === 'Checkout.InvalidPrice' ||
          err.code === 'Checkout.InsufficientStock' ||
          err.code === 'Checkout.InventoryChanged'
        ) {
          idempotencyKeyRef.current = null
          lastFingerprintRef.current = null
          loadCart().catch(() => {})
          refetchQuote().catch(() => {})
        } else if (err.code === 'Checkout.AddressNotFound') {
          loadAddresses().catch(() => {})
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    user,
    cart,
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
    quote,
    quoteStatus,
    quoteError,
    refetchQuote,
    isSubmitting,
    submitError,
    setSubmitError,
    handleCheckout,
  }
}
