import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ProductBooleanFilterGroupProps {
  title: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
  defaultExpanded?: boolean
}

export const ProductBooleanFilterGroup: React.FC<ProductBooleanFilterGroupProps> = ({
  title,
  value,
  onChange,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border-b border-slate-200/80 pb-4 pt-3">
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
        <div className="mt-3 flex items-center gap-4 text-xs">
          {/* Tất cả */}
          <label className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value === undefined}
              onChange={() => onChange(undefined)}
              className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
            />
            <span className={value === undefined ? 'font-bold text-slate-950' : 'text-slate-600'}>
              Tất cả
            </span>
          </label>

          {/* Có */}
          <label className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value === true}
              onChange={() => onChange(value === true ? undefined : true)}
              className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
            />
            <span className={value === true ? 'font-bold text-red-600' : 'text-slate-700'}>
              Có
            </span>
          </label>

          {/* Không */}
          <label className="flex items-center gap-2 py-1 px-1 rounded-md hover:bg-slate-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value === false}
              onChange={() => onChange(value === false ? undefined : false)}
              className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 focus:ring-2 cursor-pointer"
            />
            <span className={value === false ? 'font-bold text-red-600' : 'text-slate-700'}>
              Không
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
