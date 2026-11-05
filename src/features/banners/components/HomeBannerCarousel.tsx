import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ImageOff,
  AlertCircle,
} from 'lucide-react'
import type { PublicBannerDto } from '../bannerTypes'
import { getPublicBanners } from '../bannerApi'
import { isSafeInternalTargetUrl } from '../bannerHelper'

interface HomeBannerCarouselProps {
  banners?: PublicBannerDto[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}

const AUTOPLAY_INTERVAL_MS = 6000

export const HomeBannerCarousel: React.FC<HomeBannerCarouselProps> = ({
  banners: propBanners,
  isLoading: propIsLoading,
  error: propError,
  onRetry: propOnRetry,
}) => {
  const isControlled = propBanners !== undefined

  const [internalBanners, setInternalBanners] = useState<PublicBannerDto[]>([])
  const [internalLoading, setInternalLoading] = useState(!isControlled)
  const [internalError, setInternalError] = useState<Error | null>(null)
  const [internalRetryCount, setInternalRetryCount] = useState(0)

  const banners = isControlled ? propBanners : internalBanners
  const isLoading = isControlled ? (propIsLoading ?? false) : internalLoading
  const error = isControlled ? (propError ?? null) : internalError

  // Fetch dữ liệu nếu component chạy độc lập (uncontrolled)
  useEffect(() => {
    if (isControlled) return

    let isMounted = true
    const controller = new AbortController()

    getCategoriesAndBanners()
    async function getCategoriesAndBanners() {
      try {
        const data = await getPublicBanners(controller.signal)
        if (!isMounted) return
        setInternalBanners(Array.isArray(data) ? data : [])
        setInternalError(null)
      } catch (err: unknown) {
        if (!isMounted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setInternalError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (isMounted) setInternalLoading(false)
      }
    }

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isControlled, internalRetryCount])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isUserPaused, setIsUserPaused] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isDocumentHidden, setIsDocumentHidden] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  // Phân giải index an toàn trong render phase mà không cần sync effect
  const activeIndex =
    banners.length === 0 ? 0 : Math.min(Math.max(0, currentIndex), banners.length - 1)

  // Lắng nghe prefers-reduced-motion của người dùng
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Tạm dừng khi tab trình duyệt bị ẩn (visibilitychange)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handleVisibilityChange = () => {
      setIsDocumentHidden(document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const canAutoplay =
    banners.length >= 2 &&
    !isUserPaused &&
    !isHovered &&
    !isFocused &&
    !isDocumentHidden &&
    !prefersReducedMotion

  const goToNext = useCallback(() => {
    if (banners.length <= 1) return
    setCurrentIndex((prev) => (prev + 1) % banners.length)
  }, [banners.length])

  const goToPrev = useCallback(() => {
    if (banners.length <= 1) return
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
  }, [banners.length])

  // Timer tự chuyển slide sau 6 giây
  useEffect(() => {
    if (!canAutoplay) return

    const timer = setInterval(() => {
      goToNext()
    }, AUTOPLAY_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [canAutoplay, goToNext])

  const handleRetry = () => {
    if (isControlled && propOnRetry) {
      propOnRetry()
    } else {
      setInternalLoading(true)
      setInternalError(null)
      setInternalRetryCount((c) => c + 1)
    }
  }

  // 1. Trạng thái Loading Skeleton
  if (isLoading) {
    return (
      <div
        className="w-full aspect-[16/7] min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] bg-slate-900/90 rounded-3xl border border-slate-800 animate-pulse flex flex-col justify-between p-6 sm:p-8 overflow-hidden relative"
        aria-busy="true"
        aria-label="Đang tải danh sách banner quảng cáo"
      >
        <div className="flex items-center justify-between">
          <div className="h-6 w-28 bg-slate-800 rounded-full" />
          <div className="h-6 w-20 bg-slate-800 rounded-full" />
        </div>
        <div className="space-y-3 max-w-md">
          <div className="h-7 w-3/4 bg-slate-800 rounded-lg" />
          <div className="h-4 w-1/2 bg-slate-800/80 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-2 w-8 bg-slate-800 rounded-full" />
          <div className="h-2 w-2 bg-slate-800 rounded-full" />
          <div className="h-2 w-2 bg-slate-800 rounded-full" />
        </div>
      </div>
    )
  }

  // 2. Trạng thái Lỗi API với nút Thử lại nhẹ nhàng
  if (error && banners.length === 0) {
    return (
      <div className="w-full aspect-[16/7] min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-1">
          Không thể tải banner quảng cáo
        </h3>
        <p className="text-xs text-slate-500 max-w-md mb-4">
          Hệ thống không thể kết nối tới máy chủ để tải danh sách banner. Các khu vực mua sắm khác vẫn hoạt động bình thường.
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-red-600 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Thử lại</span>
        </button>
      </div>
    )
  }

  // 3. Trường hợp 0 Banner (Chưa có banner nào active từ Admin)
  if (banners.length === 0) {
    return (
      <div className="w-full aspect-[16/7] min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden text-white shadow-md">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-slate-700/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/80 border border-red-800/80 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Hệ sinh thái phần cứng PC
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            RiuTek Hardware
          </span>
        </div>

        <div className="relative z-10 my-auto py-4 max-w-xl">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
            Nền Tảng Linh Kiện &amp; Cấu Hình PC Chuyên Nghiệp
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
            Tra cứu thông số kỹ thuật, đối chiếu chuẩn socket tương thích và tự xây dựng bộ máy tính tối ưu hiệu năng cùng công cụ PC Builder.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/pc-builder"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs sm:text-sm font-bold shadow-md shadow-red-600/30 transition-all transform hover:-translate-y-0.5"
            >
              <span>Trải Nghiệm PC Builder</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-full text-xs sm:text-sm font-semibold border border-slate-700 transition-colors"
            >
              <span>Xem Tất Cả Linh Kiện</span>
            </Link>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-[11px] text-slate-400 font-mono pt-3 border-t border-slate-800/80">
          <div>Chuẩn Form Factor đồng bộ</div>
          <div>Băng thông PCIe thế hệ mới</div>
        </div>
      </div>
    )
  }

  // 4. Trường hợp 1 hoặc nhiều Banner (>= 1 banner)
  const currentBanner = banners[activeIndex]
  const isSafeUrl = isSafeInternalTargetUrl(currentBanner.targetUrl)

  const renderSlideContent = (banner: PublicBannerDto, index: number) => {
    const isSlideImageBroken = Boolean(brokenImages[banner.id])

    return (
      <div className="relative w-full h-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {banner.imageUrl && !isSlideImageBroken ? (
          <img
            src={banner.imageUrl}
            alt={banner.title}
            loading={index === 0 ? 'eager' : 'lazy'}
            onError={() => {
              setBrokenImages((prev) => ({ ...prev, [banner.id]: true }))
            }}
            className="w-full h-full object-cover object-center transition-transform duration-700"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <ImageOff className="w-10 h-10 mb-2 text-slate-600" />
            <span className="text-sm font-semibold text-slate-300">
              {banner.title}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Hình ảnh quảng cáo đang được cập nhật
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/20 pointer-events-none" />

        <div className="absolute bottom-4 left-5 right-20 sm:bottom-6 sm:left-6 sm:right-28 z-10 pointer-events-none">
          <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white drop-shadow-md line-clamp-1">
            {banner.title}
          </h3>
        </div>
      </div>
    )
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Banner quảng cáo nổi bật"
      className="relative w-full aspect-[16/7] min-h-[260px] sm:min-h-[320px] lg:min-h-[380px] rounded-3xl overflow-hidden border border-slate-200/80 shadow-md group bg-slate-950"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {isSafeUrl ? (
        <Link
          to={currentBanner.targetUrl}
          className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-3xl"
          tabIndex={0}
          aria-label={`Xem chi tiết: ${currentBanner.title}`}
        >
          {renderSlideContent(currentBanner, activeIndex)}
        </Link>
      ) : (
        <div className="w-full h-full">
          {renderSlideContent(currentBanner, activeIndex)}
        </div>
      )}

      {banners.length >= 2 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToPrev()
            }}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/60 backdrop-blur-md text-white hover:bg-red-600 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg z-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Chuyển đến banner trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              goToNext()
            }}
            className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-950/60 backdrop-blur-md text-white hover:bg-red-600 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-lg z-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Chuyển đến banner kế tiếp"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 sm:bottom-4 right-4 z-20 flex items-center gap-2 bg-slate-950/70 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 shadow-md">
            <div className="flex items-center gap-1.5">
              {banners.map((b, idx) => {
                const isActive = idx === activeIndex
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setCurrentIndex(idx)
                    }}
                    className={`transition-all rounded-full focus:outline-none focus-visible:ring-1 focus-visible:ring-white ${
                      isActive
                        ? 'w-6 h-2 bg-red-600'
                        : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                    }`}
                    aria-label={`Chuyển đến banner ${idx + 1}: ${b.title}`}
                    aria-current={isActive ? 'true' : 'false'}
                  />
                )
              })}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsUserPaused((prev) => !prev)
              }}
              className="w-5 h-5 text-white/80 hover:text-white flex items-center justify-center rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-white ml-1"
              aria-label={
                isUserPaused
                  ? 'Tiếp tục tự động chuyển banner'
                  : 'Tạm dừng tự động chuyển banner'
              }
              title={
                isUserPaused
                  ? 'Tiếp tục tự động chuyển banner'
                  : 'Tạm dừng tự động chuyển banner'
              }
            >
              {isUserPaused ? (
                <Play className="w-3 h-3 fill-current" />
              ) : (
                <Pause className="w-3 h-3 fill-current" />
              )}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
