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

  // Kiểm tra categoryId trong URL không tồn tại trong DB sau khi load xong
  const isCategoryNotFound = useMemo(() => {
    if (!filters.categoryId || isCategoriesLoading || categories.length === 0) return false
    const inferred = inferComponentTypeFromCategory(categories, filters.categoryId)
    return inferred === undefined
  }, [filters.categoryId, isCategoriesLoading, categories])

  const categoryNotFoundError = isCategoryNotFound
    ? 'Danh mục đã chọn không tồn tại hoặc đã bị xóa.'
    : null

  // 4. Products query state
  const [pagedResult, setPagedResult] = useState<PagedResult<ProductSummary> | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [completedQueryKey, setCompletedQueryKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  // Canonical query key để theo dõi sự thay đổi của filters (tính cả effectiveComponentType)
  const queryKey = useMemo(() => {
    return `${computeCanonicalQueryKey({ ...filters, componentType: effectiveComponentType })}:retry=${retryTrigger}`
  }, [filters, effectiveComponentType, retryTrigger])

  const isLoading =
    !priceError &&
    !overflowError &&
    !invalidCategoryError &&
    !categoryNotFoundError &&
    !(filters.categoryId && isCategoriesLoading) &&
    completedQueryKey !== queryKey

  // 5. Metadata filter options state
  const [filterOptions, setFilterOptions] = useState<ProductFilterOptionsResponse | null>(null)
  const [isFilterOptionsLoading, setIsFilterOptionsLoading] = useState(false)
  const [filterOptionsError, setFilterOptionsError] = useState<Error | null>(null)
  const [optionsRetryTrigger, setOptionsRetryTrigger] = useState(0)
  const [limitWarning, setLimitWarning] = useState<string | null>(null)

  // 6. Fetch Categories một lần lúc mount
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
  }, [])

  // 7. Load Metadata Options theo 4 scope params (có sequence & scope guard)
  useEffect(() => {
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
    effectiveComponentType,
    filters.categoryId,
    filters.isActive,
    filters.inStock,
    optionsRetryTrigger,
  ])

  // 8. Fetch Products khi filters thay đổi (có abort controller)
  const activeAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Không gửi request nếu có lỗi validation hoặc categoryId đang chờ categories nạp để resolve type
    if (
      priceError ||
      overflowError ||
      invalidCategoryError ||
      categoryNotFoundError ||
      (filters.categoryId && isCategoriesLoading)
    ) {
      return
    }

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    activeAbortControllerRef.current = controller

    // Chuẩn bị tham số request với componentType hiệu lực và technical filters đã làm sạch
    const queryParams = prepareProductQueryParams(filters, effectiveComponentType)

    getProducts(queryParams, controller.signal)
      .then((data) => {
        setPagedResult(data)
        setError(null)
        setCompletedQueryKey(queryKey)
      })
      .catch((err) => {
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
    priceError,
    overflowError,
    invalidCategoryError,
    categoryNotFoundError,
    filters,
    effectiveComponentType,
    isCategoriesLoading,
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

  const retry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1)
  }, [])

  const retryFilterOptions = useCallback(() => {
    setOptionsRetryTrigger((prev) => prev + 1)
  }, [])

  return {
    products: pagedResult?.items ?? [],
    pagedResult,
    categories,
    isCategoriesLoading,
    categoriesError,
    isLoading,
    error,
    priceError,
    overflowError,
    invalidCategoryError,
    categoryNotFoundError,
    limitWarning,
    filters,
    effectiveComponentType,
    filterOptions,
    isFilterOptionsLoading,
    filterOptionsError,
    updateFilters,
    toggleFilterChoice,
    clearFilterGroup,
    setPage,
    resetFilters,
    retry,
    retryFilterOptions,
  }
}
