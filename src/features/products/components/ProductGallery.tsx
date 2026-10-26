import React, { useMemo, useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ProductGalleryProps {
  productName: string
  imageUrl: string
  additionalImages?: string[]
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
  productName,
  imageUrl,
  additionalImages = [],
}) => {
  // Chuẩn hóa danh sách ảnh: trim, loại bỏ rỗng, deduplicate giữ thứ tự
  const images = useMemo(() => {
    const list: string[] = []
    const seen = new Set<string>()

    const add = (raw: string | undefined | null) => {
      if (!raw) return
      const trimmed = raw.trim()
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed)
        list.push(trimmed)
      }
    }

    add(imageUrl)
    if (Array.isArray(additionalImages)) {
      for (const img of additionalImages) {
        add(img)
      }
    }

    return list
  }, [imageUrl, additionalImages])

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  // Tự động fallback về ảnh đầu tiên khi product/gallery thay đổi
  const activeUrl =
    selectedUrl && images.includes(selectedUrl) ? selectedUrl : images[0] ?? null
  const isActiveFailed = activeUrl ? failedUrls.has(activeUrl) : true

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => {
      const next = new Set(prev)
      next.add(url)
      return next
    })
  }

  if (images.length === 0) {
    return (
      <div className="w-full aspect-square bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-6 text-center">
        <ImageOff className="w-12 h-12 mb-2 text-slate-300" />
        <span className="text-sm font-medium">Chưa có hình ảnh</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Khung hiển thị ảnh chính */}
      <div className="relative w-full aspect-square bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center shadow-xs">
        {activeUrl && !isActiveFailed ? (
          <img
            src={activeUrl}
            alt={productName}
            onError={() => handleImageError(activeUrl)}
            className="w-full h-full object-contain p-4"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <ImageOff className="w-12 h-12 mb-2 text-slate-300" />
            <span className="text-xs font-medium">Không thể tải ảnh</span>
          </div>
        )}
      </div>

      {/* Thumbnails row (khi có nhiều hơn 1 ảnh) */}
      {images.length > 1 && (
        <div
          role="region"
          aria-label="Danh sách ảnh thu nhỏ"
          className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin"
        >
          {images.map((url, idx) => {
            const isSelected = url === activeUrl
            const isFailed = failedUrls.has(url)
            return (
              <button
                key={url}
                type="button"
                onClick={() => setSelectedUrl(url)}
                aria-label={`Xem ảnh ${idx + 1}`}
                aria-current={isSelected ? 'true' : undefined}
                className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden bg-slate-50 transition-all p-1 flex items-center justify-center ${
                  isSelected
                    ? 'border-red-600 ring-2 ring-red-100 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 opacity-70 hover:opacity-100'
                }`}
              >
                {!isFailed ? (
                  <img
                    src={url}
                    alt={`${productName} thumbnail ${idx + 1}`}
                    onError={() => handleImageError(url)}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageOff className="w-5 h-5 text-slate-300" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
