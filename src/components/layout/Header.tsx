import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Search,
  ShoppingCart,
  Menu,
  X,
  Cpu,
  Layers,
  Sparkles,
  LogIn,
} from 'lucide-react'

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-red-100/60 shadow-[0_4px_24px_rgba(220,38,38,0.04)]">
      {/* 1. Concise, verified announcement bar */}
      <div className="bg-slate-950 text-white py-2 px-4 sm:px-6 lg:px-8 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-red-950/80 border border-red-800/80 rounded-full text-red-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              RiuTek Storefront Preview
            </span>
            <span className="text-slate-400 hidden sm:inline">|</span>
            <span className="text-slate-300 hidden sm:inline">
              Nền tảng thương mại điện tử linh kiện PC &amp; máy trạm hiệu năng cao
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span className="text-[11px] bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full">
              Phase 0 UI Shell
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full px-1"
          aria-label="RiuTek Homepage"
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

        {/* Search Bar (UI Preview) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
          <input
            type="text"
            placeholder="Tìm kiếm linh kiện: RTX 50, Ryzen, DDR5..."
            className="w-full bg-slate-50 py-2 pl-4 pr-10 rounded-full text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            readOnly
            onClick={() => {}}
            aria-label="Tìm kiếm sản phẩm"
          />
          <button
            type="button"
            className="w-7 h-7 rounded-full bg-red-600 text-white absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center hover:bg-red-700 transition-colors"
            aria-label="Thực hiện tìm kiếm"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

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
              isActive('/products')
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
          <Link
            to="/products"
            className="relative p-2 rounded-full text-slate-700 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Xem giỏ hàng"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              0
            </span>
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-red-600 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập</span>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
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
            Danh mục đang cập nhật
          </span>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm linh kiện..."
              className="w-full bg-slate-50 py-2 pl-4 pr-10 rounded-full text-sm text-slate-900 border border-slate-200"
              readOnly
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex flex-col gap-1 pt-2">
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
                isActive('/products') ? 'bg-red-50 text-red-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Linh Kiện Phần Cứng
            </Link>
            <Link
              to="/pc-builder"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
                isActive('/pc-builder') ? 'bg-red-50 text-red-600' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>PC Builder Studio</span>
              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                Preview
              </span>
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng Nhập / Tạo Tài Khoản</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
