import React from 'react'
import {
  ComponentType,
  type ProductFilterOptionsResponse,
} from '../../products/productTypes'
import {
  TECHNICAL_GROUPS_BY_TYPE,
  BOOLEAN_FILTER_KEYS,
  getGroupTitle,
} from '../../products/productFilterHelper'
import type { PCBuilderTechnicalFilterState } from '../pcBuilderTypes'
import { ProductCheckboxGroup } from '../../products/components/ProductCheckboxGroup'
import { ProductBooleanFilterGroup } from '../../products/components/ProductBooleanFilterGroup'
import { RefreshCw } from 'lucide-react'

export interface PCBuilderTechnicalFiltersProps {
  activeSlot: ComponentType
  technicalFilters: PCBuilderTechnicalFilterState
  filterOptions?: ProductFilterOptionsResponse | null
  isOptionsLoading?: boolean
  optionsError?: Error | null
  onToggleChoice?: (key: string, value: string | number) => void
  onClearGroup?: (key: string) => void
  onChangeBoolean?: (key: string, value: boolean | undefined) => void
  onRetryOptions?: () => void
  // Legacy handler fallback
  onChange?: <K extends keyof PCBuilderTechnicalFilterState>(
    key: K,
    value: PCBuilderTechnicalFilterState[K]
  ) => void
}

export const PCBuilderTechnicalFilters: React.FC<PCBuilderTechnicalFiltersProps> = ({
  activeSlot,
  technicalFilters,
  filterOptions,
  isOptionsLoading = false,
  optionsError = null,
  onToggleChoice,
  onClearGroup,
  onChangeBoolean,
  onRetryOptions,
  onChange,
}) => {
  // Accessory không có bộ lọc kỹ thuật
  if (activeSlot === ComponentType.Accessory) {
    return null
  }

  const applicableKeys = TECHNICAL_GROUPS_BY_TYPE[activeSlot] ?? []

  const handleToggle = (groupKey: string, value: string | number) => {
    if (onToggleChoice) {
      onToggleChoice(groupKey, value)
    } else if (onChange) {
      const current = (technicalFilters[groupKey as keyof PCBuilderTechnicalFilterState] as (string | number)[]) ?? []
      const exists = current.some((item) =>
        typeof item === 'number' ? item === value : String(item).toLowerCase() === String(value).toLowerCase()
      )
      const next = exists
        ? current.filter((item) => (typeof item === 'number' ? item !== value : String(item).toLowerCase() !== String(value).toLowerCase()))
        : [...current, value]
      // @ts-expect-error type union
      onChange(groupKey, next)
    }
  }

  const handleClear = (groupKey: string) => {
    if (onClearGroup) {
      onClearGroup(groupKey)
    } else if (onChange) {
      // @ts-expect-error type union
      onChange(groupKey, [])
    }
  }

  const handleBool = (groupKey: string, val: boolean | undefined) => {
    if (onChangeBoolean) {
      onChangeBoolean(groupKey, val)
    } else if (onChange) {
      // @ts-expect-error type union
      onChange(groupKey, val)
    }
  }

  const booleanKeys = applicableKeys.filter((k) => (BOOLEAN_FILTER_KEYS as readonly string[]).includes(k))
  const metadataKeys = applicableKeys.filter((k) => !(BOOLEAN_FILTER_KEYS as readonly string[]).includes(k))

  return (
    <div className="pt-3 border-t border-slate-200 space-y-3">
      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        Thông số kỹ thuật
      </div>

      {/* Boolean Filters tĩnh (luôn hiển thị theo activeSlot) */}
      {booleanKeys.length > 0 && (
        <div className="space-y-1">
          {booleanKeys.map((groupKey) => {
            const title = getGroupTitle(groupKey, activeSlot)
            const currentVal = technicalFilters[groupKey as keyof PCBuilderTechnicalFilterState] as boolean | undefined
            return (
              <ProductBooleanFilterGroup
                key={groupKey}
                title={title}
                value={currentVal}
                onChange={(val) => handleBool(groupKey, val)}
              />
            )
          })}
        </div>
      )}

      {/* Metadata Filters (Hãng & Metadata groups từ API) */}
      {isOptionsLoading ? (
        <div className="space-y-2 py-2">
          <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
          <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5" />
        </div>
      ) : optionsError ? (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
          <p className="text-slate-600">Không nạp được thông số kỹ thuật.</p>
          {onRetryOptions && (
            <button
              type="button"
              onClick={onRetryOptions}
              className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {/* Hãng sản xuất nếu có trong filterOptions */}
          {filterOptions?.brands && filterOptions.brands.length > 0 && (
            <ProductCheckboxGroup
              title="Thương hiệu"
              groupKey="brands"
              options={filterOptions.brands}
              selectedValues={technicalFilters.brands ?? []}
              onToggle={(val) => handleToggle('brands', val)}
              onClear={() => handleClear('brands')}
              emptyMessage="Chưa có dữ liệu thương hiệu"
            />
          )}

          {/* Các nhóm kỹ thuật metadata */}
          {metadataKeys.map((groupKey) => {
            const title = getGroupTitle(groupKey, activeSlot)
            const groupMetadata = filterOptions?.groups?.find((g) => g.key === groupKey)
            const options = groupMetadata ? groupMetadata.values : []
            const currentSelected = (technicalFilters[groupKey as keyof PCBuilderTechnicalFilterState] as (string | number)[]) ?? []

            return (
              <ProductCheckboxGroup
                key={groupKey}
                title={title}
                groupKey={groupKey}
                options={options}
                selectedValues={currentSelected}
                onToggle={(val) => handleToggle(groupKey, val)}
                onClear={() => handleClear(groupKey)}
                componentType={activeSlot}
                emptyMessage="Không có thông số tương ứng"
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
