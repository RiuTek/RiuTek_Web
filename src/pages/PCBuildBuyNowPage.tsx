import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useBlocker } from 'react-router-dom'
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
import { CheckoutAddressSelector } from '../features/checkout/components/CheckoutAddressSelector'
import { CheckoutPaymentSelector } from '../features/checkout/components/CheckoutPaymentSelector'
import {
  BuyNowPCBuildSummary,
} from '../features/buyNow/components/BuyNowPCBuildSummary'
import {
  savePendingStripeCheckout,
  validateStripeRedirectUrl,
} from '../features/checkout/stripeCheckoutSession'
import {
  type ActiveAttempt,
  type KnownOrderState,
  validateAndNormalizeSavedAttempt,
  canCreateNewOrder,
  canReplayExistingAttempt,
  canRecoverKnownOrder,
  shouldBlockBuyNowNavigation,
  executeBuyNowPCBuildSubmit,
} from '../features/buyNow/pcBuildBuyNowHelper'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type { ActiveAttempt, KnownOrderState }

const getAttemptStorageKey = (ownerId: string, buildId: string) =>
  `riutek:pc-build-buy-now-attempt:${ownerId}:${buildId}`

function loadSavedAttempt(ownerId: string, buildId: string): ActiveAttempt | null {
  try {
    const raw = sessionStorage.getItem(getAttemptStorageKey(ownerId, buildId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return validateAndNormalizeSavedAttempt(parsed, ownerId, buildId)
  } catch {
    return null
  }
}

function persistSavedAttempt(
  attempt: ActiveAttempt | null,
  ownerId: string,
  buildId: string
): void {
  try {
    const key = getAttemptStorageKey(ownerId, buildId)
    if (!attempt || attempt.status === 'idle') {
      sessionStorage.removeItem(key)
    } else {
      sessionStorage.setItem(key, JSON.stringify(attempt))
    }
  } catch {
    // Ignore sessionStorage errors
  }
}

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

  // 2. Quản lý Attempt state machine (đóng băng khi unresolved hoặc có knownOrder)
  const [activeAttempt, setActiveAttempt] = useState<ActiveAttempt | null>(() =>
    loadSavedAttempt(ownerId, buildId)
  )

  // 3. Quản lý Address selection (khóa theo attempt snapshot nếu attempt đang hoạt động)
  const [userSelectedAddressId, setUserSelectedAddressId] = useState<string | null>(null)

  const selectedAddressId = useMemo(() => {
    if (activeAttempt?.requestPayload?.addressId) {
      return activeAttempt.requestPayload.addressId
    }
    if (addresses.length === 0) return null
    if (userSelectedAddressId && addresses.some((a) => a.id === userSelectedAddressId)) {
      return userSelectedAddressId
    }
    const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0]
    return defaultAddr ? defaultAddr.id : null
  }, [activeAttempt, addresses, userSelectedAddressId])

  // 4. Quản lý Payment Method & Notes (khóa theo attempt snapshot nếu attempt đang hoạt động)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(() =>
    activeAttempt?.requestPayload?.paymentMethod ?? 'COD'
  )
  const [notes, setNotes] = useState(() => activeAttempt?.requestPayload?.notes ?? '')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Khóa tương tác khi request đang gửi hoặc attempt chưa rõ kết quả / đang chờ xử lý
  const isInputLocked =
    isSubmitting ||
    (activeAttempt !== null &&
      activeAttempt.status !== 'idle')

  // 5. Sequence, Lifecycle & Navigation Bypass refs
  const isMountedRef = useRef(true)
  const userRef = useRef(user)
  const buildIdRef = useRef(buildId)
  const recordSeqRef = useRef(0)
  const submitSeqRef = useRef(0)
  const isSuccessBypassRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      isSuccessBypassRef.current = false
    }
  }, [])

  useEffect(() => {
    userRef.current = user
    buildIdRef.current = buildId
    isSuccessBypassRef.current = false
  }, [user, buildId])

  // Đồng bộ activeAttempt vào sessionStorage khi thay đổi
  useEffect(() => {
    persistSavedAttempt(activeAttempt, ownerId, buildId)
  }, [activeAttempt, ownerId, buildId])

  // 6. Navigation protection khi attempt ở trạng thái chưa rõ kết quả hoặc có knownOrder chưa xử lý xong
  const isAttemptActive =
    activeAttempt !== null &&
    activeAttempt.status !== 'idle'

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlockBuyNowNavigation({
        isAttemptActive,
        isSuccessBypass: isSuccessBypassRef.current,
        currentPath: currentLocation.pathname,
        nextPath: nextLocation.pathname,
      })
  )

  useEffect(() => {
    if (!isAttemptActive) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isAttemptActive])

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

  // Quyết định quyền submit tách biệt hoàn toàn giữa tạo mới và replay
  const isCustomer = user?.role === UserRole.Customer

  const canCreate = canCreateNewOrder({
    isCustomer,
    build,
    selectedAddressId,
    notes,
    isSubmitting,
    activeAttempt,
  })

  const canReplay = canReplayExistingAttempt({
    activeAttempt,
    isSubmitting,
  })

  const canRecover = canRecoverKnownOrder({
    activeAttempt,
    isSubmitting,
  })

  // Xử lý Đặt mua cấu hình / Replay (POST /orders/buy-now/pc-build/{buildId})
  const handleBuyNowSubmit = async () => {
    const submitSeq = ++submitSeqRef.current
    const isContextCurrent = () =>
      isMountedRef.current &&
      userRef.current?.id === ownerId &&
      buildIdRef.current === buildId &&
      submitSeqRef.current === submitSeq

    await executeBuyNowPCBuildSubmit({
      buildId,
      ownerId,
      user,
      canCreate,
      canReplay,
      activeAttempt,
      selectedAddressId,
      paymentMethod,
      notes,
      isSubmitting,
      getAccessToken,
      buyNowPCBuild,
      savePendingStripeCheckout,
      validateStripeRedirectUrl,
      onSuccessNavigate: (order) => {
        isSuccessBypassRef.current = true
        setActiveAttempt(null)
        persistSavedAttempt(null, ownerId, buildId)
        if (blocker.state === 'blocked') {
          blocker.reset()
        }
        navigate(`/checkout/success?orderId=${encodeURIComponent(order.id)}`)
      },
      setActiveAttempt,
      persistSavedAttempt,
      setSubmitError,
      setIsSubmitting,
      isContextCurrent,
      onAddressNotFound: () => {
        loadAddresses().catch(() => {})
      },
    })
  }

  // Thử lưu lại pending Stripe và chuyển hướng
  const handleRetryStorageAndRedirect = () => {
    if (!activeAttempt?.knownOrder?.paymentAction?.url || !user?.id) return
    const url = activeAttempt.knownOrder.paymentAction.url
    if (!validateStripeRedirectUrl(url)) return

    const saved = savePendingStripeCheckout({
      source: 'pc-build',
      userId: user.id,
      orderId: activeAttempt.knownOrder.id,
      orderNumber: activeAttempt.knownOrder.orderNumber,
      idempotencyKey: activeAttempt.idempotencyKey,
      addressId: activeAttempt.requestPayload.addressId,
      buildId: buildId,
    })

    if (saved) {
      window.location.assign(url)
    } else {
      setSubmitError(
        'Trình duyệt vẫn đang chặn lưu trữ sessionStorage. Vui lòng kiểm tra cài đặt trình duyệt hoặc mở chi tiết đơn hàng để thanh toán.'
      )
    }
  }

  // Loading skeleton (khi chưa có attempt và đang tải record)
  if (isLoadingRecord && !activeAttempt) {
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

  // Error loading record khi KHÔNG có attempt đang hoạt động
  if ((currentError || !build) && !activeAttempt) {
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

  // Empty build check khi KHÔNG có attempt đang hoạt động
  if (build && build.items.length === 0 && !activeAttempt) {
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
          to={`/pc-builds/${buildId}`}
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

      {/* Warning nếu load record ban đầu bị lỗi nhưng có active attempt */}
      {currentError && activeAttempt && (
        <div
          role="alert"
          className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Không thể tải lại chi tiết linh kiện mới nhất từ máy chủ, nhưng bạn vẫn có thể kiểm tra hoặc thử lại đơn hàng đang chờ bên dưới.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoadError(null)
              setReloadTrigger((prev) => prev + 1)
            }}
            className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
          >
            Tải lại cấu hình
          </button>
        </div>
      )}

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
            disabled={isInputLocked}
          />

          <CheckoutPaymentSelector
            paymentMethod={paymentMethod}
            onChangePaymentMethod={setPaymentMethod}
            notes={notes}
            onChangeNotes={setNotes}
            disabled={isInputLocked}
          />
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-5 xl:col-span-4">
          <BuyNowPCBuildSummary
            build={build}
            buildId={buildId}
            currentTotal={currentTotal}
            paymentMethod={paymentMethod}
            isSubmitting={isSubmitting}
            submitError={submitError}
            attemptStatus={activeAttempt?.status ?? 'idle'}
            unresolvedMessage={activeAttempt?.unresolvedMessage}
            knownOrder={activeAttempt?.knownOrder}
            canCreateNew={canCreate}
            canReplay={canReplay || canRecover}
            onSubmit={handleBuyNowSubmit}
            onRetryStorageAndRedirect={handleRetryStorageAndRedirect}
          />
        </div>
      </div>

      {/* Navigation Blocker Modal when attempt is unresolved / knownOrder pending */}
      {blocker.state === 'blocked' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-leave-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1 min-w-0">
                <h3
                  id="confirm-leave-title"
                  className="text-base font-bold text-slate-900"
                >
                  Xác nhận rời khỏi trang
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Giao dịch đặt mua cấu hình của bạn hiện chưa xác định xong kết quả từ máy chủ hoặc đơn hàng vừa được tạo.
                </p>
                <p className="text-xs text-amber-800 font-medium">
                  Nếu tiếp tục rời trang, vui lòng kiểm tra danh sách <strong>"Đơn hàng của tôi"</strong> trước khi đặt mua lại để tránh bị tạo 2 đơn.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Ở lại trang này
              </button>
              <button
                type="button"
                onClick={() => blocker.proceed()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
              >
                Rời khỏi
              </button>
            </div>
          </div>
        </div>
      )}
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
