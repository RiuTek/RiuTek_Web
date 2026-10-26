import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError, type PagedResult } from '../../lib/api'
import { getCategories, getProducts } from './productApi'
import {
  DEFAULT_PAGE_INDEX,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT_BY,
} from './productConstants'
import {
  ComponentType,
  ProductSortOption,
  type Category,
  type ProductFilterParams,
  type ProductSummary,
} from './productTypes'

export interface ParsedFilters {
  pageIndex: number
  pageSize: number
  searchTerm: string
  categoryId: string
  componentType: ComponentType | undefined
  brand: string
  minPrice: number | undefined
  maxPrice: number | undefined
  inStock: boolean | undefined
  isActive: boolean | undefined
  sortBy: ProductSortOption
}

const GUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

function parseStrictInt(raw: string | null): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed === '' || !/^-?\d+$/.test(trimmed)) return undefined
  const num = Number(trimmed)
  if (!Number.isSafeInteger(num)) return undefined
  return num
}

function parseStrictFloat(raw: string | null): number | undefined {
  if (raw === null || raw === undefined) return undefined
  const trimmed = raw.trim()
  if (trimmed === '' || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return undefined
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0) return undefined
  return num
}

function parseStrictGuid(raw: string | null): string {
  if (raw === null || raw === undefined) return ''
  const trimmed = raw.trim()
  return GUID_REGEX.test(trimmed) ? trimmed : ''
}

function parseFiltersFromSearchParams(searchParams: URLSearchParams): {
  filters: ParsedFilters
  priceError: string | null
} {
  const pageIndexParsed = parseStrictInt(searchParams.get('pageIndex'))
  const pageIndex =
    pageIndexParsed !== undefined && pageIndexParsed >= 1 && pageIndexParsed <= 2147483647
      ? pageIndexParsed
      : DEFAULT_PAGE_INDEX

  const pageSizeParsed = parseStrictInt(searchParams.get('pageSize'))
  const pageSize =
    pageSizeParsed !== undefined && pageSizeParsed >= 1 && pageSizeParsed <= 50
      ? pageSizeParsed
      : DEFAULT_PAGE_SIZE

  const sortByParsed = parseStrictInt(searchParams.get('sortBy'))
  const sortBy =
    sortByParsed !== undefined && sortByParsed >= 1 && sortByParsed <= 5
      ? (sortByParsed as ProductSortOption)
      : DEFAULT_SORT_BY

  const componentTypeParsed = parseStrictInt(searchParams.get('componentType'))
  const componentType =
    componentTypeParsed !== undefined && componentTypeParsed >= 1 && componentTypeParsed <= 9
      ? (componentTypeParsed as ComponentType)
      : undefined

  const searchTerm = (searchParams.get('searchTerm') ?? '').trim().slice(0, 100)
  const categoryId = parseStrictGuid(searchParams.get('categoryId'))
  const brand = (searchParams.get('brand') ?? '').trim().slice(0, 100)

  const minPrice = parseStrictFloat(searchParams.get('minPrice'))
  const maxPrice = parseStrictFloat(searchParams.get('maxPrice'))

  let priceError: string | null = null
  if (minPrice !== undefined && maxPrice !== undefined && maxPrice < minPrice) {
    priceError = 'Giá tối đa phải lớn hơn hoặc bằng giá tối thiểu.'
  }

  let inStock: boolean | undefined
  const inStockRaw = searchParams.get('inStock')
  if (inStockRaw === 'true') inStock = true
  else if (inStockRaw === 'false') inStock = false

  let isActive: boolean | undefined
  const isActiveRaw = searchParams.get('isActive')
  if (isActiveRaw === 'true') isActive = true
  else if (isActiveRaw === 'false') isActive = false

  return {
    filters: {
      pageIndex,
      pageSize,
      searchTerm,
      categoryId,
      componentType,
      brand,
      minPrice,
      maxPrice,
      inStock,
      isActive,
      sortBy,
    },
    priceError,
  }
}

export function useProductCatalog() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [categories, setCategories] = useState<Category[]>([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState<ApiError | Error | null>(null)

  const [pagedResult, setPagedResult] = useState<PagedResult<ProductSummary> | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [completedQueryKey, setCompletedQueryKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const { filters, priceError } = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams]
  )

  const queryKey = useMemo(() => {
    return JSON.stringify({ filters, retryTrigger })
  }, [filters, retryTrigger])

  const isLoading = !priceError && completedQueryKey !== queryKey

  // 1. Fetch Categories once on mount
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

  // 2. Fetch Products whenever filters or retryTrigger change
  const activeAbortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (priceError) {
      return
    }

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort()
    }

    const controller = new AbortController()
    activeAbortControllerRef.current = controller

    const queryFilters: ProductFilterParams = {
      pageIndex: filters.pageIndex,
      pageSize: filters.pageSize,
      searchTerm: filters.searchTerm || undefined,
      categoryId: filters.categoryId || undefined,
      componentType: filters.componentType,
      brand: filters.brand || undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      inStock: filters.inStock,
      isActive: filters.isActive,
      sortBy: filters.sortBy,
    }

    getProducts(queryFilters, controller.signal)
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
  }, [queryKey, priceError, filters])

  // Helper to update search params
  const updateFilters = useCallback(
    (newParams: Partial<Record<keyof ParsedFilters, string | number | boolean | undefined | null>>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)

        for (const [key, value] of Object.entries(newParams)) {
          if (value === undefined || value === null || value === '') {
            next.delete(key)
          } else {
            next.set(key, String(value))
          }
        }

        if (resetPage) {
          next.delete('pageIndex')
        }

        // Clean up default sortBy and pageSize to keep URL clean
        if (next.get('sortBy') === String(DEFAULT_SORT_BY)) {
          next.delete('sortBy')
        }
        if (next.get('pageSize') === String(DEFAULT_PAGE_SIZE)) {
          next.delete('pageSize')
        }

        return next
      })
    },
    [setSearchParams]
  )

  const setPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (page <= 1) {
          next.delete('pageIndex')
        } else {
          next.set('pageIndex', String(page))
        }
        return next
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

  return {
    products: pagedResult?.items ?? [],
    pagedResult,
    categories,
    isCategoriesLoading,
    categoriesError,
    isLoading,
    error,
    priceError,
    filters,
    updateFilters,
    setPage,
    resetFilters,
    retry,
  }
}
