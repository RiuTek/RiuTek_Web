import React, { useState } from 'react'
import {
  MapPin,
  Phone,
  User,
  Star,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import type { UserAddressDto } from '../addressTypes'

interface AddressCardProps {
  address: UserAddressDto
  isMutating: boolean
  onEdit: (address: UserAddressDto) => void
  onSetDefault: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  isMutating,
  onEdit,
  onSetDefault,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSettingDefault, setIsSettingDefault] = useState(false)

  const handleSetDefault = async () => {
    if (isMutating || isSettingDefault) return
    setIsSettingDefault(true)
    try {
      await onSetDefault(address.id)
    } finally {
      setIsSettingDefault(false)
    }
  }

  const handleDelete = async () => {
    if (isMutating || isDeleting) return
    setIsDeleting(true)
    try {
      await onDelete(address.id)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const fullAddress = [
    address.addressLine,
    address.ward,
    address.district,
    address.city,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        address.isDefault
          ? 'border-red-300 bg-red-50/20 shadow-xs'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Address Info */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>{address.receiverName}</span>
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-xs sm:text-sm text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>{address.phoneNumber}</span>
            </span>
            {address.isDefault && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                <Star className="w-3 h-3 fill-red-500 text-red-500" />
                Mặc định
              </span>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed break-words">{fullAddress}</span>
          </div>
        </div>

        {/* Action Buttons */}
        {!showDeleteConfirm && (
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0 pt-2 sm:pt-0">
            {!address.isDefault && (
              <button
                type="button"
                onClick={handleSetDefault}
                disabled={isMutating || isSettingDefault}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                title="Đặt làm địa chỉ mặc định"
              >
                {isSettingDefault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Star className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Thiết lập mặc định</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(address)}
              disabled={isMutating}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              title="Chỉnh sửa địa chỉ"
              aria-label="Chỉnh sửa địa chỉ"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isMutating}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
              title="Xóa địa chỉ"
              aria-label="Xóa địa chỉ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Inline Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mt-4 pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/50 -mx-5 -mb-5 p-4 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>Bạn có chắc chắn muốn xóa địa chỉ này?</span>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isMutating}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xóa...</span>
                </>
              ) : (
                <span>Xác nhận xóa</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
