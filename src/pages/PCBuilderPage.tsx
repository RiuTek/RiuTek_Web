import React from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench,
  Cpu,
  Zap,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react'
import { usePCBuilder } from '../features/pcBuilder/usePCBuilder'
import { PCBuilderSlotList } from '../features/pcBuilder/components/PCBuilderSlotList'
import { PCBuilderProductPickerModal } from '../features/pcBuilder/components/PCBuilderProductPickerModal'
import { PCBuilderSummary } from '../features/pcBuilder/components/PCBuilderSummary'
import type { ComponentType, ProductSummary } from '../features/products/productTypes'

export const PCBuilderPage: React.FC = () => {
  const {
    selectedItems,
    activeSlot,
    setActiveSlot,
    previewResult,
    isPreviewLoading,
    previewError,
    selectProduct,
    updateItemQuantity,
    removeItem,
    clearBuild,
    retryPreview,
  } = usePCBuilder()

  const handleSelectProduct = (product: ProductSummary) => {
    selectProduct(product)
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Banner Header */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-4">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Link
              to="/"
              className="hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">Xây dựng cấu hình PC</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold">
                <Wrench className="w-3.5 h-3.5" />
                <span>RiuTek PC Builder</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Xây Dựng Cấu Hình Máy Tính
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                Tự do tùy biến dàn máy theo sở thích và nhu cầu công việc. Hệ thống tự động kiểm tra tương thích giữa các linh kiện và tính toán công suất nguồn khuyến nghị theo thời gian thực.
              </p>
            </div>

            {/* Feature Highlights Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Kiểm tra tương thích theo quy tắc</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Ước tính công suất PSU</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">
                <Cpu className="w-4 h-4 text-blue-600" />
                <span>9 nhóm linh kiện</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Stable Slot List */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-950">
                  Danh Sách Linh Kiện Cấu Hình
                </h2>
                <p className="text-xs text-slate-500">
                  Nhấn "Chọn linh kiện" hoặc "Thay thế" ở từng nhóm để mở danh mục
                </p>
              </div>
            </div>

            <PCBuilderSlotList
              selectedItems={selectedItems}
              previewItems={previewResult?.items}
              activeSlot={activeSlot}
              onSelectSlot={(slot: ComponentType) => {
                setActiveSlot(slot)
              }}
              onUpdateQuantity={updateItemQuantity}
              onRemoveItem={removeItem}
            />
          </div>

          {/* Right Column: Compatibility Summary */}
          <div className="lg:col-span-5 xl:col-span-4">
            <PCBuilderSummary
              selectedItems={selectedItems}
              previewResult={previewResult}
              isLoading={isPreviewLoading}
              error={previewError}
              onRetry={retryPreview}
              hasItems={selectedItems.length > 0}
              itemCount={selectedItems.length}
              onClearAll={clearBuild}
            />
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      {activeSlot !== null && (
        <PCBuilderProductPickerModal
          key={activeSlot}
          activeSlot={activeSlot}
          onSelectProduct={handleSelectProduct}
          onClose={() => setActiveSlot(null)}
          selectedItems={selectedItems}
        />
      )}
    </div>
  )
}
