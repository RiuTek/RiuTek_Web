import React from 'react'
import { X, RotateCcw } from 'lucide-react'
import {
  COMPONENT_TYPE_LABELS,
  formatVnd,
} from '../productConstants'
import {
  formatChoiceLabel,
  getGroupTitle,
  type ParsedProductCatalogFilters,
} from '../productFilterHelper'
import type { Category, ComponentType } from '../productTypes'

interface ProductActiveFilterChipsProps {
  filters: ParsedProductCatalogFilters
  effectiveComponentType?: ComponentType
  categories: Category[]
  onRemoveFilter: (key: string, value?: string | number) => void
  onClearAll: () => void
}

export const ProductActiveFilterChips: React.FC<ProductActiveFilterChipsProps> = ({
  filters,
  categories,
  onRemoveFilter,
  onClearAll,
}) => {
  const chips: Array<{ id: string; label: string; onRemove: () => void }> = []

  // 1. Search term
  if (filters.searchTerm) {
    chips.push({
      id: `search-${filters.searchTerm}`,
      label: `Tìm kiếm: "${filters.searchTerm}"`,
      onRemove: () => onRemoveFilter('searchTerm'),
    })
  }

  // 2. Component Type
  if (filters.componentType) {
    chips.push({
      id: `type-${filters.componentType}`,
      label: COMPONENT_TYPE_LABELS[filters.componentType] ?? `Loại #${filters.componentType}`,
      onRemove: () => onRemoveFilter('componentType'),
    })
  }

  // 3. Category
  if (filters.categoryId) {
    const findCat = (cats: Category[]): Category | undefined => {
      for (const c of cats) {
        if (c.id === filters.categoryId) return c
        if (c.subCategories) {
          const found = findCat(c.subCategories)
          if (found) return found
        }
      }
      return undefined
    }
    const cat = findCat(categories)
    chips.push({
      id: `cat-${filters.categoryId}`,
      label: cat ? cat.name : 'Danh mục đã chọn',
      onRemove: () => onRemoveFilter('categoryId'),
    })
  }

  // 4. Giá (minPrice, maxPrice)
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    let priceLabel = ''
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      priceLabel = `Giá: ${formatVnd(filters.minPrice)} - ${formatVnd(filters.maxPrice)}`
    } else if (filters.minPrice !== undefined) {
      priceLabel = `Giá: từ ${formatVnd(filters.minPrice)}`
    } else if (filters.maxPrice !== undefined) {
      priceLabel = `Giá: đến ${formatVnd(filters.maxPrice)}`
    }
    chips.push({
      id: 'price-filter',
      label: priceLabel,
      onRemove: () => onRemoveFilter('price'),
    })
  }

  // 5. Tồn kho & Trạng thái
  if (typeof filters.inStock === 'boolean') {
    chips.push({
      id: `inStock-${filters.inStock}`,
      label: filters.inStock ? 'Còn hàng' : 'Hết hàng',
      onRemove: () => onRemoveFilter('inStock'),
    })
  }
  if (typeof filters.isActive === 'boolean') {
    chips.push({
      id: `isActive-${filters.isActive}`,
      label: filters.isActive ? 'Đang kinh doanh' : 'Ngừng kinh doanh',
      onRemove: () => onRemoveFilter('isActive'),
    })
  }

  // 6. Brands
  for (const b of filters.brands) {
    chips.push({
      id: `brand-${b}`,
      label: `Hãng: ${b}`,
      onRemove: () => onRemoveFilter('brands', b),
    })
  }

  // 7. Technical arrays
  const arrayKeys = [
    'sockets',
    'memoryTypes',
    'motherboardFormFactors',
    'ramFormFactors',
    'storageTypes',
    'storageInterfaces',
    'psuEfficiencies',
    'psuModularities',
    'psuFormFactors',
    'coolerTypes',
    'coreCounts',
    'vramGbs',
    'gpuLengthsMm',
    'ramCapacitiesGb',
    'ramSpeedsMhz',
    'storageCapacitiesGb',
    'psuWattages',
  ] as const

  for (const k of arrayKeys) {
    const list = filters[k]
    if (Array.isArray(list) && list.length > 0) {
      const groupTitle = getGroupTitle(k)
      for (const val of list) {
        chips.push({
          id: `${k}-${val}`,
          label: `${groupTitle}: ${formatChoiceLabel(k, val)}`,
          onRemove: () => onRemoveFilter(k, val),
        })
      }
    }
  }

  // 8. Booleans
  const boolKeys = [
    { key: 'hasIntegratedGpu', title: 'iGPU' },
    { key: 'hasWifi', title: 'Wi-Fi' },
    { key: 'hasRgb', title: 'LED RGB' },
    { key: 'has12VHPWR', title: 'Cổng 12VHPWR' },
    { key: 'requires12VHPWR', title: 'Yêu cầu 12VHPWR' },
  ] as const

  for (const item of boolKeys) {
    const val = filters[item.key as keyof ParsedProductCatalogFilters]
    if (typeof val === 'boolean') {
      chips.push({
        id: `${item.key}-${val}`,
        label: `${item.title}: ${val ? 'Có' : 'Không'}`,
        onRemove: () => onRemoveFilter(item.key),
      })
    }
  }

  if (chips.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
        Đang lọc ({chips.length}):
      </span>

      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200/70"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center hover:bg-red-200 text-red-600 transition-colors focus:outline-none"
            title="Xóa lựa chọn này"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-slate-100 transition-colors ml-auto focus:outline-none"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Xóa tất cả</span>
      </button>
    </div>
  )
}
