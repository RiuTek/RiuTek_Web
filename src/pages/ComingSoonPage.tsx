import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock, ArrowLeft, Home, Sparkles } from 'lucide-react'

export const ComingSoonPage: React.FC = () => {
  const location = useLocation()

  const getFeatureName = (pathname: string) => {
    switch (pathname) {
      case '/products':
        return 'Danh Mục Sản Phẩm & Bộ Lọc Linh Kiện'
      case '/pc-builder':
        return 'PC Builder Studio & Cấu Hình Tự Động'
      case '/login':
        return 'Xác Thực Tài Khoản & Quản Lý Đơn Hàng'
      default:
        return 'Tính Năng Đang Phát Triển'
    }
  }

  const featureName = getFeatureName(location.pathname)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-6 shadow-sm">
        <Clock className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-4">
        <Sparkles className="w-3.5 h-3.5 text-red-600" />
        Lộ Trình Phát Triển — In Progress
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
        {featureName}
      </h1>

      <p className="text-base sm:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
        Phân hệ này đang được lên kế hoạch tích hợp cùng Backend API trong các Phase tiếp theo. Chúng tôi ưu tiên trải nghiệm chuẩn xác, ổn định và bảo mật cao trước khi mở rộng.
      </p>

      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm max-w-lg w-full mb-8 text-left text-sm text-slate-600 space-y-2">
        <div className="font-semibold text-slate-900 mb-1 flex items-center justify-between">
          <span>Trạng thái kỹ thuật:</span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
            {location.pathname}
          </span>
        </div>
        <p>• Phase 0: Vite React storefront shell &amp; baseline deployment.</p>
        <p>• Phase 1+: Kết nối Product Catalog, Giỏ hàng, PC Builder Studio và Auth.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-md shadow-red-600/20 transition-all transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Home className="w-4 h-4" />
          <span>Về Trang Chủ</span>
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-700 border border-slate-300 font-semibold text-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay Lại Trang Trước</span>
        </button>
      </div>
    </div>
  )
}
