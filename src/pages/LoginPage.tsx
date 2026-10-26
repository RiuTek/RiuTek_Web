import React, { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'

function getSafeReturnUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  const trimmed = raw.trim()
  // Chỉ chấp nhận đường dẫn bắt đầu bằng một '/' và không bắt đầu bằng '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/'
  }
  return trimmed
}

export const LoginPage: React.FC = () => {
  const { isAuthenticated, status, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const returnUrl = getSafeReturnUrl(
    (location.state as { from?: string } | null)?.from
  )

  // Nếu đã đăng nhập thành công, chuyển hướng về returnUrl
  if (isAuthenticated) {
    return <Navigate to={returnUrl} replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setApiError(null)

    const cleanEmail = email.trim()
    let hasValidationError = false

    if (!cleanEmail) {
      setEmailError('Vui lòng nhập địa chỉ email.')
      hasValidationError = true
    } else if (cleanEmail.length > 255) {
      setEmailError('Email không được vượt quá 255 ký tự.')
      hasValidationError = true
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Địa chỉ email không đúng định dạng.')
      hasValidationError = true
    } else {
      setEmailError(null)
    }

    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu.')
      hasValidationError = true
    } else {
      setPasswordError(null)
    }

    if (hasValidationError) {
      return
    }

    setIsSubmitting(true)

    try {
      await login(cleanEmail, password)
      navigate(returnUrl, { replace: true })
    } catch (err) {
      setIsSubmitting(false)
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setApiError('Email hoặc mật khẩu không chính xác.')
        } else if (err.status === 403) {
          setApiError(
            'Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ quản trị viên.'
          )
        } else if (err.description) {
          setApiError(err.description)
        } else if (err.message) {
          setApiError(err.message)
        } else {
          setApiError('Đăng nhập không thành công. Vui lòng thử lại.')
        }
      } else {
        setApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối mạng và thử lại.')
      }
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Top Header Card */}
        <div className="text-center space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 group mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-full px-1"
            aria-label="Trang chủ RiuTek"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
              R
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-950 uppercase">
              RIUTEK
            </span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Đăng Nhập Tài Khoản
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Đăng nhập để quản lý giỏ hàng, cấu hình PC và đơn hàng của bạn.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          {/* API Error Alert */}
          {apiError && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-bold text-slate-900 uppercase tracking-wider"
              >
                Địa chỉ Email
              </label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  disabled={isSubmitting || status === 'checking'}
                  placeholder="name@example.com"
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-colors disabled:opacity-60 ${
                    emailError
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200 focus:ring-red-500'
                  }`}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={emailError ? 'login-email-error' : undefined}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {emailError && (
                <p id="login-email-error" className="text-[11px] text-rose-600 font-medium">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-slate-900 uppercase tracking-wider"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError(null)
                  }}
                  disabled={isSubmitting || status === 'checking'}
                  placeholder="••••••••"
                  className={`w-full bg-slate-50 border rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-colors disabled:opacity-60 ${
                    passwordError
                      ? 'border-rose-300 focus:ring-rose-500'
                      : 'border-slate-200 focus:ring-red-500'
                  }`}
                  aria-invalid={Boolean(passwordError)}
                  aria-describedby={passwordError ? 'login-password-error' : undefined}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {passwordError && (
                <p id="login-password-error" className="text-[11px] text-rose-600 font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || status === 'checking'}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </>
              ) : (
                <span>Đăng Nhập</span>
              )}
            </button>
          </form>

          {/* Safe Navigation Back */}
          <div className="pt-2 text-center border-t border-slate-100">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại trang chủ</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
