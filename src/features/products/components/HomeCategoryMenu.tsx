import React, { useState, useEffect, useRef } from 'react'
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

  // Flyout options state (desktop)
  const [panelOptions, setPanelOptions] = useState<ProductFilterOptionsResponse | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState<Error | null>(null)

  // Mobile options state
  const [mobileBrandsMap, setMobileBrandsMap] = useState<
    Record<string, { brands: string[]; isLoading: boolean; error: Error | null }>
  >({})

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

  // 2. Nạp lazy filter options cho activeCategory (desktop)
  useEffect(() => {
    if (!activeCategory) {
      return
    }

    let isMounted = true
    const targetCat = activeCategory
    const scope = {
      componentType: targetCat.componentType,
      categoryId: targetCat.id,
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

  // 3. Nạp lazy filter options cho mobile category khi được mở
  useEffect(() => {
    if (!mobileExpandedCatId) return
    const targetCat = categories.find((c) => c.id === mobileExpandedCatId)
    if (!targetCat) return

    if (mobileBrandsMap[targetCat.id]) return

    let isMounted = true
    const scope = {
      componentType: targetCat.componentType,
      categoryId: targetCat.id,
    }

    optionsCoordinator.loadOptions(
      scope,
      (data) => {
        if (isMounted) {
          setMobileBrandsMap((prev) => ({
            ...prev,
            [targetCat.id]: { brands: data.brands ?? [], isLoading: false, error: null },
          }))
        }
      },
      (err) => {
        if (isMounted) {
          setMobileBrandsMap((prev) => ({
            ...prev,
            [targetCat.id]: { brands: [], isLoading: false, error: err },
          }))
        }
      },
      (loading) => {
        if (isMounted) {
          setMobileBrandsMap((prev) => ({
            ...prev,
            [targetCat.id]: {
              ...(prev[targetCat.id] ?? { brands: [], error: null }),
              isLoading: loading,
            },
          }))
        }
      }
    )

    return () => {
      isMounted = false
    }
  }, [mobileExpandedCatId, categories, mobileBrandsMap])

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
                    className="lg:hidden pl-8 pr-3 py-3 space-y-3 bg-slate-50/80 rounded-xl mt-1 text-xs border border-slate-100"
                  >
                    <Link
                      to={`/products?categoryId=${cat.id}&componentType=${cat.componentType}`}
                      className="inline-flex items-center gap-1 text-red-600 font-bold hover:underline"
                    >
                      <span>Xem tất cả {cat.name}</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>

                    {/* Danh mục con nếu có */}
                    {hasChildren && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Danh mục con:
                        </span>
                        <div className="space-y-1">
                          {cat.subCategories.map((sub) => (
                            <Link
                              key={sub.id}
                              to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
                              className="block py-1 text-slate-700 hover:text-red-600 truncate"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Thương hiệu (luôn hiển thị kể cả root không có danh mục con) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Thương hiệu:
                        </span>
                        {mobileBrandsMap[cat.id]?.isLoading && (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>Đang nạp...</span>
                          </span>
                        )}
                      </div>

                      {mobileBrandsMap[cat.id]?.brands &&
                      mobileBrandsMap[cat.id].brands.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {mobileBrandsMap[cat.id].brands.map((b) => {
                            const query = buildProductFilterSearchParams({
                              categoryId: cat.id,
                              componentType: cat.componentType,
                              brands: [b],
                            }).toString()
                            return (
                              <Link
                                key={b}
                                to={`/products?${query}`}
                                className="px-2 py-0.5 bg-white border border-slate-200/90 hover:border-red-300 hover:text-red-600 rounded-md text-[11px] font-medium text-slate-700"
                              >
                                {b}
                              </Link>
                            )
                          })}
                        </div>
                      ) : !mobileBrandsMap[cat.id]?.isLoading ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Chưa có thương hiệu
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Mega Menu Panel bên phải trên Desktop */}
      {activeCategory && (
        <div
          id="desktop-category-flyout-panel"
          onMouseEnter={handleMouseEnterPanel}
          onMouseLeave={handleMouseLeaveRootOrPanel}
          className="hidden lg:flex flex-col absolute left-full top-0 ml-6 w-[720px] xl:w-[940px] max-w-[calc(100vw-340px)] max-h-[calc(100vh-160px)] min-h-[380px] bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 z-40 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header Panel */}
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              {getCategoryIcon(activeCategory.componentType)}
              <h3 className="font-extrabold text-base sm:text-lg text-slate-950">
                {activeCategory.name}
              </h3>
            </div>
            <Link
              to={`/products?categoryId=${activeCategory.id}&componentType=${activeCategory.componentType}`}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-red-600 hover:text-red-700"
            >
              <span>Xem tất cả {activeCategory.name}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* 1. Danh mục con thật theo cây từ API */}
            {activeCategory.subCategories && activeCategory.subCategories.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Danh Mục Con
                </h4>
                <div className="space-y-1">
                  {activeCategory.subCategories.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
                      className="block py-1.5 px-2.5 rounded-lg text-sm text-slate-700 hover:text-red-600 hover:bg-red-50/70 font-medium transition-colors truncate"
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Thương hiệu từ filter-options */}
            <div
              className={
                activeCategory.subCategories && activeCategory.subCategories.length > 0
                  ? 'col-span-1 xl:col-span-2'
                  : 'col-span-full'
              }
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Thương Hiệu
                </h4>
                {isLoadingOptions && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang nạp hãng...</span>
                  </span>
                )}
              </div>

              {optionsError && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 italic">
                  Không nạp được danh sách thương hiệu. Vui lòng bấm &quot;Xem tất cả&quot; để mở catalog.
                </div>
              )}

              {!isLoadingOptions && !optionsError && panelOptions && (
                <div>
                  {panelOptions.brands && panelOptions.brands.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {panelOptions.brands.map((brand) => {
                        const query = buildProductFilterSearchParams({
                          categoryId: activeCategory.id,
                          componentType: activeCategory.componentType,
                          brands: [brand],
                        }).toString()
                        return (
                          <Link
                            key={brand}
                            to={`/products?${query}`}
                            className="p-2.5 bg-slate-50 border border-slate-200/70 hover:border-red-300 hover:bg-red-50/70 hover:text-red-600 rounded-xl text-xs font-semibold text-slate-700 transition-all text-center truncate shadow-2xs"
                          >
                            {brand}
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Chưa có thương hiệu trong danh mục này.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
