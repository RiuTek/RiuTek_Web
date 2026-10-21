import React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Home } from 'lucide-react'

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600 mb-6 shadow-sm">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div className="text-sm font-extrabold text-red-600 uppercase tracking-widest mb-2 font-mono">
        404 — Not Found
      </div>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
        Không Tìm Thấy Trang Yêu Cầu
      </h1>

      <p className="text-base text-slate-600 max-w-md mb-8 leading-relaxed">
        Đường dẫn bạn đang truy cập không tồn tại hoặc đã được thay đổi trong phiên bản RiuTek Storefront hiện tại.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white font-semibold text-sm hover:bg-red-600 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Home className="w-4 h-4" />
        <span>Quay Lại Trang Chủ</span>
      </Link>
    </div>
  )
}
