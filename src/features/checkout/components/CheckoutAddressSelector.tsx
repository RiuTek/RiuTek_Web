import React from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin,
  Phone,
  User,
  Star,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import type { UserAddressDto } from '../../addresses/addressTypes'

interface CheckoutAddressSelectorProps {
  addresses: UserAddressDto[]
  selectedAddressId: string | null
  onSelectAddress: (id: string) => void
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

export const CheckoutAddressSelector: React.FC<CheckoutAddressSelectorProps> = ({
  addresses,
  selectedAddressId,
  onSelectAddress,
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-600" />
          <span>Địa Chỉ Giao Hàng</span>
        </h3>
        <Link
          to="/account"
          className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Quản lý sổ địa chỉ</span>
        </Link>
      </div>

      {/* Loading State */}
      {isLoading && addresses.length === 0 && (
        <div
          aria-busy="true"
          className="py-6 flex items-center justify-center gap-2 text-slate-500 text-xs sm:text-sm"
        >
          <Loader2 className="w-4 h-4 animate-spin text-red-600" />
          <span>Đang tải danh sách địa chỉ nhận hàng...</span>
        </div>
      )}

      {/* Error State */}
      {error && addresses.length === 0 && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 self-end sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && addresses.length === 0 && (
        <div className="p-6 text-center space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <p className="text-xs sm:text-sm text-slate-600">
            Bạn chưa có địa chỉ giao hàng nào trong tài khoản.
          </p>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Địa Chỉ Giao Hàng</span>
          </Link>
        </div>
      )}

      {/* Address List */}
      {addresses.length > 0 && (
        <div className="space-y-3">
          {addresses.map((address) => {
            const isSelected = address.id === selectedAddressId
            const fullAddress = [
              address.addressLine,
              address.ward,
              address.district,
              address.city,
            ]
              .filter(Boolean)
              .join(', ')

            return (
              <label
                key={address.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-red-500 bg-red-50/30 ring-1 ring-red-500'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="checkout-address"
                  checked={isSelected}
                  onChange={() => onSelectAddress(address.id)}
                  className="mt-1 text-red-600 focus:ring-red-500"
                />

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{address.receiverName}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-600 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{address.phoneNumber}</span>
                    </span>
                    {address.isDefault && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                        <Star className="w-2.5 h-2.5 fill-red-500 text-red-500" />
                        Mặc định
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed break-words">
                    {fullAddress}
                  </p>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
