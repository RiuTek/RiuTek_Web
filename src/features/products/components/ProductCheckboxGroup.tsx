import React, { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { formatChoiceLabel } from '../productFilterHelper'
import type { ComponentType } from '../productTypes'

interface ProductCheckboxGroupProps {
  title: string
  groupKey: string
  options: (string | number)[]
  selectedValues: (string | number)[]
  onToggle: (value: string | number) => void
  onClear: () => void
  componentType?: ComponentType
  defaultExpanded?: boolean
  emptyMessage?: string
}

export const ProductCheckboxGroup: React.FC<ProductCheckboxGroupProps> = ({
  title,
  groupKey,
  options,
  selectedValues,
  onToggle,
  onClear,
  defaultExpanded = true,
  emptyMessage = 'Chưa có dữ liệu lựa chọn',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  // Danh sách options sau khi lọc theo search nội bộ
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.trim().toLowerCase()
    return options.filter((opt) => {
      const label = formatChoiceLabel(groupKey, opt).toLowerCase()
      return label.includes(query)
    })
  }, [options, searchQuery, groupKey])

  // Hiển thị tối đa 6 choices ban đầu, click Xem thêm để mở rộng
  const displayedOptions = useMemo(() => {
    if (showAll || filteredOptions.length <= 6) {
      return filteredOptions
    }
    return filteredOptions.slice(0, 6)
  }, [filteredOptions, showAll])

  const isAllSelected = selectedValues.length === 0

  return (
    <div className="border-b border-slate-200/80 pb-4 pt-3">
      {/* Header nhóm */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
        aria-expanded={isExpanded}
      >
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider group-hover:text-red-600 transition-colors">
          {title}
        </span>
        <span className="text-slate-400 group-hover:text-slate-600">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {/* Ô tìm kiếm trong choices nếu danh sách dài (> 8 choices) */}
          {options.length > 8 && (
            <div className="relative mb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Tìm trong ${title.toLowerCase()}...`}
                className="w-full pl-7 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            </div>
          )}

          {options.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-1">{emptyMessage}</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {/* Lựa chọn 'Tất cả' */}
              <label className="flex items-center gap-2.5 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onClear}
                  className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                />
                <span className={isAllSelected ? 'font-bold text-slate-950' : 'text-slate-600'}>
                  Tất cả
                </span>
              </label>

              {/* Danh sách các options */}
              {displayedOptions.map((opt) => {
                const isChecked = selectedValues.some((sel) =>
                  typeof sel === 'number' ? sel === opt : String(sel).toLowerCase() === String(opt).toLowerCase()
                )
                const label = formatChoiceLabel(groupKey, opt)

                return (
                  <label
                    key={String(opt)}
                    className="flex items-center gap-2.5 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer text-xs select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(opt)}
                      className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
                    />
                    <span className={isChecked ? 'font-bold text-red-600' : 'text-slate-700'}>
                      {label}
                    </span>
                  </label>
                )
              })}

              {/* Nút Xem thêm / Thu gọn */}
              {filteredOptions.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 pt-1 pl-1 block cursor-pointer focus:outline-none"
                >
                  {showAll ? 'Thu gọn' : `Xem thêm (${filteredOptions.length - 6})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
