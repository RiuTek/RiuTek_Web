import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Package,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { UserRole } from '../features/auth/authTypes'
import { useAddresses } from '../features/addresses/AddressContext'
import { getMyPCBuildById } from '../features/pcBuilder/pcBuilderApi'
import { buyNowPCBuild } from '../features/buyNow/buyNowApi'
import type { MyPCBuild } from '../features/pcBuilder/pcBuilderTypes'
import type { PaymentMethod } from '../features/orders/orderTypes'
import type { BuyNowPCBuildRequest } from '../features/buyNow/buyNowTypes'
import { CheckoutAddressSelector } from '../features/checkout/components/CheckoutAddressSelector'
import { CheckoutPaymentSelector } from '../features/checkout/components/CheckoutPaymentSelector'
import { BuyNowPCBuildSummary } from '../features/buyNow/components/BuyNowPCBuildSummary'
import {
  CHECKOUT_ERROR_MESSAGES,
  MAX_NOTES_LENGTH,
} from '../features/checkout/checkoutConstants'
import {
  savePendingStripeCheckout,
  validateStripeRedirectUrl,
} from '../features/checkout/stripeCheckoutSession'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface PCBuildBuyNowContentProps {
  buildId: string
  ownerId: string
}

const PCBuildBuyNowContent: React.FC<PCBuildBuyNowContentProps> = ({
  buildId,
  ownerId,
}) => {
  const navigate = useNavigate()
  const { user, getAccessToken } = useAuth()
  const {
    addresses,
    status: addressStatus,
    error: addressError,
    loadAddresses,
  } = useAddresses()

  // 1. Quản lý nạp dữ liệu cấu hình từ GET /pc-builds/{id}
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const currentQueryKey = `${buildId}-${reloadTrigger}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<{
    key: string
    status?: number
    message: string
  } | null>(null)
  const [build, setBuild] = useState<MyPCBuild | null>(null)

  const currentError = loadError?.key === currentQueryKey ? loadError : null
  const isLoadingRecord = loadedQueryKey !== currentQueryKey && currentError === null

  // 2. Quản lý Address selection
  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)

  const selectedAddressId = useMemo(() => {
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [addresses, userSelectedAddressId])

  // 3. Quản lý Payment Method & Notes
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // 4. Sequence & Lifecycle refs
  const isMountedRef = useRef(true)
  const userRef = useRef(user)
  const buildIdRef = useRef(buildId)
  const recordSeqRef = useRef(0)
  const submitSeqRef = useRef(0)

  // 5. Idempotency tracking refs
  const idempotencyKeyRef = useRef<string | null>(null)
  const lastFingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    userRef.current = user
    buildIdRef.current = buildId
  }, [user, buildId])

  // Tải dữ liệu cấu hình PC từ server
  useEffect(() => {
    let cancelled = false
    const currentSeq = ++recordSeqRef.current
    const abortController = new AbortController()

    const isContextCurrent = () =>
      isMountedRef.current &&
      !cancelled &&
      recordSeqRef.current === currentSeq &&
      userRef.current?.id === ownerId &&
      buildIdRef.current === buildId

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyPCBuildById(buildId, token, abortController.signal)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          return getAccessToken(true).then((newToken) => {
            if (!newToken) throw err
            return getMyPCBuildById(buildId, newToken, abortController.signal)
          })
        }
        throw err
      })
      .then((res) => {
        if (isContextCurrent() && res) {
          setBuild(res)
          setLoadError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (!isContextCurrent()) return
        if (err instanceof Error && err.name === 'AbortError') return

        if (err instanceof ApiError) {
          if (err.status === 404) {
            setLoadError({
              key: currentQueryKey,
              status: 404,
              message: 'Không tìm thấy cấu hình này hoặc cấu hình đã bị xóa.',
            })
          } else if (err.status === 403) {
            setLoadError({
              key: currentQueryKey,
              status: 403,
              message: 'Bạn không có quyền đặt mua cấu hình PC này.',
            })
          } else {
            setLoadError({
              key: currentQueryKey,
              status: err.status,
              message: err.description || 'Không thể tải chi tiết cấu hình. Vui lòng thử lại.',
            })
          }
        } else {
          setLoadError({
            key: currentQueryKey,
            message: err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.',
          })
        }
        setLoadedQueryKey(currentQueryKey)
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [buildId, ownerId, reloadTrigger, currentQueryKey, getAccessToken])

  // Tính tổng tiền theo giá hiện tại: SUM(currentPrice * quantity)
  const currentTotal = useMemo(() => {
    if (!build || !build.items) return 0
    return build.items.reduce((sum, item) => sum + item.currentPrice * item.quantity, 0)
  }, [build])

  // Kiểm tra điều kiện có thể submit
  const canSubmit =
    Boolean(build) &&
    Boolean(build?.canPurchaseAll) &&
    Boolean(build && build.items.length > 0) &&
    Boolean(selectedAddressId) &&
    notes.trim().length <= MAX_NOTES_LENGTH &&
    !isSubmitting

  // Xử lý Đặt mua cấu hình (POST /orders/buy-now/pc-build/{buildId})
  const handleBuyNowSubmit = async () => {
    if (!canSubmit || !build || !selectedAddressId || !user?.id) return

    const cleanNotes = notes.trim()
    if (cleanNotes.length > MAX_NOTES_LENGTH) {
      setSubmitError(`Ghi chú không được vượt quá ${MAX_NOTES_LENGTH} ký tự.`)
      return
    }

    const submitSeq = ++submitSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      userRef.current?.id === ownerId &&
      buildIdRef.current === buildId &&
      submitSeqRef.current === submitSeq

    // Idempotency Policy:
    // Fingerprint kết hợp: ownerId + buildId + addressId + paymentMethod + cleanNotes + items
    const itemsFingerprint = build.items
      .map((i) => `${i.productId}:${i.quantity}:${i.currentPrice}`)
      .sort()
      .join(';')
    const currentFingerprint = `${user.id}:${build.id}:${selectedAddressId}:${paymentMethod}:${cleanNotes}:${itemsFingerprint}`

    let idempotencyKey = idempotencyKeyRef.current
    if (!idempotencyKey || lastFingerprintRef.current !== currentFingerprint) {
      idempotencyKey = crypto.randomUUID()
      idempotencyKeyRef.current = idempotencyKey
      lastFingerprintRef.current = currentFingerprint
    }

    const requestPayload: BuyNowPCBuildRequest = {
      addressId: selectedAddressId,
      paymentMethod,
      notes: cleanNotes.length > 0 ? cleanNotes : null,
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      let token = await getAccessToken(false)
      if (!isContextCurrent()) return
      if (!token) throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.')

      const executeBuy = async (authToken: string) => {
        return buyNowPCBuild(build.id, requestPayload, idempotencyKey!, authToken)
      }

      let order
      try {
        order = await executeBuy(token)
      } catch (err: unknown) {
        if (!isContextCurrent()) return
        if (err instanceof ApiError && err.status === 401) {
          token = await getAccessToken(true)
          if (!isContextCurrent()) return
          if (!token) throw err
          order = await executeBuy(token)
        } else {
          throw err
        }
      }

      if (!isContextCurrent()) return

      if (paymentMethod === 'COD') {
        // Đặt hàng COD thành công: giải phóng attempt và điều hướng đến trang hoàn tất
        idempotencyKeyRef.current = null
        lastFingerprintRef.current = null
        // Giỏ hàng hiện tại được bảo toàn nguyên vẹn
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
          // Lưu pending Stripe metadata trước khi chuyển hướng sang Stripe
          savePendingStripeCheckout({
            source: 'pc-build',
            userId: user.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            idempotencyKey: idempotencyKey!,
            addressId: selectedAddressId,
            buildId: build.id,
          })

          // Giỏ hàng hiện tại được bảo toàn nguyên vẹn
          window.location.assign(action.url)
          return
        }

        setSubmitError(
          'Không thể khởi tạo cổng thanh toán Stripe an toàn. Vui lòng thử lại.'
        )
      }
    } catch (err: unknown) {
      if (!isContextCurrent()) return

      if (err instanceof ApiError) {
        if (err.code && CHECKOUT_ERROR_MESSAGES[err.code]) {
          setSubmitError(CHECKOUT_ERROR_MESSAGES[err.code])
        } else if (err.code === 'PCBuild.NotFound') {
          setSubmitError('Không tìm thấy cấu hình này trên máy chủ.')
        } else if (err.code === 'PCBuild.EmptyBuild') {
          setSubmitError('Cấu hình PC không có linh kiện nào để đặt mua.')
        } else if (err.description) {
          setSubmitError(err.description)
        } else {
          setSubmitError(err.message || 'Không thể đặt mua cấu hình PC lúc này.')
        }

        // Tải lại sổ địa chỉ nếu địa chỉ không tồn tại
        if (err.code === 'Checkout.AddressNotFound') {
          loadAddresses().catch(() => {})
        }

        // Với các lỗi business xác định không tạo order và không thể replay, xoay key mới
        if (
          err.code === 'Checkout.ProductInactive' ||
          err.code === 'Checkout.InsufficientStock' ||
          err.code === 'Checkout.InventoryChanged' ||
          err.code === 'Checkout.InvalidPrice' ||
          err.code === 'PCBuild.EmptyBuild'
        ) {
          idempotencyKeyRef.current = null
          lastFingerprintRef.current = null
        }
        // Đối với lỗi mạng / timeout / không rõ kết quả: giữ nguyên idempotencyKeyRef để retry an toàn
      } else if (err instanceof Error) {
        setSubmitError(err.message)
      } else {
        setSubmitError('Đã xảy ra lỗi không xác định. Vui lòng thử lại.')
      }
    } finally {
      if (isContextCurrent()) {
        setIsSubmitting(false)
      }
    }
  }

  // Loading skeleton
  if (isLoadingRecord) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center"
      >
        <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Đang tải dữ liệu cấu hình để chuẩn bị đặt mua...
        </p>
      </div>
    )
  }

  // Error loading record
  if (currentError || !build) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Không thể tải cấu hình PC
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              {currentError?.message || 'Không tìm thấy cấu hình này hoặc cấu hình đã bị xóa.'}
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoadError(null)
                setReloadTrigger((prev) => prev + 1)
              }}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
            <Link
              to="/pc-builds"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Danh sách cấu hình của tôi
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Empty build check
  if (build.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Cấu hình đang trống
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Cấu hình này hiện chưa có linh kiện nào. Bạn cần thêm linh kiện trước khi đặt mua.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              to={`/pc-builds/${build.id}/edit`}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs"
            >
              <span>Chỉnh sửa và thêm linh kiện</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="space-y-3 pb-4 border-b border-slate-200">
        <Link
          to={`/pc-builds/${build.id}`}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-red-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại chi tiết cấu hình</span>
        </Link>

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Xác Nhận Đặt Mua Cấu Hình PC
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Đặt mua trực tiếp trọn bộ cấu hình đã lưu, tách biệt hoàn toàn và không ảnh hưởng đến giỏ hàng hiện tại.
          </p>
        </div>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Checkout Inputs (Address, Payment, Notes) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <CheckoutAddressSelector
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setUserSelectedAddressId}
            isLoading={addressStatus === 'loading'}
            error={addressError}
            onRetry={() => {
              loadAddresses().catch(() => {})
            }}
          />

          <CheckoutPaymentSelector
            paymentMethod={paymentMethod}
            onChangePaymentMethod={setPaymentMethod}
            notes={notes}
            onChangeNotes={setNotes}
            disabled={isSubmitting}
          />
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 xl:col-span-4">
          <BuyNowPCBuildSummary
            build={build}
            currentTotal={currentTotal}
            paymentMethod={paymentMethod}
            isSubmitting={isSubmitting}
            submitError={submitError}
            canSubmit={canSubmit}
            onSubmit={handleBuyNowSubmit}
          />
        </div>
      </div>
    </div>
  )
}

export const PCBuildBuyNowPage: React.FC = () => {
  const { buildId } = useParams<{ buildId: string }>()
  const { user } = useAuth()

  const isCustomer = user?.role === UserRole.Customer
  const isUuidValid = Boolean(buildId && UUID_REGEX.test(buildId))

  if (!isCustomer) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Chức năng dành riêng cho Khách hàng
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Chức năng đặt mua cấu hình PC cá nhân chỉ áp dụng cho tài khoản Khách hàng (Customer).
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              to="/pc-builds"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              Về danh sách cấu hình
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!isUuidValid || !buildId) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Đường dẫn không hợp lệ
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Mã định danh cấu hình PC không đúng định dạng.
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Link
              to="/pc-builds"
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              Về danh sách cấu hình của tôi
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PCBuildBuyNowContent
      key={`${user.id}-${buildId}`}
      buildId={buildId}
      ownerId={user.id}
    />
  )
}
