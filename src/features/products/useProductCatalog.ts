import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, type PagedResult } from '../../lib/api'
import { getCategories, getProducts } from './productApi'
import {
  parseFiltersFromUrl,
  computeCanonicalQueryKey,
  inferComponentTypeFromCategory,
  buildProductFilterSearchParams,
  ProductFilterOptionsCoordinator,
  prepareProductQueryParams,
  prepareCatalogFilterUpdate,
  toggleArrayFilterChoice,
  type ParsedProductCatalogFilters,
} from './productFilterHelper'
import type {
  Category,
  ProductFilterOptionsResponse,
  ProductFilterParams,
  ProductSummary,
} from './productTypes'

export type ParsedFilters = ParsedProductCatalogFilters

// Singleton coordinator cho phép lưu cache trong phiên render của client
const optionsCoordinator = new ProductFilterOptionsCoordinator()

export function useProductCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Categories state
  const [categories, setCategories] = useState<Category[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<ApiError | Error | null>(null)
  const [categoriesRetryTrigger, setCategoriesRetryTrigger] = useState(0)

  // 2. Parse URL parameters với strict validation
  const { filters, priceError, overflowError, invalidCategoryError } = useMemo(
    () => parseFiltersFromUrl(searchParams),
    [searchParams]
  )

  // 3. Suy luận componentType từ categoryId (category quyết định type, ưu tiên hơn URL legacy)
  const effectiveComponentType = useMemo(() => {
    if (filters.categoryId && categories.length > 0) {
      const inferred = inferComponentTypeFromCategory(categories, filters.categoryId)
      if (inferred !== undefined) return inferred
    }
    return filters.componentType
  }, [filters.categoryId, filters.componentType, categories])

  // Trạng thái đang chờ nạp categories để xác định type cho category trong URL
  const isResolvingCategory = Boolean(
    filters.categoryId && isCategoriesLoading && !categoriesError
  )

  // Kiểm tra categoryId trong URL không tồn tại trong DB sau khi load xong (kể cả khi cây rỗng)
  const isCategoryNotFound = useMemo(() => {
    if (!filters.categoryId || isCategoriesLoading || categoriesError) return false
    const findCategory = (cats: Category[]): boolean => {
      for (const c of cats) {
        if (c.id === filters.categoryId) return true
        if (c.subCategories && c.subCategories.length > 0) {
          if (findCategory(c.subCategories)) return true
        }
      }
      return false
    }
    return !findCategory(categories)
  }, [filters.categoryId, isCategoriesLoading, categoriesError, categories])

  const categoryNotFoundError = isCategoryNotFound
    ? 'Danh mục đã chọn không tồn tại hoặc đã bị xóa.'
    : null

  // Scope bị khóa khi có lỗi validation hoặc categories lỗi/đang resolve
  const isScopeBlocked = Boolean(
    priceError ||
      overflowError ||
      invalidCategoryError ||
      categoryNotFoundError ||
      (filters.categoryId && categoriesError) ||
      isResolvingCategory
  )

  // 4. Products query state
  const [pagedResult, setPagedResult] = useState<PagedResult<ProductSummary> | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [completedQueryKey, setCompletedQueryKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)
  const requestIdRef = useRef(0)

  // Canonical query key để theo dõi sự thay đổi của filters (tính cả effectiveComponentType)
  const queryKey = useMemo(() => {
    return `${computeCanonicalQueryKey({ ...filters, componentType: effectiveComponentType })}:retry=${retryTrigger}`
  }, [filters, effectiveComponentType, retryTrigger])

  const isLoading = !isScopeBlocked && completedQueryKey !== queryKey

  // 5. Metadata filter options state
  const [filterOptions, setFilterOptions] = useState<ProductFilterOptionsResponse | null>(null)
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false)
  const [filterOptionsError, setFilterOptionsError] = useState<Error | null>(null)
  const [optionsRetryTrigger, setOptionsRetryTrigger] = useState(0)
  const [limitWarning, setLimitWarning] = useState<string | null>(null)

  // 6. Fetch Categories một lần lúc mount (có hỗ trợ retry)
  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    getCategories(controller.signal)
      .then((data) => {
        if (!isMounted) return
        setCategories(data)
        setCategoriesError(null)
      })
      .catch((err) => {
        if (!isMounted) return
        if (err instanceof ApiError && err.isAbortError) return
        setCategoriesError(err)
      })
      .finally(() => {
        if (!isMounted) return
        setIsCategoriesLoading(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [categoriesRetryTrigger])

  // 7. Load Metadata Options theo 4 scope params (có sequence & scope guard)
  useEffect(() => {
    if (isScopeBlocked) {
      return
    }

    const scopeParams = {
      componentType: effectiveComponentType,
      categoryId: filters.categoryId || undefined,
      isActive: filters.isActive,
      inStock: filters.inStock,
    }

    let isMounted = true

    optionsCoordinator.loadOptions(
      scopeParams,
      (data) => {
        if (isMounted) {
          setFilterOptions(data)
          setFilterOptionsError(null)
        }
      },
      (err) => {
        if (isMounted) {
          setFilterOptionsError(err)
        }
      },
      (loading) => {
        if (isMounted) {
          setIsFilterOptionsLoading(loading)
        }
      }
    )

    return () => {
      isMounted = false
    }
  }, [
    isScopeBlocked,
    effectiveComponentType,
    filters.categoryId,
    filters.isActive,
    filters.inStock,
    optionsRetryTrigger,
  ])

  // 8. Fetch Products khi filters thay đổi (có abort controller & sequence guard)
  const activeAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Nếu scope đang bị chặn bởi lỗi validation hoặc danh mục chưa sẵn sàng: hủy request cũ, giải phóng dữ liệu cũ
    if (isScopeBlocked) {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort()
        activeAbortControllerRef.current = null
      }
      requestIdRef.current++
      return
    }

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    activeAbortControllerRef.current = controller
    const currentReqId = ++requestIdRef.current

    // Chuẩn bị tham số request với componentType hiệu lực và technical filters đã làm sạch
    const queryParams = prepareProductQueryParams(filters, effectiveComponentType)

    getProducts(queryParams, controller.signal)
      .then((data) => {
        if (currentReqId !== requestIdRef.current) return
        setPagedResult(data)
        setError(null)
        setCompletedQueryKey(queryKey)
      })
      .catch((err) => {
        if (currentReqId !== requestIdRef.current) return
        if (err instanceof ApiError && err.isAbortError) {
          return
        }
        setError(err)
        setCompletedQueryKey(queryKey)
      })

    return () => {
      controller.abort()
    }
  }, [
    queryKey,
    isScopeBlocked,
    filters,
    effectiveComponentType,
  ])

  // Clear limit warning sau 3 giây
  useEffect(() => {
    if (!limitWarning) return
    const timer = setTimeout(() => {
      setLimitWarning(null)
    }, 3000)
    return () => clearTimeout(timer)
  }, [limitWarning])

  // 9. URL Navigation Helpers
  const updateFilters = useCallback(
    (newParams: Partial<ProductFilterParams>, resetPage = true) => {
      setSearchParams((prev) => {
        const currentParsed = parseFiltersFromUrl(prev).filters
        const merged = prepareCatalogFilterUpdate({
          currentFilters: currentParsed,
          newParams,
          categories,
          resetPage,
        })
        return buildProductFilterSearchParams(merged)
      })
    },
    [setSearchParams, categories]
  )

  const toggleFilterChoice = useCallback(
    (groupKey: string, value: string | number) => {
      const currentArray =
        (filters[groupKey as keyof ParsedProductCatalogFilters] as (string | number)[]) ?? []
      const result = toggleArrayFilterChoice(currentArray, value)
      if (result.isRejected) {
        setLimitWarning(result.warning)
        return
      }

      setSearchParams((prev) => {
        const currentParsed = parseFiltersFromUrl(prev).filters
        const merged: ProductFilterParams = {
          ...currentParsed,
          [groupKey]: result.nextValues,
          pageIndex: 1,
        }
        return buildProductFilterSearchParams(merged)
      })
    },
    [filters, setSearchParams]
  )

  const clearFilterGroup = useCallback(
    (groupKey: string) => {
      setSearchParams((prev) => {
        const currentParsed = parseFiltersFromUrl(prev).filters
        const merged: ProductFilterParams = {
          ...currentParsed,
          [groupKey]: [],
          pageIndex: 1,
        }
        return buildProductFilterSearchParams(merged)
      })
    },
    [setSearchParams]
  )

  const setPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => {
        const currentParsed = parseFiltersFromUrl(prev).filters
        const merged: ProductFilterParams = {
          ...currentParsed,
          pageIndex: page,
        }
        return buildProductFilterSearchParams(merged)
      })
    },
    [setSearchParams]
  )

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  const retryCategories = useCallback(() => {
    setIsCategoriesLoading(true)
    setCategoriesError(null)
    setCategoriesRetryTrigger((prev) => prev + 1)
  }, [])

  const retry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1)
  }, [])

  const retryFilterOptions = useCallback(() => {
    setOptionsRetryTrigger((prev) => prev + 1)
  }, [])

  const displayedPagedResult = isScopeBlocked ? null : pagedResult
  const displayedProducts = displayedPagedResult?.items ?? []

  return {
    products: displayedProducts,
    pagedResult: displayedPagedResult,
    categories,
    isCategoriesLoading,
    categoriesError,
    isResolvingCategory,
    isLoading,
    error: isScopeBlocked ? null : error,
    priceError,
    overflowError,
    invalidCategoryError,
    categoryNotFoundError,
    limitWarning,
    filters,
    effectiveComponentType,
    filterOptions: isScopeBlocked ? null : filterOptions,
    isFilterOptionsLoading: isScopeBlocked ? false : isFilterOptionsLoading,
    filterOptionsError: isScopeBlocked ? null : filterOptionsError,
    updateFilters,
    toggleFilterChoice,
    clearFilterGroup,
    setPage,
    resetFilters,
    retry,
    retryCategories,
    retryFilterOptions,
  }
}
