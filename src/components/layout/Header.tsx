import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ShoppingCart,
  Menu,
  X,
  Cpu,
  Layers,
  Sparkles,
  LogIn,
  LogOut,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { USER_ROLE_LABELS } from '../../features/auth/authTypes'

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const location = useLocation()
  const { status, user, logout, retryBootstrap } = useAuth()

  const isActive = (path: string) => location.pathname === path
  const isProductsActive = location.pathname.startsWith('/products')

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
      setMobileMenuOpen(false)
    } catch {
      setLogoutError('Không thể đăng xuất. Vui lòng thử lại.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-red-100/60 shadow-[0_4px_24px_rgba(220,38,38,0.04)]">
      {/* 1. Concise product message announcement bar */}
      <div className="bg-slate-950 text-white py-2 px-4 sm:px-6 lg:px-8 text-xs font-medium text-center">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <span className="text-slate-300">
            Lựa chọn linh kiện dễ dàng • Kiểm tra tương thích cấu hình PC
          </span>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full px-1"
          aria-label="Trang chủ RiuTek"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-extrabold text-lg shadow-sm group-hover:scale-105 transition-transform">
            R
          </div>
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 uppercase flex items-center gap-1.5">
            RIUTEK
            <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold">
              APEX
            </span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-semibold">
          <Link
            to="/"
            className={`px-4 py-2 rounded-full transition-colors ${
              isActive('/')
                ? 'bg-red-50 text-red-600 font-bold'
                : 'text-slate-700 hover:text-red-600 hover:bg-slate-50'
            }`}
          >
            Trang Chủ
          </Link>

          <Link
            to="/products"
            className={`px-4 py-2 rounded-full transition-colors flex items-center gap-1.5 ${
              isProductsActive
                ? 'bg-red-50 text-red-600 font-bold'
                : 'text-slate-700 hover:text-red-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            Linh Kiện
          </Link>

          <Link
            to="/pc-builder"
            className={`px-4 py-2 rounded-full transition-all flex items-center gap-1.5 border ${
              isActive('/pc-builder')
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50/80 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300'
            }`}
          >
            <Sparkles className="w-4 h-4 text-red-500 animate-pulse" />
            PC Builder
          </Link>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Cart Link (bỏ badge số 0 hardcode) */}
          <Link
            to="/cart"
            className="p-2 rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Xem giỏ hàng"
          >
            <ShoppingCart className="w-5 h-5" />
          </Link>

          {/* Desktop Account Area theo 4 trạng thái auth */}
          {status === 'checking' ? (
            <div
              className="h-9 w-24 bg-slate-100 rounded-full animate-pulse"
              aria-hidden="true"
            />
          ) : status === 'unavailable' ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="hidden sm:inline">Lỗi phiên</span>
              <button
                type="button"
                onClick={retryBootstrap}
                className="p-1 hover:bg-amber-100 rounded-full text-amber-800 transition-colors"
                aria-label="Thử lại kết nối phiên"
                title="Thử lại kết nối"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : status === 'authenticated' && user ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-900 max-w-[120px] sm:max-w-[160px] truncate leading-tight">
                  {user.fullName}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-tight">
                  {USER_ROLE_LABELS[user.role] ?? 'Khách hàng'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="p-2 rounded-full text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-red-600 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập</span>
            </Link>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* 3. Sub-Category Quick Ribbon */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 sm:px-6 lg:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6 whitespace-nowrap min-w-max">
          <div className="flex items-center gap-5">
            <Link
              to="/products"
              className="hover:text-red-400 transition-colors flex items-center gap-1 font-medium"
            >
              <Cpu className="w-3.5 h-3.5 text-red-400" />
              Vi Xử Lý (CPU)
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/products" className="hover:text-red-400 transition-colors font-medium">
              Card Đồ Họa (GPU)
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/products" className="hover:text-red-400 transition-colors font-medium">
              Bo Mạch Chủ (Mainboard)
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/products" className="hover:text-red-400 transition-colors font-medium">
              RAM &amp; SSD PCIe Gen 5
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/products" className="hover:text-red-400 transition-colors font-medium">
              Nguồn Máy Tính (PSU)
            </Link>
            <span className="text-slate-700">•</span>
            <Link to="/products" className="hover:text-red-400 transition-colors font-medium">
              Vỏ Case &amp; Tản Nhiệt
            </Link>
          </div>
          <span className="text-slate-400 text-[11px] hidden md:inline">
            Danh mục linh kiện chính
          </span>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg">
          {logoutError && (
            <p className="text-xs text-rose-600 px-2 font-medium">{logoutError}</p>
          )}

          <div className="flex flex-col gap-1 pt-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/') ? 'bg-red-50 text-red-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Trang Chủ
            </Link>
            <Link
              to="/products"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${
                isProductsActive
                  ? 'bg-red-50 text-red-600'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Linh Kiện Phần Cứng
            </Link>
            <Link
              to="/pc-builder"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${
                isActive('/pc-builder') ? 'bg-red-50 text-red-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              PC Builder Studio
            </Link>
            <Link
              to="/cart"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                isActive('/cart') ? 'bg-red-50 text-red-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Giỏ Hàng</span>
              <ShoppingCart className="w-4 h-4 text-slate-500" />
            </Link>

            {/* Mobile Auth Area */}
            <div className="pt-2 border-t border-slate-100 mt-1">
              {status === 'checking' ? (
                <div className="px-4 py-2.5 h-10 bg-slate-100 rounded-xl animate-pulse" />
              ) : status === 'unavailable' ? (
                <div className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800">
                  <span>Không thể xác thực phiên</span>
                  <button
                    type="button"
                    onClick={retryBootstrap}
                    className="p-1 hover:bg-amber-100 rounded-lg font-bold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Thử lại</span>
                  </button>
                </div>
              ) : status === 'authenticated' && user ? (
                <div className="space-y-2">
                  <div className="px-4 py-2 bg-slate-50 rounded-xl">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user.fullName}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {USER_ROLE_LABELS[user.role] ?? 'Khách hàng'} • {user.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng Xuất'}</span>
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng Nhập</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
