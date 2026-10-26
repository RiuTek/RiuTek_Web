import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { getProductBySlug } from './productApi'
import type { ProductDetail } from './productTypes'

export function useProductDetail(slugParam?: string) {
  const routeParams = useParams<{ slug: string }>()
  const rawSlug = slugParam ?? routeParams.slug ?? ''
  const cleanSlug = rawSlug.trim()
  const isInvalidSlug = cleanSlug.length === 0 || cleanSlug.length > 255

  const [apiProduct, setApiProduct] = useState<ProductDetail | null>(null)
  const [apiError, setApiError] = useState<ApiError | Error | null>(null)
  const [isApiNotFound, setIsApiNotFound] = useState<boolean>(false)
  const [completedKey, setCompletedKey] = useState<string | null>(null)
  const [retryTrigger, setRetryTrigger] = useState(0)

  const activeControllerRef = useRef<AbortController | null>(null)

  const requestKey = useMemo(() => {
    return `${cleanSlug}|${retryTrigger}`
  }, [cleanSlug, retryTrigger])

  const isLoading = !isInvalidSlug && completedKey !== requestKey

  const invalidSlugError = useMemo(() => {
    return isInvalidSlug
      ? new ApiError({ message: 'Slug không hợp lệ', status: 400 })
      : null
  }, [isInvalidSlug])

  useEffect(() => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort()
    }

    if (isInvalidSlug) {
      return
    }

    const controller = new AbortController()
    activeControllerRef.current = controller

    getProductBySlug(cleanSlug, controller.signal)
      .then((data) => {
        setApiProduct(data)
        setApiError(null)
        setIsApiNotFound(false)
        setCompletedKey(requestKey)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.isAbortError) {
          return
        }
        setApiProduct(null)
        if (err instanceof ApiError && err.status === 404) {
          setIsApiNotFound(true)
        } else {
          setIsApiNotFound(false)
        }
        setApiError(err)
        setCompletedKey(requestKey)
      })

    return () => {
      controller.abort()
    }
  }, [cleanSlug, isInvalidSlug, requestKey])

  const retry = useCallback(() => {
    setRetryTrigger((prev) => prev + 1)
  }, [])

  return {
    product: isInvalidSlug ? null : apiProduct,
    isLoading,
    error: isInvalidSlug ? invalidSlugError : apiError,
    isNotFound: isInvalidSlug || isApiNotFound,
    retry,
  }
}
