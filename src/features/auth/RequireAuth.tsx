import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { useAuth } from './AuthContext'

interface RequireAuthProps {
  children: React.ReactNode
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { status, isAuthenticated, retryBootstrap } = useAuth()
  const location = useLocation()

  if (status === 'checking') {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Đang kiểm tra trạng thái phiên...</p>
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Không thể xác thực phiên đăng nhập
        </h2>
        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          Không thể kết nối đến máy chủ để xác thực phiên làm việc. Vui lòng kiểm tra kết nối mạng và thử lại.
        </p>
        <button
          type="button"
          onClick={retryBootstrap}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Thử lại</span>
        </button>
      </div>
    )
  }

  if (!isAuthenticated) {
    const returnPath = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from: returnPath }} />
  }

  return <>{children}</>
}
