import React from 'react'
import { Link } from 'react-router-dom'

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 text-white pt-12 pb-8 border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-extrabold text-base">
                R
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white uppercase">
                RIUTEK <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-900 font-bold ml-1">APEX</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              Nền tảng thương mại điện tử chuyên sâu về linh kiện máy tính, hệ thống PC Gaming và máy trạm đồ họa, tính toán hiệu năng cao.
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
                  Danh Mục Linh Kiện
                </Link>
              </li>
              <li>
                <Link to="/pc-builder" className="hover:text-red-400 transition-colors">
                  PC Builder
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
                <Link to="/products" className="hover:text-red-400 transition-colors">
                  Vi Xử Lý (CPU)
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-red-400 transition-colors">
                  Card Đồ Họa (GPU)
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-red-400 transition-colors">
                  Bo Mạch Chủ (Mainboard)
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-red-400 transition-colors">
                  Bộ Nhớ RAM &amp; SSD NVMe
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
                  Đăng Nhập / Đăng Ký
                </Link>
              </li>
              <li>
                <Link to="/cart" className="hover:text-red-400 transition-colors">
                  Quản Lý Đơn Hàng
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RiuTek. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Nền tảng phần cứng &amp; cấu hình PC</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
