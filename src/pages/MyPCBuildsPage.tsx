import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Bookmark,
  Cpu,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Zap,
  CheckCircle2,
  ShieldAlert,
  Loader2,
} from 'lucide-react'
import { ApiError, type PagedResult } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { UserRole } from '../features/auth/authTypes'
import { formatVnd } from '../features/products/productConstants'
import { getMyPCBuilds } from '../features/pcBuilder/pcBuilderApi'
import {
  type MyPCBuildSummary,
  PCBuildStatus,
  getPCBuildStatusLabel,
} from '../features/pcBuilder/pcBuilderTypes'

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

export const MyPCBuildsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, getAccessToken } = useAuth()

  const rawPage = searchParams.get('page')
  const parsedPage = rawPage ? parseInt(rawPage, 10) : 1
  const currentPage = isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage

  const [data, setData] = useState<PagedResult<MyPCBuildSummary> | null>(null)
  const [queryError, setQueryError] = useState<{ key: string; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const isCustomer = user?.role === UserRole.Customer

  const currentQueryKey = `${currentPage}-${reloadKey}`
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null)

  const currentError =
    queryError?.key === currentQueryKey ? queryError.message : null
  const isLoading =
    isCustomer && loadedQueryKey !== currentQueryKey && currentError === null

  const handlePageChange = (newPage: number) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('page', String(newPage))
    setSearchParams(nextParams)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleRetry = () => {
    setQueryError(null)
    setReloadKey((prev) => prev + 1)
  }

  useEffect(() => {
    // Không gửi request nếu người dùng không phải Customer (Staff/Admin)
    if (!isCustomer) {
      return
    }

    let cancelled = false
    const abortController = new AbortController()

    getAccessToken(false)
      .then((token) => {
        if (!token) throw new Error('Chưa đăng nhập.')
        return getMyPCBuilds(currentPage, 20, token, abortController.signal)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) {
          return getAccessToken(true).then((newToken) => {
            if (!newToken) throw err
            return getMyPCBuilds(currentPage, 20, newToken, abortController.signal)
          })
        }
        throw err
      })
      .then((res) => {
        if (!cancelled && res) {
          setData(res)
          setQueryError(null)
          setLoadedQueryKey(currentQueryKey)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof Error && err.name === 'AbortError') return
        let msg = 'Không thể tải danh sách cấu hình. Vui lòng kiểm tra kết nối mạng và thử lại.'
        if (err instanceof ApiError && err.description) {
          msg = err.description
        } else if (err instanceof Error) {
          msg = err.message
        }
        setQueryError({ key: currentQueryKey, message: msg })
        setLoadedQueryKey(currentQueryKey)
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [currentPage, reloadKey, currentQueryKey, isCustomer, getAccessToken])

  // Phân quyền: Staff/Admin không truy cập được endpoint Customer
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
              Chức năng quản lý cấu hình PC cá nhân chỉ áp dụng cho tài khoản Khách hàng (Customer).
              Tài khoản hiện tại ({user?.role ? user.role : 'Nhân viên / Quản trị'}) không thể thực hiện thao tác này.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/pc-builder"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Cpu className="w-4 h-4" />
              <span>Đến trang Xây dựng PC</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2.5">
            <Bookmark className="w-7 h-7 text-red-600" />
            <span>Cấu Hình Của Tôi</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Xem lại các dàn máy tính bạn đã tạo, kiểm tra tương thích và quản lý cấu hình.
          </p>
        </div>

        <Link
          to="/pc-builder"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs self-start sm:self-auto"
        >
          <Cpu className="w-4 h-4" />
          <span>Tạo cấu hình mới</span>
        </Link>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="min-h-[300px] flex flex-col items-center justify-center p-8 text-center"
        >
          <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Đang tải danh sách cấu hình...
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && currentError && (
        <div
          role="alert"
          className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3"
        >
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <p className="text-xs sm:text-sm font-semibold text-rose-900">{currentError}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !currentError && data && data.items.length === 0 && (
        <div className="min-h-[320px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-2xs">
            <Bookmark className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Bạn chưa có cấu hình PC nào
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
              Hãy dùng công cụ Xây dựng PC của RiuTek để tự do phối hợp linh kiện, kiểm tra độ tương thích và lưu lại vào tài khoản.
            </p>
          </div>
          <Link
            to="/pc-builder"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs"
          >
            <Cpu className="w-4 h-4" />
            <span>Bắt đầu tạo cấu hình</span>
          </Link>
        </div>
      )}

      {/* Builds List */}
      {!isLoading && !currentError && data && data.items.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.items.map((build) => {
              const isOrdered = build.status === PCBuildStatus.Ordered || (build.status as unknown) === 'Ordered' || (build.status as unknown) === 3
              const isSaved = build.status === PCBuildStatus.Saved || (build.status as unknown) === 'Saved' || (build.status as unknown) === 2

              return (
                <div
                  key={build.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-red-200 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 shadow-2xs group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-base font-bold text-slate-950 group-hover:text-red-600 transition-colors truncate">
                          {build.name}
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Ngày tạo: {formatDate(build.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex-shrink-0 ${
                          isOrdered
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : isSaved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {getPCBuildStatusLabel(build.status)}
                      </span>
                    </div>

                    {build.description && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {build.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold">
                        {build.itemCount} linh kiện
                      </span>
                      <span className="px-2 py-1 bg-amber-50/60 border border-amber-200/80 rounded-lg text-amber-800 font-semibold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-600" />
                        <span>{build.estimatedWattage} W</span>
                      </span>
                      {build.isCompatible ? (
                        <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tương thích</span>
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Có cảnh báo</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Tổng giá đã lưu</span>
                      <span className="text-base font-extrabold text-red-600">
                        {formatVnd(build.totalPrice)}
                      </span>
                    </div>

                    <Link
                      to={`/pc-builds/${build.id}`}
                      className="inline-flex items-center gap-1 px-3.5 py-2 bg-slate-900 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs group-hover:bg-red-600"
                    >
                      <span>Xem chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Trang <span className="font-bold text-slate-800">{data.pageIndex}</span> / {data.totalPages} (Tổng {data.totalCount} cấu hình)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!data.hasPreviousPage}
                  onClick={() => handlePageChange(data.pageIndex - 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trước</span>
                </button>
                <button
                  type="button"
                  disabled={!data.hasNextPage}
                  onClick={() => handlePageChange(data.pageIndex + 1)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
