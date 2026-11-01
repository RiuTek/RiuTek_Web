import React, { useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Plus,
  Trash2,
} from 'lucide-react'
import { isValidHttpsUrl, moveGalleryImage } from '../adminProductHelper'

interface ProductMediaFieldsProps {
  imageUrl: string
  additionalImages: string[]
  disabled?: boolean
  imageUrlError?: string
  additionalImagesError?: string
  onImageUrlChange: (url: string) => void
  onAdditionalImagesChange: (urls: string[]) => void
}

export const ProductMediaFields: React.FC<ProductMediaFieldsProps> = ({
  imageUrl,
  additionalImages,
  disabled = false,
  imageUrlError,
  additionalImagesError,
  onImageUrlChange,
  onAdditionalImagesChange,
}) => {
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({})

  const markUrlBroken = (url: string, broken: boolean) => {
    const key = url.trim()
    if (!key) return
    setBrokenUrls((prev) => {
      if (Boolean(prev[key]) === broken) return prev
      return { ...prev, [key]: broken }
    })
  }

  const handleAddGalleryItem = () => {
    if (additionalImages.length >= 10) return
    onAdditionalImagesChange([...additionalImages, ''])
  }

  const handleGalleryItemChange = (index: number, value: string) => {
    const next = [...additionalImages]
    next[index] = value
    onAdditionalImagesChange(next)
  }

  const handleRemoveGalleryItem = (index: number) => {
    const next = additionalImages.filter((_, idx) => idx !== index)
    onAdditionalImagesChange(next)
  }

  const handleMoveGalleryItem = (index: number, direction: 'up' | 'down') => {
    onAdditionalImagesChange(moveGalleryImage(additionalImages, index, direction))
  }

  const trimmedPrimary = imageUrl.trim()
  const primaryCanPreview = isValidHttpsUrl(trimmedPrimary)
  const isPrimaryBroken = Boolean(brokenUrls[trimmedPrimary])

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-base font-bold text-slate-900">
          Hình Ảnh Sản Phẩm (HTTPS URL)
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Nhập đường dẫn ảnh trực tiếp chuẩn <code className="font-mono">https://</code> (tối đa
          1000 ký tự). Hỗ trợ 1 ảnh chính và tối đa 10 ảnh phụ.
        </p>
      </div>

      {/* Ảnh chính */}
      <div className="space-y-2">
        <label
          htmlFor="product-primary-image-url"
          className="block text-xs font-bold tracking-wider text-slate-700 uppercase"
        >
          URL Ảnh Chính <span className="text-rose-600">*</span>
        </label>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1 space-y-1.5">
            <input
              id="product-primary-image-url"
              type="url"
              value={imageUrl}
              disabled={disabled}
              onChange={(e) => onImageUrlChange(e.target.value)}
              placeholder="https://cdn.example.com/products/rtx-4070-primary.webp"
              maxLength={1000}
              className={`w-full rounded-lg border px-3.5 py-2.5 font-mono text-xs text-slate-900 transition outline-none ${
                imageUrlError
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {imageUrlError && (
              <p className="text-xs font-medium text-rose-600">{imageUrlError}</p>
            )}
            {primaryCanPreview && isPrimaryBroken && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Không thể tải bản xem trước của ảnh này. Vui lòng kiểm tra lại đường dẫn.
              </p>
            )}
          </div>

          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {primaryCanPreview && !isPrimaryBroken ? (
              <img
                src={trimmedPrimary}
                alt="Ảnh chính"
                className="h-full w-full object-contain p-1"
                onLoad={() => markUrlBroken(trimmedPrimary, false)}
                onError={() => markUrlBroken(trimmedPrimary, true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-1 text-center text-[10px] text-slate-400">
                <ImageIcon className="h-5 w-5" />
                <span>{isPrimaryBroken ? 'Lỗi tải ảnh' : 'Xem trước'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ảnh phụ (Gallery) */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="block text-xs font-bold tracking-wider text-slate-700 uppercase">
              Danh Sách Ảnh Phụ ({additionalImages.length}/10)
            </span>
            <span className="text-[11px] text-slate-500">
              Các đường dẫn trùng với ảnh chính hoặc trùng lặp sẽ được tự động loại bỏ.
            </span>
          </div>
          <button
            type="button"
            disabled={disabled || additionalImages.length >= 10}
            onClick={handleAddGalleryItem}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm ảnh phụ
          </button>
        </div>

        {additionalImagesError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {additionalImagesError}
          </p>
        )}

        {additionalImages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-500">
            Chưa có ảnh phụ nào. Nhấn <strong>Thêm ảnh phụ</strong> để bổ sung góc chụp sản phẩm.
          </div>
        ) : (
          <div className="space-y-2.5">
            {additionalImages.map((itemUrl, index) => {
              const trimmedItem = itemUrl.trim()
              const canPreview = isValidHttpsUrl(trimmedItem)
              const isBroken = Boolean(brokenUrls[trimmedItem])

              return (
                <div
                  key={index}
                  className="flex flex-col gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:flex-row sm:items-center"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-mono text-xs font-bold text-slate-700">
                    {index + 1}
                  </span>

                  <div className="flex-1 space-y-1">
                    <input
                      type="url"
                      value={itemUrl}
                      disabled={disabled}
                      onChange={(e) => handleGalleryItemChange(index, e.target.value)}
                      placeholder={`https://cdn.example.com/products/gallery-${index + 1}.webp`}
                      maxLength={1000}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 transition outline-none focus:border-blue-600 disabled:bg-slate-100"
                    />
                    {canPreview && isBroken && (
                      <p className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Không tải được ảnh xem trước tại đường dẫn này.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">
                      {canPreview && !isBroken ? (
                        <img
                          src={trimmedItem}
                          alt={`Ảnh phụ ${index + 1}`}
                          className="h-full w-full object-contain p-0.5"
                          onLoad={() => markUrlBroken(trimmedItem, false)}
                          onError={() => markUrlBroken(trimmedItem, true)}
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-300" />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => handleMoveGalleryItem(index, 'up')}
                        title="Di chuyển lên"
                        className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled || index === additionalImages.length - 1}
                        onClick={() => handleMoveGalleryItem(index, 'down')}
                        title="Di chuyển xuống"
                        className="rounded border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleRemoveGalleryItem(index)}
                        title="Xóa ảnh phụ"
                        className="rounded border border-rose-200 bg-white p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
