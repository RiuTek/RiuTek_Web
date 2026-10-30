import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Save,
  X,
  Package,
  Bookmark,
  ChevronRight,
} from 'lucide-react'
import { ApiError } from '../lib/api'
import { useAuth } from '../features/auth/AuthContext'
import { USER_ROLE_LABELS, UserRole, type AuthUser, type UpdateProfileRequest } from '../features/auth/authTypes'
import { AddressBook } from '../features/addresses/components/AddressBook'


function formatCreatedAt(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

interface ProfileFormProps {
  user: AuthUser
  updateProfile: (request: UpdateProfileRequest) => Promise<void>
}

const ProfileForm: React.FC<ProfileFormProps> = ({ user, updateProfile }) => {
  // Baseline theo dữ liệu ban đầu từ user context
  const [baseline, setBaseline] = useState(() => ({
    fullName: user.fullName ?? '',
    phoneNumber: user.phoneNumber ?? '',
  }))

  const [fullName, setFullName] = useState(baseline.fullName)
  const [phoneNumber, setPhoneNumber] = useState(baseline.phoneNumber)

  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form dirty khi giá trị hiện tại khác baseline
  const isDirty =
    fullName !== baseline.fullName || phoneNumber !== baseline.phoneNumber

  // Đồng bộ khi user từ AuthContext thay đổi từ bên ngoài (ví dụ refresh session):
  // Nếu form chưa dirty thì đồng bộ giá trị và cập nhật baseline
  // Nếu người dùng đang chỉnh sửa (isDirty === true), giữ nguyên dữ liệu đang nhập
  const [prevUser, setPrevUser] = useState(user)
  if (user !== prevUser) {
    setPrevUser(user)
    const serverName = user.fullName ?? ''
    const serverPhone = user.phoneNumber ?? ''
    if (serverName !== baseline.fullName || serverPhone !== baseline.phoneNumber) {
      if (!isDirty) {
        setFullName(serverName)
        setPhoneNumber(serverPhone)
        setBaseline({ fullName: serverName, phoneNumber: serverPhone })
      }
    }
  }

  const roleLabel = USER_ROLE_LABELS[user.role] ?? 'Không xác định'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setApiError(null)
    setSuccessMessage(null)

    const cleanName = fullName.trim()
    const cleanPhone = phoneNumber.trim()
    let hasValidationError = false

    if (!cleanName) {
      setNameError('Vui lòng nhập họ và tên.')
      hasValidationError = true
    } else if (cleanName.length > 150) {
      setNameError('Họ và tên không được vượt quá 150 ký tự.')
      hasValidationError = true
    } else {
      setNameError(null)
    }

    if (cleanPhone && cleanPhone.length > 20) {
      setPhoneError('Số điện thoại không được vượt quá 20 ký tự.')
      hasValidationError = true
    } else {
      setPhoneError(null)
    }

    if (hasValidationError) {
      return
    }

    setIsSubmitting(true)

    try {
      const payloadPhone = cleanPhone.length > 0 ? cleanPhone : null
      await updateProfile({
        fullName: cleanName,
        phoneNumber: payloadPhone,
      })
      // Cập nhật giá trị trường và baseline theo dữ liệu sạch vừa lưu -> form trở về clean
      setFullName(cleanName)
      setPhoneNumber(cleanPhone)
      setBaseline({
        fullName: cleanName,
        phoneNumber: cleanPhone,
      })
      setSuccessMessage('Cập nhật thông tin tài khoản thành công!')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.description) {
          setApiError(err.description)
        } else if (err.message) {
          setApiError(err.message)
        } else {
          setApiError('Không thể cập nhật thông tin. Vui lòng thử lại sau.')
        }
      } else {
        setApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-base sm:text-lg font-bold text-slate-950">Thông Tin Hồ Sơ</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Cập nhật họ tên và số điện thoại liên hệ của bạn.
        </p>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {apiError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Full Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="account-fullname"
              className="block text-xs font-bold text-slate-800 uppercase tracking-wider"
            >
              Họ và Tên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="account-fullname"
                type="text"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  if (nameError) setNameError(null)
                  if (successMessage) setSuccessMessage(null)
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  nameError
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                    : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                }`}
                aria-invalid={nameError ? 'true' : 'false'}
                aria-describedby={nameError ? 'account-fullname-error' : undefined}
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            {nameError && (
              <p id="account-fullname-error" className="text-[11px] text-rose-600 font-medium">
                {nameError}
              </p>
            )}
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-1.5">
            <label
              htmlFor="account-email"
              className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between"
            >
              <span>Địa Chỉ Email</span>
              <span className="text-[10px] text-slate-400 font-normal">Chỉ đọc</span>
            </label>
            <div className="relative">
              <input
                id="account-email"
                type="email"
                name="email"
                value={user.email}
                disabled
                readOnly
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-slate-100/70 cursor-not-allowed select-none"
                aria-readonly="true"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[10px] text-slate-400">
              Email dùng để đăng nhập và không thể thay đổi trực tiếp.
            </p>
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label
              htmlFor="account-phone"
              className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between"
            >
              <span>Số Điện Thoại</span>
              <span className="text-[10px] text-slate-400 font-normal">Tùy chọn</span>
            </label>
            <div className="relative">
              <input
                id="account-phone"
                type="tel"
                name="phoneNumber"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value)
                  if (phoneError) setPhoneError(null)
                  if (successMessage) setSuccessMessage(null)
                }}
                placeholder="Ví dụ: 0901234567"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                  phoneError
                    ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                    : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-slate-50/40 focus:bg-white'
                }`}
                aria-invalid={phoneError ? 'true' : 'false'}
                aria-describedby={phoneError ? 'account-phone-error' : undefined}
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            {phoneError && (
              <p id="account-phone-error" className="text-[11px] text-rose-600 font-medium">
                {phoneError}
              </p>
            )}
          </div>

          {/* Role (Read-only) */}
          <div className="space-y-1.5">
            <label
              htmlFor="account-role"
              className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between"
            >
              <span>Vai Trò Hệ Thống</span>
              <span className="text-[10px] text-slate-400 font-normal">Hệ thống cấp</span>
            </label>
            <div className="relative">
              <input
                id="account-role"
                type="text"
                value={roleLabel}
                disabled
                readOnly
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-slate-100/70 cursor-not-allowed select-none font-medium"
                aria-readonly="true"
              />
              <Shield className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Lưu Thay Đổi</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export const AccountPage: React.FC = () => {
  const { user, updateProfile, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  if (!user) {
    return null
  }

  const roleLabel = USER_ROLE_LABELS[user.role] ?? 'Không xác định'

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    setLogoutError(null)
    try {
      await logout()
    } catch {
      setLogoutError('Không thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Tài Khoản Của Tôi
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Quản lý thông tin hồ sơ cá nhân và trạng thái phiên đăng nhập.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <LogOut className="w-4 h-4" />
          <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng Xuất'}</span>
        </button>
      </div>

      {/* Logout Error Alert */}
      {logoutError && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{logoutError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLogoutError(null)}
            className="p-1 hover:bg-rose-100 rounded-lg text-rose-700 transition-colors"
            aria-label="Đóng thông báo lỗi đăng xuất"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Profile Overview Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-extrabold text-2xl shadow-inner flex-shrink-0">
            {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{user.fullName}</h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-300 border border-red-800">
                <Shield className="w-3 h-3" />
                {roleLabel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{user.email}</span>
            </p>
            {user.createdAt && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Thành viên từ: {formatCreatedAt(user.createdAt)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Orders Entry Card */}
      <Link
        to="/orders"
        className="block bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 hover:border-red-200 hover:shadow-md transition-all group shadow-xs"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 group-hover:scale-105 transition-transform flex-shrink-0">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                Đơn Hàng Của Tôi
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Tra cứu trạng thái, xem lại chi tiết và quản lý tất cả đơn hàng đã đặt.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-red-600 group-hover:translate-x-1 transition-transform flex-shrink-0">
            <span className="hidden sm:inline">Xem đơn</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Link>

      {/* Quick PC Builds Entry Card (Customer Only) */}
      {user.role === UserRole.Customer && (
        <Link
          to="/pc-builds"
          className="block bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 hover:border-red-200 hover:shadow-md transition-all group shadow-xs"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 group-hover:scale-105 transition-transform flex-shrink-0">
                <Bookmark className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                  Cấu Hình Của Tôi
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Xem lại các cấu hình PC bạn đã lưu, kiểm tra tương thích và thêm nhanh vào giỏ hàng.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-red-600 group-hover:translate-x-1 transition-transform flex-shrink-0">
              <span className="hidden sm:inline">Xem cấu hình</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </Link>
      )}

      {/* Edit Profile Form */}
      <ProfileForm user={user} updateProfile={updateProfile} />

      {/* Shipping Address Book */}
      <AddressBook />
    </div>
  )
}
