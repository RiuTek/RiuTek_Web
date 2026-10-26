import React, { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type {
  AddAddressRequest,
  UpdateAddressRequest,
  UserAddressDto,
} from '../addressTypes'

interface AddressFormProps {
  mode: 'add' | 'edit'
  initialData?: UserAddressDto | null
  defaultPrefill?: {
    receiverName?: string
    phoneNumber?: string
  }
  onSubmit: (data: AddAddressRequest | UpdateAddressRequest) => Promise<void>
  onCancel: () => void
  isSubmitting: boolean
  formError?: string | null
}

interface FormFields {
  receiverName: string
  phoneNumber: string
  addressLine: string
  ward: string
  district: string
  city: string
  isDefault: boolean
}

interface FormErrors {
  receiverName?: string
  phoneNumber?: string
  addressLine?: string
  ward?: string
  district?: string
  city?: string
}

export const AddressForm: React.FC<AddressFormProps> = ({
  mode,
  initialData,
  defaultPrefill,
  onSubmit,
  onCancel,
  isSubmitting,
  formError,
}) => {
  const [fields, setFields] = useState<FormFields>(() => {
    if (mode === 'edit' && initialData) {
      return {
        receiverName: initialData.receiverName ?? '',
        phoneNumber: initialData.phoneNumber ?? '',
        addressLine: initialData.addressLine ?? '',
        ward: initialData.ward ?? '',
        district: initialData.district ?? '',
        city: initialData.city ?? '',
        isDefault: initialData.isDefault ?? false,
      }
    }
    return {
      receiverName: defaultPrefill?.receiverName ?? '',
      phoneNumber: defaultPrefill?.phoneNumber ?? '',
      addressLine: '',
      ward: '',
      district: '',
      city: '',
      isDefault: false,
    }
  })

  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange = (
    field: keyof FormFields,
    value: string | boolean
  ) => {
    setFields((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const nextErrors: FormErrors = {}
    const cleanName = fields.receiverName.trim()
    const cleanPhone = fields.phoneNumber.trim()
    const cleanAddress = fields.addressLine.trim()
    const cleanWard = fields.ward.trim()
    const cleanDistrict = fields.district.trim()
    const cleanCity = fields.city.trim()

    if (!cleanName) {
      nextErrors.receiverName = 'Vui lòng nhập họ và tên người nhận.'
    } else if (cleanName.length > 150) {
      nextErrors.receiverName = 'Họ và tên không được vượt quá 150 ký tự.'
    }

    if (!cleanPhone) {
      nextErrors.phoneNumber = 'Vui lòng nhập số điện thoại.'
    } else if (cleanPhone.length > 20) {
      nextErrors.phoneNumber = 'Số điện thoại không được vượt quá 20 ký tự.'
    }

    if (!cleanAddress) {
      nextErrors.addressLine = 'Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường).'
    } else if (cleanAddress.length > 300) {
      nextErrors.addressLine = 'Địa chỉ chi tiết không được vượt quá 300 ký tự.'
    }

    if (!cleanWard) {
      nextErrors.ward = 'Vui lòng nhập phường/xã.'
    } else if (cleanWard.length > 100) {
      nextErrors.ward = 'Phường/Xã không được vượt quá 100 ký tự.'
    }

    if (!cleanDistrict) {
      nextErrors.district = 'Vui lòng nhập quận/huyện.'
    } else if (cleanDistrict.length > 100) {
      nextErrors.district = 'Quận/Huyện không được vượt quá 100 ký tự.'
    }

    if (!cleanCity) {
      nextErrors.city = 'Vui lòng nhập tỉnh/thành phố.'
    } else if (cleanCity.length > 100) {
      nextErrors.city = 'Tỉnh/Thành phố không được vượt quá 100 ký tự.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!validate()) {
      return
    }

    const trimmed = {
      receiverName: fields.receiverName.trim(),
      phoneNumber: fields.phoneNumber.trim(),
      addressLine: fields.addressLine.trim(),
      ward: fields.ward.trim(),
      district: fields.district.trim(),
      city: fields.city.trim(),
    }

    if (mode === 'add') {
      const payload: AddAddressRequest = {
        ...trimmed,
        isDefault: fields.isDefault,
      }
      await onSubmit(payload)
    } else {
      // Update TUYỆT ĐỐI không gửi isDefault
      const payload: UpdateAddressRequest = {
        ...trimmed,
      }
      await onSubmit(payload)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5"
      noValidate
    >
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h4 className="text-sm sm:text-base font-bold text-slate-900">
          {mode === 'add' ? 'Thêm Địa Chỉ Giao Hàng Mới' : 'Cập Nhật Địa Chỉ Giao Hàng'}
        </h4>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          aria-label="Đóng biểu mẫu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {formError && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl font-medium"
        >
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Receiver Name */}
        <div className="space-y-1.5">
          <label
            htmlFor="address-receiver-name"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Họ và tên người nhận <span className="text-red-500">*</span>
          </label>
          <input
            id="address-receiver-name"
            type="text"
            value={fields.receiverName}
            maxLength={150}
            onChange={(e) => handleChange('receiverName', e.target.value)}
            placeholder="Ví dụ: Nguyễn Văn A"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.receiverName
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.receiverName ? 'true' : 'false'}
            aria-describedby={errors.receiverName ? 'address-receiver-name-error' : undefined}
          />
          {errors.receiverName && (
            <p id="address-receiver-name-error" className="text-[11px] text-rose-600 font-medium">
              {errors.receiverName}
            </p>
          )}
        </div>

        {/* Phone Number */}
        <div className="space-y-1.5">
          <label
            htmlFor="address-phone"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Số điện thoại <span className="text-red-500">*</span>
          </label>
          <input
            id="address-phone"
            type="tel"
            value={fields.phoneNumber}
            maxLength={20}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
            placeholder="Ví dụ: 0901234567"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.phoneNumber
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.phoneNumber ? 'true' : 'false'}
            aria-describedby={errors.phoneNumber ? 'address-phone-error' : undefined}
          />
          {errors.phoneNumber && (
            <p id="address-phone-error" className="text-[11px] text-rose-600 font-medium">
              {errors.phoneNumber}
            </p>
          )}
        </div>

        {/* Address Line (Full width) */}
        <div className="sm:col-span-2 space-y-1.5">
          <label
            htmlFor="address-line"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Địa chỉ chi tiết (Số nhà, tên đường, tòa nhà) <span className="text-red-500">*</span>
          </label>
          <input
            id="address-line"
            type="text"
            value={fields.addressLine}
            maxLength={300}
            onChange={(e) => handleChange('addressLine', e.target.value)}
            placeholder="Ví dụ: 123 Đường Lê Lợi, Chung cư ABC"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.addressLine
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.addressLine ? 'true' : 'false'}
            aria-describedby={errors.addressLine ? 'address-line-error' : undefined}
          />
          {errors.addressLine && (
            <p id="address-line-error" className="text-[11px] text-rose-600 font-medium">
              {errors.addressLine}
            </p>
          )}
        </div>

        {/* Ward */}
        <div className="space-y-1.5">
          <label
            htmlFor="address-ward"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Phường / Xã <span className="text-red-500">*</span>
          </label>
          <input
            id="address-ward"
            type="text"
            value={fields.ward}
            maxLength={100}
            onChange={(e) => handleChange('ward', e.target.value)}
            placeholder="Ví dụ: Phường Bến Nghé"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.ward
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.ward ? 'true' : 'false'}
            aria-describedby={errors.ward ? 'address-ward-error' : undefined}
          />
          {errors.ward && (
            <p id="address-ward-error" className="text-[11px] text-rose-600 font-medium">
              {errors.ward}
            </p>
          )}
        </div>

        {/* District */}
        <div className="space-y-1.5">
          <label
            htmlFor="address-district"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Quận / Huyện <span className="text-red-500">*</span>
          </label>
          <input
            id="address-district"
            type="text"
            value={fields.district}
            maxLength={100}
            onChange={(e) => handleChange('district', e.target.value)}
            placeholder="Ví dụ: Quận 1"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.district
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.district ? 'true' : 'false'}
            aria-describedby={errors.district ? 'address-district-error' : undefined}
          />
          {errors.district && (
            <p id="address-district-error" className="text-[11px] text-rose-600 font-medium">
              {errors.district}
            </p>
          )}
        </div>

        {/* City (Full width or in grid) */}
        <div className="sm:col-span-2 space-y-1.5">
          <label
            htmlFor="address-city"
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            Tỉnh / Thành phố <span className="text-red-500">*</span>
          </label>
          <input
            id="address-city"
            type="text"
            value={fields.city}
            maxLength={100}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="Ví dụ: TP. Hồ Chí Minh"
            className={`w-full px-3.5 py-2 rounded-xl border text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
              errors.city
                ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20'
                : 'border-slate-200 focus:border-red-500 focus:ring-red-100 bg-white'
            }`}
            aria-invalid={errors.city ? 'true' : 'false'}
            aria-describedby={errors.city ? 'address-city-error' : undefined}
          />
          {errors.city && (
            <p id="address-city-error" className="text-[11px] text-rose-600 font-medium">
              {errors.city}
            </p>
          )}
        </div>

        {/* Checkbox "Đặt làm địa chỉ mặc định" - CHỈ hiển thị ở chế độ Add */}
        {mode === 'add' && (
          <div className="sm:col-span-2 pt-1">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fields.isDefault}
                onChange={(e) => handleChange('isDefault', e.target.checked)}
                className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500"
              />
              <span className="text-xs sm:text-sm font-medium text-slate-700">
                Đặt làm địa chỉ mặc định
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors disabled:opacity-50"
        >
          Hủy bỏ
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors shadow-sm disabled:opacity-60 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Đang lưu...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>{mode === 'add' ? 'Lưu địa chỉ' : 'Cập nhật'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
