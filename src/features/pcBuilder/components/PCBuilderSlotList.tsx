import React, { useState } from 'react'
import {
  Cpu,
  Layers,
  Tv,
  HardDrive,
  Database,
  Zap,
  Box,
  Fan,
  Sparkles,
  Plus,
  RefreshCw,
  Trash2,
  Package,
  AlertTriangle,
} from 'lucide-react'
import { COMPONENT_TYPE_LABELS, formatVnd } from '../../products/productConstants'
import { ComponentType } from '../../products/productTypes'
import {
  PC_BUILDER_SLOT_ORDER,
  isRequiredComponent,
  isSingleChoiceComponent,
  MAX_MULTI_CHOICE_QUANTITY,
  MIN_QUANTITY,
} from '../pcBuilderConstants'
import type {
  PCBuildPreviewItem,
  SelectedPCBuildItem,
} from '../pcBuilderTypes'

interface PCBuilderSlotListProps {
  selectedItems: SelectedPCBuildItem[]
  previewItems?: PCBuildPreviewItem[]
  activeSlot: ComponentType | null
  onSelectSlot: (slot: ComponentType) => void
  onUpdateQuantity: (productId: string, quantity: number) => void
  onRemoveItem: (productId: string) => void
}

const SLOT_ICONS: Record<ComponentType, React.ElementType> = {
  [ComponentType.CPU]: Cpu,
  [ComponentType.Motherboard]: Layers,
  [ComponentType.GPU]: Tv,
  [ComponentType.RAM]: HardDrive,
  [ComponentType.Storage]: Database,
  [ComponentType.PSU]: Zap,
  [ComponentType.Case]: Box,
  [ComponentType.Cooler]: Fan,
  [ComponentType.Accessory]: Sparkles,
}

interface SlotThumbnailProps {
  url: string | null
  alt: string
}

const SlotThumbnail: React.FC<SlotThumbnailProps> = ({ url, alt }) => {
  const [hasError, setHasError] = useState(false)

  if (!url || hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
        <Package className="w-5 h-5" aria-hidden="true" />
      </div>
    )
  }

  return (
    <img
      src={url}
      alt={alt}
      className="w-full h-full object-contain p-1"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

export const PCBuilderSlotList: React.FC<PCBuilderSlotListProps> = ({
  selectedItems,
  previewItems = [],
  activeSlot,
  onSelectSlot,
  onUpdateQuantity,
  onRemoveItem,
}) => {
  // Map preview item theo productId
  const previewMap = new Map<string, PCBuildPreviewItem>()
  previewItems.forEach((pi) => {
    previewMap.set(pi.productId, pi)
  })

  return (
    <div className="space-y-4">
      {PC_BUILDER_SLOT_ORDER.map((slotType) => {
        const IconComponent = SLOT_ICONS[slotType] || Package
        const isRequired = isRequiredComponent(slotType)
        const isSingle = isSingleChoiceComponent(slotType)
        const slotItems = selectedItems.filter(
          (item) => item.product.componentType === slotType
        )
        const isActive = activeSlot === slotType

        return (
          <div
            key={slotType}
            className={`rounded-3xl border transition-all ${
              isActive
                ? 'border-red-500 bg-red-50/10 shadow-sm ring-1 ring-red-500/20'
                : 'border-slate-200/90 bg-white hover:border-slate-300'
            }`}
          >
            {/* Slot Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <IconComponent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                    {COMPONENT_TYPE_LABELS[slotType]}
                  </h3>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    {isRequired ? (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                        Bắt buộc
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Tùy chọn
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {isSingle ? 'Tối đa 1' : 'Có thể chọn nhiều'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Slot Action Button */}
              {slotItems.length === 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectSlot(slotType)}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Chọn linh kiện</span>
                </button>
              ) : !isSingle ? (
                <button
                  type="button"
                  onClick={() => onSelectSlot(slotType)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm mục khác</span>
                </button>
              ) : null}
            </div>

            {/* Selected Items for this Slot */}
            {slotItems.length > 0 && (
              <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50 rounded-b-3xl">
                {slotItems.map(({ product, quantity }) => {
                  const preview = previewMap.get(product.id)
                  const lineTotal = preview?.linePrice ?? product.price * quantity
                  const canPurchase = preview ? preview.canPurchase : true
                  const issueCode = preview?.issueCode

                  return (
                    <div
                      key={product.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs"
                    >
                      {/* Product Overview */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          <SlotThumbnail
                            key={product.imageUrl ?? product.id}
                            url={product.imageUrl}
                            alt={product.name}
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{product.brand}</span>
                            <span>•</span>
                            <span>SKU: {product.sku}</span>
                          </div>
                          <h4
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate"
                            title={product.name}
                          >
                            {product.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-600">
                              {formatVnd(product.price)}
                            </span>
                            {quantity > 1 && (
                              <span className="text-slate-400">
                                × {quantity} ={' '}
                                <span className="font-bold text-slate-900">
                                  {formatVnd(lineTotal)}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Purchase or Issue Warning Tag */}
                          {!canPurchase && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full mt-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Sản phẩm hiện không thể đặt mua</span>
                            </div>
                          )}
                          {issueCode && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mt-1 ml-1">
                              <span>Mã lưu ý: {issueCode}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Controls and Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Multi-choice Quantity Stepper */}
                        {!isSingle && (
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <button
                              type="button"
                              disabled={quantity <= MIN_QUANTITY}
                              onClick={() =>
                                onUpdateQuantity(product.id, quantity - 1)
                              }
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                              aria-label="Giảm số lượng"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-900">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              disabled={quantity >= MAX_MULTI_CHOICE_QUANTITY}
                              onClick={() =>
                                onUpdateQuantity(product.id, quantity + 1)
                              }
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                              aria-label="Tăng số lượng"
                            >
                              +
                            </button>
                          </div>
                        )}

                        {/* Replace button for Single Choice */}
                        {isSingle && (
                          <button
                            type="button"
                            onClick={() => onSelectSlot(slotType)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                            title="Chọn linh kiện khác thay thế"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Thay thế</span>
                          </button>
                        )}

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => onRemoveItem(product.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Gỡ linh kiện này"
                          aria-label={`Gỡ linh kiện ${product.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
