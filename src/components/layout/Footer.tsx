import React from 'react'
import { Link } from 'react-router-dom'
import { Cpu, ExternalLink } from 'lucide-react'

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
              Nền tảng thương mại điện tử chuyên sâu về linh kiện máy tính, hệ thống PC Gaming và máy trạm AI cấu hình cao.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-red-500" />
              <span>Phase 0: Storefront Shell</span>
            </div>
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
                  PC Builder Studio
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-red-400 transition-colors">
                  Tài Khoản &amp; Đăng Nhập
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Tiến Độ Dự Án</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center justify-between">
                <span>Frontend Foundation</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900 font-medium">Hoàn thành</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Product Catalog API</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-900 font-medium">Kế hoạch</span>
              </li>
              <li className="flex items-center justify-between">
                <span>AI Compatibility Engine</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">Kế hoạch</span>
              </li>
              <li className="flex items-center justify-between">
                <span>Cart &amp; Order Processing</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">Kế hoạch</span>
              </li>
            </ul>
          </div>

          {/* Technical Notice */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Thông Tin Kỹ Thuật</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Trang web đang trong giai đoạn phát triển giao diện người dùng. Mọi dữ liệu sản phẩm hiển thị trên trang chủ mang tính chất minh họa layout.
            </p>
            <div className="pt-1">
              <Link
                to="/products"
                className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-medium"
              >
                <span>Xem lộ trình linh kiện</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RiuTek Web Project. Nền tảng storefront mã nguồn mở.</p>
          <div className="flex items-center gap-6">
            <Link to="/products" className="hover:text-slate-400 transition-colors">
              Chính sách bảo mật
            </Link>
            <Link to="/products" className="hover:text-slate-400 transition-colors">
              Điều khoản sử dụng
            </Link>
            <span className="text-slate-700">|</span>
            <span>Design system: Kinetic Apex</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
