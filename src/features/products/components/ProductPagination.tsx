import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ProductPaginationProps {
  pageIndex: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  onPageChange: (newPage: number) => void
}

export const ProductPagination: React.FC<ProductPaginationProps> = ({
  pageIndex,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}) => {
  if (totalPages <= 1) {
    return null
  }

  // Generate pagination items with ellipses
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const delta = 1 // adjacent pages to current

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= pageIndex - delta && i <= pageIndex + delta)
      ) {
        pages.push(i)
      } else if (
        (i === pageIndex - delta - 1 && i > 1) ||
        (i === pageIndex + delta + 1 && i < totalPages)
      ) {
        pages.push('...')
      }
    }

    // Deduplicate consecutive ellipses if any
    return pages.filter((item, index) => {
      if (item === '...' && pages[index - 1] === '...') return false
      return true
    })
  }

  const pageNumbers = getPageNumbers()

  const handleSelectPage = (page: number) => {
    if (page === pageIndex || page < 1 || page > totalPages) return
    onPageChange(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <nav
      aria-label="Phân trang sản phẩm"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200 mt-8"
    >
      <div className="text-xs text-slate-500 font-medium">
        Trang <span className="font-bold text-slate-900">{pageIndex}</span> /{' '}
        <span className="font-bold text-slate-900">{totalPages}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => handleSelectPage(pageIndex - 1)}
          disabled={!hasPreviousPage}
          aria-label="Trang trước"
          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-slate-400 font-mono select-none"
                >
                  ...
                </span>
              )
            }

            const isCurrent = p === pageIndex
            return (
              <button
                key={p}
                type="button"
                onClick={() => handleSelectPage(p)}
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-w-9 h-9 px-2 text-xs font-bold rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => handleSelectPage(pageIndex + 1)}
          disabled={!hasNextPage}
          aria-label="Trang tiếp theo"
          className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  )
}
