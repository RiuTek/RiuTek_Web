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
  ProductFilterOptionsCoordinator,
  buildProductFilterSearchParams,
} from '../productFilterHelper'
import { getCategories } from '../productApi'

interface HomeCategoryMenuProps {
  initialCategories?: Category[]
  isLoadingCategories?: boolean
  categoriesError?: Error | null
  onRetryCategories?: () => void
}

/**
 * Chuẩn hóa cây danh mục hiển thị trên Homepage:
 * - Thanh list “Danh Mục Linh Kiện” chỉ có danh mục GỐC (parentId === null hoặc rỗng).
 * - Danh mục con (parentId !== null) được gắn vào đúng subCategories của cha tương ứng,
 *   không trở thành dòng độc lập ở list ngoài dù API trả về phẳng hay lặp lại ở mảng cấp ngoài.
 * - Giữ nguyên toàn bộ subtree và không trùng lặp node theo id.
 */
function buildRootCategoriesTree(rawCategories: Category[]): Category[] {
  if (!Array.isArray(rawCategories) || rawCategories.length === 0) {
    return []
  }

  // 1. Thu thập tất cả các nodes theo id (khử trùng lặp node xuất hiện cả ở mảng ngoài lẫn subCategories)
  const nodeMap = new Map<string, Category>()

  function collectNodes(nodes: Category[]) {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!node || !node.id) continue
      const existing = nodeMap.get(node.id)
      if (!existing) {
        nodeMap.set(node.id, {
          ...node,
          subCategories: Array.isArray(node.subCategories) ? [...node.subCategories] : [],
        })
      } else {
        // Hợp nhất subCategories nếu node mới có thêm con
        if (Array.isArray(node.subCategories) && node.subCategories.length > 0) {
          const existingSubIds = new Set(existing.subCategories.map((s) => s.id))
          for (const sub of node.subCategories) {
            if (sub && sub.id && !existingSubIds.has(sub.id)) {
              existing.subCategories.push(sub)
              existingSubIds.add(sub.id)
            }
          }
        }
      }
      if (Array.isArray(node.subCategories) && node.subCategories.length > 0) {
        collectNodes(node.subCategories)
      }
    }
  }

  collectNodes(rawCategories)

  // 2. Gắn kết quan hệ cha - con nếu child có parentId hợp lệ và chưa nằm trong parent.subCategories
  for (const node of nodeMap.values()) {
    if (node.parentId && node.parentId.trim() !== '') {
      const parent = nodeMap.get(node.parentId.trim())
      if (parent) {
        if (!parent.subCategories.some((s) => s.id === node.id)) {
          parent.subCategories.push(node)
        }
      }
    }
  }

  // 3. Chỉ lấy các danh mục GỐC (parentId === null hoặc rỗng theo contract Category)
  // Duy trì thứ tự ban đầu của mảng rawCategories đối với các roots
  const seenRootIds = new Set<string>()
  const roots: Category[] = []

  for (const raw of rawCategories) {
    if (!raw || !raw.id) continue
    const node = nodeMap.get(raw.id)
    if (!node) continue

    const isRoot = !node.parentId || node.parentId.trim() === ''
    if (isRoot && !seenRootIds.has(node.id)) {
      seenRootIds.add(node.id)
      roots.push(node)
    }
  }

  return roots
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
  isLoadingCategories,
  categoriesError: propCategoriesError,
  onRetryCategories,
}) => {
  const isControlled = initialCategories !== undefined

  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([])
  const [internalLoadingCats, setInternalLoadingCats] = useState(
    !initialCategories || initialCategories.length === 0
  )
  const [internalCategoriesError, setInternalCategoriesError] = useState<Error | null>(null)
  const [categoriesRetryCount, setCategoriesRetryCount] = useState(0)

  const categories = isControlled ? initialCategories : fetchedCategories
  const isLoadingCats = isControlled ? (isLoadingCategories ?? false) : internalLoadingCats
  const categoriesError = isControlled ? (propCategoriesError ?? null) : internalCategoriesError

  // Danh mục GỐC (parentId === null) cho thanh list chính
  const rootCategories = useMemo(() => {
    return buildRootCategoriesTree(categories)
  }, [categories])

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [mobileExpandedCatId, setMobileExpandedCatId] = useState<string | null>(null)

  // Active root desktop được phân giải đồng bộ từ rootCategories trong render phase
  const activeCategory = activeCategoryId
    ? rootCategories.find((r) => r.id === activeCategoryId) ?? null
    : null

  // Coordinators riêng biệt cho Desktop và Mobile để không hủy request lẫn nhau
  const [desktopCoordinator] = useState(() => new ProductFilterOptionsCoordinator())
  const [mobileCoordinator] = useState(() => new ProductFilterOptionsCoordinator())

  // Flyout options state (desktop theo map từng categoryId để không bao giờ bị stale brands)
  const [desktopOptionsMap, setDesktopOptionsMap] = useState<
    Record<
      string,
      { data: ProductFilterOptionsResponse | null; isLoading: boolean; error: Error | null }
    >
  >({})
  const [desktopRetryCount, setDesktopRetryCount] = useState(0)

  const activeDesktopEntry = activeCategory ? desktopOptionsMap[activeCategory.id] : null
  const panelOptions = activeDesktopEntry?.data ?? null
  const isLoadingOptions = activeDesktopEntry?.isLoading ?? false
  const optionsError = activeDesktopEntry?.error ?? null

  // Mobile options state
  const [mobileBrandsMap, setMobileBrandsMap] = useState<
    Record<string, { brands: string[]; isLoading: boolean; error: Error | null }>
  >({})
  const [mobileRetryMap, setMobileRetryMap] = useState<Record<string, number>>({})

  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuContainerRef = useRef<HTMLDivElement | null>(null)

  // 1. Nạp categories nếu chưa có (chỉ chạy khi uncontrolled)
  useEffect(() => {
    if (isControlled) {
      return
    }

    let isMounted = true
    const controller = new AbortController()

    getCategories(controller.signal)
      .then((data) => {
        if (!isMounted) return
        setFetchedCategories(Array.isArray(data) ? data : [])
        setInternalCategoriesError(null)
      })
      .catch((err) => {
        if (!isMounted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setInternalCategoriesError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (isMounted) setInternalLoadingCats(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [isControlled, categoriesRetryCount])

  const handleRetryCategories = () => {
    if (isControlled && onRetryCategories) {
      onRetryCategories()
    } else {
      setInternalLoadingCats(true)
      setInternalCategoriesError(null)
      setCategoriesRetryCount((prev) => prev + 1)
    }
  }

  // 2. Nạp lazy filter options cho activeCategory (desktop)
  useEffect(() => {
    if (!activeCategory) return

    let isMounted = true
    const targetCat = activeCategory
    const scope = {
      componentType: targetCat.componentType,
      categoryId: targetCat.id,
    }

    desktopCoordinator.loadOptions(
      scope,
      (data) => {
        if (isMounted) {
          setDesktopOptionsMap((prev) => ({
            ...prev,
            [targetCat.id]: { data, isLoading: false, error: null },
          }))
        }
      },
      (err) => {
        if (isMounted) {
          setDesktopOptionsMap((prev) => ({
            ...prev,
            [targetCat.id]: { data: null, isLoading: false, error: err },
          }))
        }
      },
      (loading) => {
        if (isMounted) {
          setDesktopOptionsMap((prev) => ({
            ...prev,
            [targetCat.id]: {
              data: prev[targetCat.id]?.data ?? null,
              isLoading: loading,
              error: loading ? null : (prev[targetCat.id]?.error ?? null),
            },
          }))
        }
      }
    )

    return () => {
      isMounted = false
    }
  }, [activeCategory, desktopCoordinator, desktopRetryCount])

  const handleRetryDesktop = () => {
    if (!activeCategory) return
    desktopCoordinator.clearCache(
      desktopCoordinator.getScopeKey({
        componentType: activeCategory.componentType,
        categoryId: activeCategory.id,
      })
    )
    const catId = activeCategory.id
    setDesktopOptionsMap((prev) => {
      const copy = { ...prev }
      delete copy[catId]
      return copy
    })
    setDesktopRetryCount((prev) => prev + 1)
  }

  // 3. Nạp lazy filter options cho mobile category khi được mở (khắc phục self-invalidation)
  useEffect(() => {
    if (!mobileExpandedCatId) return
    const targetCat = rootCategories.find((c) => c.id === mobileExpandedCatId)
    if (!targetCat) return

    let isMounted = true
    const scope = {
      componentType: targetCat.componentType,
      categoryId: targetCat.id,
    }

    mobileCoordinator.loadOptions(
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
              brands: prev[targetCat.id]?.brands ?? [],
              isLoading: loading,
              error: loading ? null : (prev[targetCat.id]?.error ?? null),
            },
          }))
        }
      }
    )

    return () => {
      isMounted = false
    }
  }, [mobileExpandedCatId, rootCategories, mobileCoordinator, mobileRetryMap])

  const handleRetryMobile = (catId: string) => {
    const targetCat = rootCategories.find((c) => c.id === catId)
    if (targetCat) {
      mobileCoordinator.clearCache(
        mobileCoordinator.getScopeKey({
          componentType: targetCat.componentType,
          categoryId: targetCat.id,
        })
      )
    }
    setMobileBrandsMap((prev) => {
      const copy = { ...prev }
      delete copy[catId]
      return copy
    })
    setMobileRetryMap((prev) => ({
      ...prev,
      [catId]: (prev[catId] ?? 0) + 1,
    }))
  }

  // Mouse hover logic với vùng đệm chống mouseleave bất ngờ
  const handleMouseEnterRoot = (cat: Category) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = null
    }
    setActiveCategoryId(cat.id)
  }

  const handleMouseLeaveRootOrPanel = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      // Chỉ đóng khi focus không nằm trong panel
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(document.activeElement)
      ) {
        setActiveCategoryId(null)
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
        setActiveCategoryId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Helper render danh mục con nhiều tầng cho Desktop Flyout Panel
  const renderDesktopSubCategoryNode = (sub: Category, depth = 0): React.ReactNode => {
    const hasSubChildren = Array.isArray(sub.subCategories) && sub.subCategories.length > 0
    return (
      <div key={sub.id} className={depth > 0 ? 'pl-3 border-l border-slate-200 ml-2 my-1' : 'space-y-0.5'}>
        <Link
          to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
          className={`block py-1.5 px-2.5 rounded-lg text-xs hover:text-red-600 hover:bg-red-50/70 transition-colors truncate ${
            depth === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'
          }`}
        >
          {sub.name}
        </Link>
        {hasSubChildren && (
          <div className="space-y-0.5">
            {sub.subCategories.map((child) => renderDesktopSubCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Helper render danh mục con nhiều tầng cho Mobile Accordion
  const renderMobileSubCategoryNode = (sub: Category, depth = 0): React.ReactNode => {
    const hasSubChildren = Array.isArray(sub.subCategories) && sub.subCategories.length > 0
    return (
      <div key={sub.id} className={depth > 0 ? 'pl-3 border-l border-slate-200 ml-1.5 my-0.5' : ''}>
        <Link
          to={`/products?categoryId=${sub.id}&componentType=${sub.componentType}`}
          className={`block py-1 hover:text-red-600 truncate ${
            depth === 0 ? 'text-slate-700 font-medium' : 'text-slate-600 text-[11px]'
          }`}
        >
          {sub.name}
        </Link>
        {hasSubChildren && (
          <div className="space-y-0.5">
            {sub.subCategories.map((child) => renderMobileSubCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={menuContainerRef}
      onMouseLeave={handleMouseLeaveRootOrPanel}
      className="relative lg:static w-full bg-white rounded-3xl border border-slate-200/90 shadow-sm z-30"
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

        {categoriesError && (
          <div className="p-4 text-center space-y-2">
            <p className="text-xs text-rose-600 font-medium">Không thể nạp danh mục</p>
            <button
              type="button"
              onClick={handleRetryCategories}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        )}

        {!isLoadingCats && !categoriesError && rootCategories.length === 0 && (
          <div className="p-4 text-xs text-slate-400 italic text-center">
            Chưa có danh mục sản phẩm
          </div>
        )}

        {!isLoadingCats &&
          !categoriesError &&
          rootCategories.map((cat) => {
            const isHovered = activeCategory?.id === cat.id
            const isMobileExpanded = mobileExpandedCatId === cat.id
            const hasChildren = Array.isArray(cat.subCategories) && cat.subCategories.length > 0

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

                    {/* Danh mục con nếu có (hỗ trợ hiển thị phân cấp subtree) */}
                    {hasChildren && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Danh mục con:
                        </span>
                        <div className="space-y-1">
                          {cat.subCategories.map((sub) => renderMobileSubCategoryNode(sub, 0))}
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

                      {mobileBrandsMap[cat.id]?.error ? (
                        <div className="flex items-center justify-between p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px]">
                          <span>Không nạp được thương hiệu</span>
                          <button
                            type="button"
                            onClick={() => handleRetryMobile(cat.id)}
                            className="px-2 py-0.5 bg-red-600 text-white rounded font-bold hover:bg-red-700 transition-colors"
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : mobileBrandsMap[cat.id]?.brands &&
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

      {/* Mega Menu Panel bên phải trên Desktop: bám theo content container của HomePage */}
      {activeCategory && (
        <div
          id="desktop-category-flyout-panel"
          onMouseEnter={handleMouseEnterPanel}
          onMouseLeave={handleMouseLeaveRootOrPanel}
          className="hidden lg:flex flex-col absolute left-[calc(16rem+1.5rem)] right-0 top-0 max-h-[calc(100vh-160px)] min-h-[380px] bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-8 z-40 overflow-y-auto before:absolute before:-left-6 before:top-0 before:w-6 before:h-full before:content-[''] animate-in fade-in-50 zoom-in-95 duration-150"
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
            {/* 1. Danh mục con thật theo cây từ API (hỗ trợ phân cấp nhiều tầng con -> cháu) */}
            {activeCategory.subCategories && activeCategory.subCategories.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Danh Mục Con
                </h4>
                <div className="space-y-1 max-h-[360px] overflow-y-auto pr-2">
                  {activeCategory.subCategories.map((sub) => renderDesktopSubCategoryNode(sub, 0))}
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
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                  <span>Không nạp được danh sách thương hiệu.</span>
                  <button
                    type="button"
                    onClick={handleRetryDesktop}
                    className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700"
                  >
                    Thử lại
                  </button>
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
