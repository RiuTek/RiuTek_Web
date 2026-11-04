import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Cpu,
  Layers,
  Tv,
  HardDrive,
  Zap,
  Box,
  Wind,
  Sparkles,
  ChevronRight,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react'
import {
  ComponentType,
  type Category,
  type ProductFilterOptionsResponse,
} from '../productTypes'
import {
  TECHNICAL_GROUPS_BY_TYPE,
  getGroupTitle,
  formatChoiceLabel,
  ProductFilterOptionsCoordinator,
  buildProductFilterSearchParams,
} from '../productFilterHelper'
import { getCategories } from '../productApi'

const optionsCoordinator = new ProductFilterOptionsCoordinator()

interface HomeCategoryMenuProps {
  initialCategories?: Category[]
}

function getCategoryIcon(type: ComponentType) {
  switch (type) {
    case ComponentType.CPU:
      return <Cpu className="w-4 h-4 text-red-600 flex-shrink-0" />
    case ComponentType.Motherboard:
      return <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
    case ComponentType.GPU:
      return <Tv className="w-4 h-4 text-emerald-600 flex-shrink-0" />
    case ComponentType.RAM:
      return <HardDrive className="w-4 h-4 text-amber-600 flex-shrink-0" />
    case ComponentType.Storage:
      return <HardDrive className="w-4 h-4 text-indigo-600 flex-shrink-0" />
    case ComponentType.PSU:
      return <Zap className="w-4 h-4 text-yellow-600 flex-shrink-0" />
    case ComponentType.Case:
      return <Box className="w-4 h-4 text-slate-700 flex-shrink-0" />
    case ComponentType.Cooler:
      return <Wind className="w-4 h-4 text-cyan-600 flex-shrink-0" />
    case ComponentType.Accessory:
    default:
      return <Sparkles className="w-4 h-4 text-rose-500 flex-shrink-0" />
  }
}

export const HomeCategoryMenu: React.FC<HomeCategoryMenuProps> = ({
  initialCategories,
}) => {
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([])
  const [isLoadingCats, setIsLoadingCats] = useState(!initialCategories || initialCategories.length === 0)
  const categories = initialCategories && initialCategories.length > 0 ? initialCategories : fetchedCategories

  const [activeCategory, setActiveCategory] = useState<Category | null>(null)
  const [mobileExpandedCatId, setMobileExpandedCatId] = useState<string | null>(null)

  // Flyout options state
  const [panelOptions, setPanelOptions] = useState<ProductFilterOptionsResponse | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState<Error | null>(null)

  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuContainerRef = useRef<HTMLDivElement | null>(null)

  // 1. Nạp categories nếu chưa có
  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      return
    }

    let isMounted = true
    const controller = new AbortController()

    getCategories(controller.signal)
      .then((data) => {
        if (!isMounted) return
        setFetchedCategories(data)
      })
      .catch(() => {
        // Menu lỗi không chặn trang chủ
      })
      .finally(() => {
        if (isMounted) setIsLoadingCats(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [initialCategories])

  // 2. Nạp lazy filter options cho activeCategory (có scope guard)
  useEffect(() => {
    if (!activeCategory) {
      return
    }

    let isMounted = true
    const targetCat = activeCategory
    const scope = {
      componentType: targetCat.componentType,
      categoryId: targetCat.id,
      isActive: true,
      inStock: true,
    }

    optionsCoordinator.loadOptions(
      scope,
      (data) => {
        if (isMounted && activeCategory?.id === targetCat.id) {
          setPanelOptions(data)
          setOptionsError(null)
        }
      },
      (err) => {
        if (isMounted && activeCategory?.id === targetCat.id) {
          setOptionsError(err)
        }
      },
      (loading) => {
        if (isMounted && activeCategory?.id === targetCat.id) {
          setIsLoadingOptions(loading)
        }
      }
    )

    return () => {
      isMounted = false
    }
  }, [activeCategory])

  // Mouse hover logic với vùng đệm chống mouseleave bất ngờ
  const handleMouseEnterRoot = (cat: Category) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
    setActiveCategory(cat)
  }

  const handleMouseLeaveRootOrPanel = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      // Chỉ đóng khi focus không nằm trong panel
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(document.activeElement)
      ) {
        setActiveCategory(null)
      }
    }, 180)
  }

  const handleMouseEnterPanel = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
  }

  // Đóng khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCategory(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Nhóm kỹ thuật áp dụng cho activeCategory
  const applicableTechnicalKeys = useMemo(() => {
    if (!activeCategory?.componentType) return []
    return TECHNICAL_GROUPS_BY_TYPE[activeCategory.componentType] ?? []
  }, [activeCategory])

  return (
    <div
      ref={menuContainerRef}
      onMouseLeave={handleMouseLeaveRootOrPanel}
      className="relative w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm z-30"
    >
      {/* Menu Header */}
      <div className="flex items-center gap-2 p-4 border-b border-slate-100">
        <SlidersHorizontal className="w-4 h-4 text-red-600" />
        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
          Danh Mục Linh Kiện
        </span>
      </div>

      {/* Menu List */}
      <div className="p-2 space-y-0.5">
        {isLoadingCats && (
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-7 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {!isLoadingCats && categories.length === 0 && (
          <div className="p-4 text-xs text-slate-400 italic text-center">
            Chưa có danh mục sản phẩm
          </div>
        )}

        {!isLoadingCats &&
          categories.map((cat) => {
            const isHovered = activeCategory?.id === cat.id
            const isMobileExpanded = mobileExpandedCatId === cat.id
            const hasChildren = cat.subCategories && cat.subCategories.length > 0

            return (
              <div key={cat.id} className="relative">
                <div
                  onMouseEnter={() => handleMouseEnterRoot(cat)}
                  className={`flex items-center justify-between rounded-xl transition-colors ${
                    isHovered
                      ? 'bg-red-50 text-red-600 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {/* Link dẫn đến catalog */}
                  <Link
                    to={`/products?categoryId=${cat.id}&componentType=${cat.componentType}`}
                    onFocus={() => handleMouseEnterRoot(cat)}
                    className="flex-1 flex items-center gap-2.5 px-3 py-2.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-l-xl"
                  >
                    {getCategoryIcon(cat.componentType)}
                    <span className="truncate">{cat.name}</span>
                  </Link>

                  {/* Nút chevron cho desktop hover indicator / mobile accordion */}
                  <div className="flex items-center pr-2">
                    <button
                      type="button"
                      onClick={() =>
                        setMobileExpandedCatId(isMobileExpanded ? null : cat.id)
                      }
                      className="p-1 text-slate-400 hover:text-slate-600 sm:hover:text-red-600 focus:outline-none"
                      aria-expanded={isMobileExpanded}
                      aria-controls={`mobile-sub-${cat.id}`}
                      aria-label={`Mở danh mục con của ${cat.name}`}
                    >
                      <ChevronRight
                        className={`w-3.5 h-3.5 transition-transform ${
                          isMobileExpanded ? 'rotate-90 sm:rotate-0' : ''
                        } ${isHovered ? 'text-red-600' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Mobile Accordion Submenu (in-flow, không overflow màn hình) */}
                {isMobileExpanded && (
                  <div
                    id={`mobile-sub-${cat.id}`}
                    className="lg:hidden pl-8 pr-3 py-2 space-y-1 bg-slate-50/70 rounded-xl mt-1 text-xs"
                  >
                    <Link
                      to={`/products?categoryId=${cat.id}&componentType=${cat.componentType}`}
                      className="block py-1 text-red-600 font-bold hover:underline"
                    >
                      Xem tất cả {cat.name}
                    </Link>
                    {hasChildren &&
                      cat.subCategories.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
                          className="block py-1 text-slate-600 hover:text-slate-900"
                        >
                          {sub.name}
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Flyout Panel bên phải trên Desktop */}
      {activeCategory && (
        <div
          onMouseEnter={handleMouseEnterPanel}
          onMouseLeave={handleMouseLeaveRootOrPanel}
          className="hidden lg:flex flex-col absolute left-full top-0 ml-2 w-[420px] max-h-[480px] bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-5 z-40 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {getCategoryIcon(activeCategory.componentType)}
              <h3 className="font-extrabold text-sm text-slate-950">
                {activeCategory.name}
              </h3>
            </div>
            <Link
              to={`/products?categoryId=${activeCategory.id}&componentType=${activeCategory.componentType}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4 text-xs">
            {/* 1. Danh mục con thật theo cây từ API */}
            {activeCategory.subCategories && activeCategory.subCategories.length > 0 && (
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Danh Mục Con
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {activeCategory.subCategories.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
                      className="px-2.5 py-1.5 bg-slate-50 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-700 transition-colors truncate"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Lối tắt lọc theo thông số metadata (Hãng, Socket, VRAM, Dung lượng...) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Lối Tắt Bộ Lọc
                </h4>
                {isLoadingOptions && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Đang tải thông số...</span>
                  </span>
                )}
              </div>

              {optionsError && (
                <div className="p-2.5 bg-slate-50 rounded-xl text-slate-500 italic">
                  Không nạp được lối tắt bộ lọc. Vui lòng bấm "Xem tất cả" để mở bộ lọc đầy đủ.
                </div>
              )}

              {!isLoadingOptions && !optionsError && panelOptions && (
                <div className="space-y-3">
                  {/* Hãng sản xuất */}
                  {panelOptions.brands && panelOptions.brands.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                        Thương hiệu:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {panelOptions.brands.slice(0, 8).map((brand) => {
                          const query = buildProductFilterSearchParams({
                            categoryId: activeCategory.id,
                            componentType: activeCategory.componentType,
                            brands: [brand],
                          }).toString()
                          return (
                            <Link
                              key={brand}
                              to={`/products?${query}`}
                              className="px-2 py-1 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-md text-[11px] font-medium text-slate-700 transition-colors"
                            >
                              {brand}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Các nhóm thông số kỹ thuật chính */}
                  {applicableTechnicalKeys.slice(0, 3).map((groupKey) => {
                    const group = panelOptions.groups?.find((g) => g.key === groupKey)
                    if (!group || group.values.length === 0) return null

                    const groupTitle = getGroupTitle(groupKey, activeCategory.componentType)
                    return (
                      <div key={groupKey}>
                        <span className="text-[11px] font-semibold text-slate-500 mb-1.5 block">
                          {groupTitle}:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {group.values.slice(0, 6).map((val) => {
                            const query = buildProductFilterSearchParams({
                              categoryId: activeCategory.id,
                              componentType: activeCategory.componentType,
                              [groupKey]: [val],
                            }).toString()
                            return (
                              <Link
                                key={String(val)}
                                to={`/products?${query}`}
                                className="px-2 py-1 bg-slate-50 border border-slate-200/80 hover:border-red-300 hover:bg-red-50 hover:text-red-600 rounded-md text-[11px] text-slate-700 transition-colors"
                              >
                                {formatChoiceLabel(groupKey, val)}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
