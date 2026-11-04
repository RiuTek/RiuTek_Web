import React from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, RotateCcw, ShieldAlert } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { resolveAdminAccessState } from './adminGuardHelper'

interface RequireAdminOrStaffProps {
  children: React.ReactNode
}

export const RequireAdminOrStaff: React.FC<RequireAdminOrStaffProps> = ({ children }) => {
  const { status, isAuthenticated, user, retryBootstrap } = useAuth()
  const location = useLocation()

  const resolution = resolveAdminAccessState({
    authStatus: status,
    isAuthenticated,
    user,
    currentPathWithSearch: location.pathname + location.search,
  })

  if (resolution.status === 'checking') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">
          Đang kiểm tra quyền truy cập quản trị...
        </p>
      </div>
    )
  }

  if (resolution.status === 'unavailable') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Không thể xác thực phiên làm việc
        </h2>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Không thể kết nối đến máy chủ để kiểm tra quyền quản trị. Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
        <button
          type="button"
          onClick={retryBootstrap}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Thử lại</span>
        </button>
      </div>
    )
  }

  if (resolution.status === 'redirect_login') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: resolution.loginReturnTo ?? '/admin/products' }}
      />
    )
  }

  if (resolution.status === 'forbidden') {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div
          role="alert"
          className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold uppercase tracking-wider">
              403 Forbidden
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">
              Không Có Quyền Truy Cập Quản Trị
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Khu vực Quản trị hệ thống (đơn hàng, sản phẩm, danh mục và tồn kho) chỉ dành cho tài khoản <strong>Nhân viên (Staff)</strong> hoặc <strong>Quản trị viên (Admin)</strong>.
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về cửa hàng</span>
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-colors"
            >
              <span>Xem danh mục linh kiện</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
