import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Clock, ArrowLeft, Home } from 'lucide-react'

export const ComingSoonPage: React.FC = () => {
  const location = useLocation()

  const getFeatureName = (pathname: string) => {
    switch (pathname) {
      case '/products':
        return 'Danh Mục Sản Phẩm & Linh Kiện'
      case '/pc-builder':
        return 'PC Builder Studio'
      case '/cart':
        return 'Giỏ Hàng'
      case '/login':
        return 'Tài Khoản & Đăng Nhập'
      default:
        return 'Trang Yêu Cầu'
    }
  }

  const featureName = getFeatureName(location.pathname)

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.assign('/')
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-6 shadow-sm">
        <Clock className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
        <span>{featureName}</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
        Nội dung đang được cập nhật
      </h1>

      <p className="text-base sm:text-lg text-slate-600 max-w-lg mb-8 leading-relaxed">
        Khu vực này hiện đang được hoàn thiện và sẽ sớm phục vụ bạn với đầy đủ tính năng tra cứu, cấu hình và đặt hàng linh kiện.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3.5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white font-semibold text-sm hover:bg-red-700 shadow-md shadow-red-600/20 transition-all transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <Home className="w-4 h-4" />
          <span>Về Trang Chủ</span>
        </Link>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-slate-700 border border-slate-300 font-semibold text-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay Lại Trang Trước</span>
        </button>
      </div>
    </div>
  )
}
