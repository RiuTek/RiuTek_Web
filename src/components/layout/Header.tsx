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
  Package,
  Bookmark,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { USER_ROLE_LABELS, UserRole } from '../../features/auth/authTypes'
import { useCart } from '../../features/cart/CartContext'
import { BrandLogo } from '../branding/BrandLogo'

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const location = useLocation()
  const { status, user, logout, retryBootstrap } = useAuth()
  const { itemCount, status: cartStatus } = useCart()

  const showBadge = status === 'authenticated' && cartStatus === 'ready' && itemCount > 0
  const badgeText = itemCount > 99 ? '99+' : String(itemCount)

  const isActive = (path: string) => location.pathname === path
  const isProductsActive = location.pathname.startsWith('/products')
  const isOrdersActive = location.pathname.startsWith('/orders')
  const isBuildsActive = location.pathname.startsWith('/pc-builds')

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
      setMobileMenuOpen(false)
    } catch {
      setLogoutError('Không thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.')
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
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl px-1 py-0.5"
          aria-label="Trang chủ RiuTek"
        >
          <BrandLogo
            markClassName="h-8 sm:h-9 w-auto group-hover:scale-105 transition-transform"
            textClassName="text-xl sm:text-2xl"
            theme="light"
          />
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
          {/* Cart Link with Live Real Badge */}
          <Link
            to="/cart"
            className="p-2 rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 relative"
            aria-label={
              showBadge
                ? `Xem giỏ hàng (${itemCount} sản phẩm)`
                : 'Xem giỏ hàng'
            }
          >
            <ShoppingCart className="w-5 h-5" />
            {showBadge && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none border-2 border-white shadow-xs"
              >
                {badgeText}
              </span>
            )}
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
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/orders"
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isOrdersActive
                    ? 'bg-red-50 border border-red-200 text-red-600'
                    : 'hover:bg-slate-50 text-slate-700 hover:text-red-600'
                }`}
                title="Đơn hàng của tôi"
              >
                <Package className="w-4 h-4" />
                <span>Đơn Hàng</span>
              </Link>
              {user.role === UserRole.Customer && (
                <Link
                  to="/pc-builds"
                  className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                    isBuildsActive
                      ? 'bg-red-50 border border-red-200 text-red-600'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-red-600'
                  }`}
                  title="Cấu hình của tôi"
                >
                  <Bookmark className="w-4 h-4" />
                  <span>Cấu Hình</span>
                </Link>
              )}
              <Link
                to="/account"
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                  isActive('/account')
                    ? 'bg-red-50 border border-red-200 text-red-600'
                    : 'hover:bg-slate-50 text-slate-900'
                }`}
                aria-label="Tài khoản của tôi"
                title="Quản lý tài khoản"
              >
                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 max-w-[110px] sm:max-w-[150px] truncate leading-tight">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight">
                    {USER_ROLE_LABELS[user.role] ?? 'Không xác định'}
                  </span>
                </div>
              </Link>
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
            <div className="flex items-center gap-1.5">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-red-600 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng Nhập</span>
              </Link>
              <Link
                to="/register"
                className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-full bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold hover:bg-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span>Đăng Ký</span>
              </Link>
            </div>
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

      {/* Shared Logout Error Alert (Visible on Desktop & Mobile) */}
      {logoutError && (
        <div
          role="alert"
          className="bg-rose-50 border-b border-rose-200 text-rose-700 text-xs py-2 px-4 sm:px-6 lg:px-8 shadow-xs"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{logoutError}</span>
            </div>
            <button
              type="button"
              onClick={() => setLogoutError(null)}
              className="p-1 hover:bg-rose-100 rounded text-rose-600 hover:text-rose-800 transition-colors"
              aria-label="Đóng thông báo lỗi đăng xuất"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

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
              aria-label={
                showBadge
                  ? `Giỏ Hàng (${itemCount} sản phẩm)`
                  : 'Giỏ Hàng'
              }
            >
              <div className="flex items-center gap-2">
                <span>Giỏ Hàng</span>
                {showBadge && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 text-xs font-bold rounded-full">
                    {badgeText}
                  </span>
                )}
              </div>
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
                  <Link
                    to="/orders"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl transition-colors ${
                      isOrdersActive
                        ? 'bg-red-50 border border-red-200 text-red-600'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-red-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Đơn Hàng Của Tôi
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-red-600">
                        Xem đơn &rarr;
                      </span>
                    </div>
                  </Link>
                  {user.role === UserRole.Customer && (
                    <Link
                      to="/pc-builds"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-2.5 rounded-xl transition-colors ${
                        isBuildsActive
                          ? 'bg-red-50 border border-red-200 text-red-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-red-600" />
                          <span className="text-xs font-bold text-slate-900">
                            Cấu Hình Của Tôi
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-red-600">
                          Xem cấu hình &rarr;
                        </span>
                      </div>
                    </Link>
                  )}
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl transition-colors ${
                      isActive('/account')
                        ? 'bg-red-50 border border-red-200 text-red-600'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user.fullName}
                      </p>
                      <span className="text-[10px] font-semibold text-red-600">
                        Tài khoản &rarr;
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {USER_ROLE_LABELS[user.role] ?? 'Không xác định'} • {user.email}
                    </p>
                  </Link>
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
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 border border-slate-200"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Đăng Nhập</span>
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Đăng Ký</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
