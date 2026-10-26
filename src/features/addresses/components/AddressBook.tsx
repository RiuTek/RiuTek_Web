import React, { useState } from 'react'
import {
  Plus,
  MapPin,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { useAddresses } from '../AddressContext'
import type {
  AddAddressRequest,
  UpdateAddressRequest,
  UserAddressDto,
} from '../addressTypes'
import { AddressCard } from './AddressCard'
import { AddressForm } from './AddressForm'

export const AddressBook: React.FC = () => {
  const { user } = useAuth()
  const {
    addresses,
    status,
    error: contextError,
    isMutating,
    loadAddresses,
    addAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,
    clearError,
  } = useAddresses()

  const [formMode, setFormMode] = useState<'idle' | 'add' | 'edit'>('idle')
  const [editingAddress, setEditingAddress] = useState<UserAddressDto | null>(null)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)

  const handleOpenAdd = () => {
    setFormError(null)
    setActionSuccessMessage(null)
    setActionErrorMessage(null)
    clearError()
    setEditingAddress(null)
    setFormMode('add')
  }

  const handleOpenEdit = (address: UserAddressDto) => {
    setFormError(null)
    setActionSuccessMessage(null)
    setActionErrorMessage(null)
    clearError()
    setEditingAddress(address)
    setFormMode('edit')
  }

  const handleCloseForm = () => {
    setFormMode('idle')
    setEditingAddress(null)
    setFormError(null)
  }

  const handleFormSubmit = async (
    data: AddAddressRequest | UpdateAddressRequest
  ) => {
    setIsSubmittingForm(true)
    setFormError(null)
    setActionSuccessMessage(null)
    setActionErrorMessage(null)

    try {
      if (formMode === 'add') {
        await addAddress(data as AddAddressRequest)
        setActionSuccessMessage('Thêm địa chỉ giao hàng mới thành công.')
      } else if (formMode === 'edit' && editingAddress) {
        await updateAddress(editingAddress.id, data as UpdateAddressRequest)
        setActionSuccessMessage('Cập nhật địa chỉ giao hàng thành công.')
      }
      handleCloseForm()
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể lưu địa chỉ. Vui lòng thử lại.'
      setFormError(msg)
    } finally {
      setIsSubmittingForm(false)
    }
  }

  const handleSetDefault = async (addressId: string) => {
    setActionSuccessMessage(null)
    setActionErrorMessage(null)
    clearError()
    try {
      await setDefaultAddress(addressId)
      setActionSuccessMessage('Đã thiết lập địa chỉ mặc định thành công.')
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể thiết lập địa chỉ mặc định. Vui lòng thử lại.'
      setActionErrorMessage(msg)
    }
  }

  const handleDelete = async (addressId: string) => {
    setActionSuccessMessage(null)
    setActionErrorMessage(null)
    clearError()
    try {
      await deleteAddress(addressId)
      setActionSuccessMessage('Đã xóa địa chỉ giao hàng thành công.')
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể xóa địa chỉ. Vui lòng thử lại.'
      setActionErrorMessage(msg)
    }
  }

  const handleRetryLoad = () => {
    setActionErrorMessage(null)
    loadAddresses().catch(() => {
      // Error is caught and surfaced in context status/error
    })
  }

  const defaultPrefill = {
    receiverName: user?.fullName ?? '',
    phoneNumber: user?.phoneNumber ?? '',
  }

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-red-600" />
            <span>Sổ Địa Chỉ Giao Hàng</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản lý danh sách địa chỉ nhận hàng để tiện lợi khi thanh toán.
          </p>
        </div>

        {formMode === 'idle' && (
          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={status === 'loading' || isMutating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50 self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Địa Chỉ Mới</span>
          </button>
        )}
      </div>

      {/* Success Notification */}
      {actionSuccessMessage && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Action / Context Error Alert */}
      {(actionErrorMessage || (status === 'error' && addresses.length > 0 && contextError)) && (
        <div
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-2xl flex items-center gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span className="font-medium">
            {actionErrorMessage || contextError}
          </span>
        </div>
      )}

      {/* Add / Edit Form */}
      {formMode !== 'idle' && (
        <AddressForm
          mode={formMode}
          initialData={editingAddress}
          defaultPrefill={defaultPrefill}
          onSubmit={handleFormSubmit}
          onCancel={handleCloseForm}
          isSubmitting={isSubmittingForm}
          formError={formError}
        />
      )}

      {/* Initial Loading Skeleton */}
      {status === 'loading' && addresses.length === 0 && (
        <div
          aria-busy="true"
          aria-label="Đang tải danh sách địa chỉ..."
          className="space-y-4 py-6"
        >
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs sm:text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-red-600" />
            <span>Đang tải danh sách địa chỉ giao hàng...</span>
          </div>
          <div className="h-20 bg-slate-100/70 rounded-2xl animate-pulse" />
          <div className="h-20 bg-slate-100/70 rounded-2xl animate-pulse" />
        </div>
      )}

      {/* Initial Error State with Retry Button */}
      {status === 'error' && addresses.length === 0 && (
        <div
          role="alert"
          className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-4"
        >
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-bold text-rose-900 text-sm sm:text-base">
              Không thể tải danh sách địa chỉ
            </h4>
            <p className="text-xs sm:text-sm text-rose-700 max-w-md mx-auto">
              {contextError || 'Đã có lỗi xảy ra khi tải dữ liệu từ máy chủ. Vui lòng thử lại.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetryLoad}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {status === 'ready' && addresses.length === 0 && formMode === 'idle' && (
        <div className="py-10 text-center space-y-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-bold text-slate-900">
              Chưa có địa chỉ giao hàng nào
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Thêm địa chỉ giao hàng để thuận tiện và nhanh chóng hơn khi đặt hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Địa Chỉ Ngay</span>
          </button>
        </div>
      )}

      {/* Address Cards List */}
      {addresses.length > 0 && (
        <div className="space-y-3">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              isMutating={isMutating}
              onEdit={handleOpenEdit}
              onSetDefault={handleSetDefault}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}
