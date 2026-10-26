import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Lock,
  Mail,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { BrandLogo } from '../components/branding/BrandLogo'

interface PasswordCriteria {
  minLength: boolean
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSpecial: boolean
}

function evaluatePassword(pwd: string): PasswordCriteria {
  return {
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasLower: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  }
}

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, status, register } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [fullNameError, setFullNameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect nếu đã đăng nhập
  if (isAuthenticated) {
    return <Navigate to="/account" replace />
  }

  const pwdCriteria = evaluatePassword(password)
  const isPwdValid =
    pwdCriteria.minLength &&
    pwdCriteria.hasUpper &&
    pwdCriteria.hasLower &&
    pwdCriteria.hasNumber &&
    pwdCriteria.hasSpecial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setApiError(null)

    const cleanName = fullName.trim()
    const cleanEmail = email.trim()
    const cleanPhone = phoneNumber.trim()
    let hasValidationError = false

    // 1. Full name validation
    if (!cleanName) {
      setFullNameError('Vui lòng nhập họ và tên.')
      hasValidationError = true
    } else if (cleanName.length > 150) {
      setFullNameError('Họ và tên không được vượt quá 150 ký tự.')
      hasValidationError = true
    } else {
      setFullNameError(null)
    }

    // 2. Email validation
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

    // 3. Phone validation (optional)
    if (cleanPhone && cleanPhone.length > 20) {
      setPhoneError('Số điện thoại không được vượt quá 20 ký tự.')
      hasValidationError = true
    } else {
      setPhoneError(null)
    }

    // 4. Password validation (5 conditions)
    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu.')
      hasValidationError = true
    } else if (!isPwdValid) {
      setPasswordError('Mật khẩu chưa đáp ứng đủ các điều kiện bảo mật bên dưới.')
      hasValidationError = true
    } else {
      setPasswordError(null)
    }

    // 5. Confirm password validation
    if (!confirmPassword) {
      setConfirmError('Vui lòng xác nhận lại mật khẩu.')
      hasValidationError = true
    } else if (confirmPassword !== password) {
      setConfirmError('Mật khẩu xác nhận không khớp.')
      hasValidationError = true
    } else {
      setConfirmError(null)
    }

    if (hasValidationError) {
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        fullName: cleanName,
        email: cleanEmail,
        password,
        phoneNumber: cleanPhone.length > 0 ? cleanPhone : null,
      })
      navigate('/account', { replace: true })
    } catch (err) {
      setIsSubmitting(false)
      if (err instanceof ApiError) {
        if (err.status === 409 || err.code === 'Auth.EmailExists') {
          setApiError('Email này đã được sử dụng. Vui lòng sử dụng email khác hoặc đăng nhập.')
        } else if (err.status === 400) {
          if (err.description) {
            setApiError(err.description)
          } else if (err.message) {
            setApiError(err.message)
          } else {
            setApiError('Dữ liệu đăng ký không hợp lệ. Vui lòng kiểm tra lại thông tin.')
          }
        } else if (err.description) {
          setApiError(err.description)
        } else if (err.message) {
          setApiError(err.message)
        } else {
          setApiError('Đăng ký không thành công. Vui lòng thử lại sau.')
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
            className="inline-flex items-center gap-2 group mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-xl px-1"
            aria-label="Trang chủ RiuTek"
          >
            <BrandLogo
              markClassName="h-10 sm:h-12 w-auto group-hover:scale-105 transition-transform"
              textClassName="text-2xl sm:text-3xl"
              theme="light"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Tạo Tài Khoản RiuTek
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Trở thành thành viên để lưu cấu hình PC, theo dõi đơn hàng và nhận ưu đãi độc quyền.
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
            {/* Full Name Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-fullname"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
              >
                Họ và Tên <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-fullname"
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    if (fullNameError) setFullNameError(null)
                  }}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    fullNameError
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                  }`}
                  aria-invalid={fullNameError ? 'true' : 'false'}
                  aria-describedby={fullNameError ? 'register-fullname-error' : undefined}
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {fullNameError && (
                <p id="register-fullname-error" className="text-[11px] text-rose-600 font-medium">
                  {fullNameError}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-email"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
              >
                Địa chỉ Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError(null)
                  }}
                  placeholder="name@example.com"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    emailError
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                  }`}
                  aria-invalid={emailError ? 'true' : 'false'}
                  aria-describedby={emailError ? 'register-email-error' : undefined}
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {emailError && (
                <p id="register-email-error" className="text-[11px] text-rose-600 font-medium">
                  {emailError}
                </p>
              )}
            </div>

            {/* Phone Number Field (Optional) */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-phone"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between"
              >
                <span>Số Điện Thoại</span>
                <span className="text-[10px] text-slate-400 font-normal">Tùy chọn</span>
              </label>
              <div className="relative">
                <input
                  id="register-phone"
                  type="tel"
                  name="phoneNumber"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value)
                    if (phoneError) setPhoneError(null)
                  }}
                  placeholder="Ví dụ: 0901234567"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    phoneError
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                  }`}
                  aria-invalid={phoneError ? 'true' : 'false'}
                  aria-describedby={phoneError ? 'register-phone-error' : undefined}
                />
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {phoneError && (
                <p id="register-phone-error" className="text-[11px] text-rose-600 font-medium">
                  {phoneError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-password"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
              >
                Mật Khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError(null)
                  }}
                  placeholder="Tối thiểu 8 ký tự, bao gồm hoa, thường, số & ký tự đặc biệt"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    passwordError
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                  }`}
                  aria-invalid={passwordError ? 'true' : 'false'}
                  aria-describedby="register-password-requirements"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Password Requirements Checklist */}
              <div
                id="register-password-requirements"
                className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-[11px]"
              >
                <p className="font-semibold text-slate-700">Yêu cầu mật khẩu:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className={`flex items-center gap-1.5 ${pwdCriteria.minLength ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {pwdCriteria.minLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span>Ít nhất 8 ký tự</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdCriteria.hasUpper ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {pwdCriteria.hasUpper ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span>1 chữ cái in hoa (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdCriteria.hasLower ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {pwdCriteria.hasLower ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span>1 chữ cái thường (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwdCriteria.hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {pwdCriteria.hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span>1 chữ số (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 sm:col-span-2 ${pwdCriteria.hasSpecial ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {pwdCriteria.hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                    <span>1 ký tự đặc biệt (!@#$%^&amp;*...)</span>
                  </div>
                </div>
              </div>

              {passwordError && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="register-confirmpassword"
                className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
              >
                Xác Nhận Mật Khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="register-confirmpassword"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (confirmError) setConfirmError(null)
                  }}
                  placeholder="Nhập lại mật khẩu"
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                    confirmError
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                      : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                  }`}
                  aria-invalid={confirmError ? 'true' : 'false'}
                  aria-describedby={confirmError ? 'register-confirmpassword-error' : undefined}
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              {confirmError && (
                <p id="register-confirmpassword-error" className="text-[11px] text-rose-600 font-medium">
                  {confirmError}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || status === 'checking'}
              className="w-full py-3 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng ký tài khoản...</span>
                </>
              ) : (
                <span>Đăng Ký Tài Khoản</span>
              )}
            </button>
          </form>

          {/* Nav Links */}
          <div className="pt-2 text-center border-t border-slate-100 space-y-2">
            <p className="text-xs text-slate-600">
              Đã có tài khoản?{' '}
              <Link
                to="/login"
                className="font-bold text-red-600 hover:text-red-700 hover:underline"
              >
                Đăng nhập ngay
              </Link>
            </p>
            <div>
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
    </div>
  )
}
