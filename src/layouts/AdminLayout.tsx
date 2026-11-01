import React, { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  FolderTree,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react'
import { useAuth } from '../features/auth/AuthContext'
import { USER_ROLE_LABELS } from '../features/auth/authTypes'
import { BrandLogo } from '../components/branding/BrandLogo'

interface NavItem {
  to: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    to: '/admin/products',
    label: 'Quản lý sản phẩm',
    description: 'Danh sách, tìm kiếm & chỉnh sửa',
    icon: Package,
    end: true,
  },
  {
    to: '/admin/products/new',
    label: 'Thêm sản phẩm mới',
    description: 'Tạo mới 9 loại linh kiện',
    icon: PlusCircle,
    end: true,
  },
  {
    to: '/admin/product-imports',
    label: 'Nhập sản phẩm Excel',
    description: 'Import Excel & ghép thư mục ảnh SKU',
    icon: FileSpreadsheet,
    end: true,
  },
  {
    to: '/admin/categories',
    label: 'Quản lý danh mục',
    description: 'Cây danh mục & phân loại',
    icon: FolderTree,
    end: true,
  },
]

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const roleLabel = user ? USER_ROLE_LABELS[user.role] ?? user.role : 'Quản trị'

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
      setMobileNavOpen(false)
    } catch {
      setLogoutError('Không thể đăng xuất. Vui lòng kiểm tra kết nối mạng và thử lại.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:fixed lg:inset-y-0 bg-slate-950 text-white border-r border-slate-800 z-30">
        {/* Brand & Admin Badge */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <Link
            to="/admin/products"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl"
            aria-label="RiuTek Admin Catalog"
          >
            <BrandLogo markClassName="h-8 w-auto" textClassName="text-xl" theme="dark" />
          </Link>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3" />
            Admin
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto" aria-label="Menu quản trị">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Catalog &amp; Tồn kho
          </div>
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isEditRouteActive =
              item.to === '/admin/products' &&
              location.pathname.startsWith('/admin/products/') &&
              location.pathname !== '/admin/products/new'

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => {
                  const active = isActive || isEditRouteActive
                  return `flex items-start gap-3 px-3.5 py-3 rounded-2xl transition-all group ${
                    active
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`
                }}
              >
                <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold leading-snug">{item.label}</div>
                  <div className="text-[11px] opacity-75 truncate mt-0.5">
                    {item.description}
                  </div>
                </div>
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom Storefront Link & Account Info */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-900/50">
          <Link
            to="/"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition-colors border border-slate-700"
          >
            <Store className="w-4 h-4 text-red-400" />
            <span>Về cửa hàng</span>
          </Link>

          {user && (
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <Link
                to="/account"
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity"
                title="Hồ sơ cá nhân"
              >
                <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {roleLabel} • {user.email}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors disabled:opacity-50"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-950 text-white border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link to="/admin/products" className="flex items-center gap-2">
            <BrandLogo markClassName="h-7 w-auto" textClassName="text-lg" theme="dark" />
          </Link>
          <span className="px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-red-400" />
            <span>Về cửa hàng</span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 rounded-xl text-slate-200 hover:bg-slate-800"
            aria-label={mobileNavOpen ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden bg-slate-900 text-white border-b border-slate-800 px-4 py-4 space-y-3 z-30">
          <nav className="space-y-1" aria-label="Menu quản trị di động">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-red-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          {user && (
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
                <p className="text-[11px] text-slate-400 truncate">
                  {roleLabel} • {user.email}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {logoutError && (
          <div
            role="alert"
            className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{logoutError}</span>
            </div>
            <button
              type="button"
              onClick={() => setLogoutError(null)}
              className="p-1 hover:bg-rose-100 rounded text-rose-700"
              aria-label="Đóng thông báo lỗi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
