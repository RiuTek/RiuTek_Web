import React from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '../branding/BrandLogo'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 text-white pt-12 pb-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl"
              aria-label="Trang chủ RiuTek"
            >
              <BrandLogo
                markClassName="h-8 sm:h-9 w-auto group-hover:scale-105 transition-transform"
                textClassName="text-xl sm:text-2xl"
                theme="dark"
              />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              RiuTek — Linh kiện máy tính và tự chọn cấu hình PC. Tìm linh kiện, chọn cấu hình phù hợp và đặt hàng tại RiuTek.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Khám Phá</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/" className="hover:text-red-400 transition-colors">
                  Trang Chủ
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-red-400 transition-colors">
                  Linh Kiện
                </Link>
              </li>
              <li>
                <Link to="/pc-builder" className="hover:text-red-400 transition-colors">
                  Tự Chọn Cấu Hình
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-red-400 transition-colors">
                  Giỏ Hàng
                </Link>
              </li>
            </ul>
          </div>

          {/* Hardware Categories */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Nhóm Linh Kiện</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/products?componentType=1" className="hover:text-red-400 transition-colors">
                  Vi Xử Lý (CPU)
                </Link>
              </li>
              <li>
                <Link to="/products?componentType=3" className="hover:text-red-400 transition-colors">
                  Card Đồ Họa (GPU)
                </Link>
              </li>
              <li>
                <Link to="/products?componentType=2" className="hover:text-red-400 transition-colors">
                  Bo Mạch Chủ (Mainboard)
                </Link>
              </li>
              <li>
                <Link to="/products?componentType=4" className="hover:text-red-400 transition-colors">
                  Bộ Nhớ RAM
                </Link>
              </li>
              <li>
                <Link to="/products?componentType=5" className="hover:text-red-400 transition-colors">
                  Ổ Cứng (SSD &amp; HDD)
                </Link>
              </li>
              <li>
                <Link to="/products?componentType=6" className="hover:text-red-400 transition-colors">
                  Nguồn Máy Tính (PSU)
                </Link>
              </li>
            </ul>
          </div>

          {/* User Account */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Tài Khoản</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/login" className="hover:text-red-400 transition-colors">
                  Đăng Nhập
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-red-400 transition-colors">
                  Đăng Ký Tài Khoản
                </Link>
              </li>
              <li>
                <Link to="/account" className="hover:text-red-400 transition-colors">
                  Tài Khoản Của Tôi
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RiuTek. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Linh kiện máy tính &amp; tự chọn cấu hình PC</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
