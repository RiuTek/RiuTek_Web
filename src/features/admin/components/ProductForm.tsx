import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { getCategories } from '../../products/productApi'
import { COMPONENT_TYPE_LABELS } from '../../products/productConstants'
import { ComponentType, type ProductDetail } from '../../products/productTypes'
import { createProduct, updateProduct } from '../adminApi'
import { flattenCategoryTree } from '../adminCategoryHelper'
import { mapAdminApiError } from '../adminConstants'
import { executeWithAdminAuth } from '../adminGuardHelper'
import {
  applyConfirmedComponentTypeSwitch,
  computeProductFormIsDirty,
  createInitialProductFormDraft,
  executeProductFormSave,
  mapProductDetailToFormDraft,
  requestComponentTypeSwitch,
  shouldBlockDirtyProductNavigation,
} from '../adminProductHelper'
import type {
  AdminProductFormMode,
  FlattenedCategoryNode,
  ProductFormDraft,
} from '../adminTypes'
import { ProductMediaFields } from './ProductMediaFields'
import { ProductSpecificationFields } from './ProductSpecificationFields'

interface ProductFormProps {
  mode: AdminProductFormMode
  initialProduct?: ProductDetail | null
  isAdjustingStock?: boolean
  isSavingProduct: boolean
  onSavingProductChange: (saving: boolean) => void
  onProductSaved?: (savedProduct: ProductDetail) => void
}

const COMPONENT_TYPE_OPTIONS = Object.entries(COMPONENT_TYPE_LABELS).map(
  ([val, label]) => ({
    value: Number(val) as ComponentType,
    label,
  })
)

export const ProductForm: React.FC<ProductFormProps> = ({
  mode,
  initialProduct = null,
  isAdjustingStock = false,
  isSavingProduct,
  onSavingProductChange,
  onProductSaved,
}) => {
  const navigate = useNavigate()
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? null

  const [baselineDraft, setBaselineDraft] = useState<ProductFormDraft>(() =>
    initialProduct
      ? mapProductDetailToFormDraft(initialProduct)
      : createInitialProductFormDraft(ComponentType.CPU)
  )

  const [draft, setDraft] = useState<ProductFormDraft>(() =>
    initialProduct
      ? mapProductDetailToFormDraft(initialProduct)
      : createInitialProductFormDraft(ComponentType.CPU)
  )

  const [flatCategories, setFlatCategories] = useState<FlattenedCategoryNode[]>(
    []
  )
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(
    null
  )

  const [pendingComponentTypeSwitch, setPendingComponentTypeSwitch] =
    useState<ComponentType | null>(null)

  const mountedRef = useRef(true)
  const ownerIdRef = useRef<string | null>(ownerId)
  const productIdRef = useRef<string | undefined>(initialProduct?.id)
  const isSubmittingRef = useRef(false)
  const isSaveSuccessBypassRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    ownerIdRef.current = ownerId
    productIdRef.current = initialProduct?.id
    return () => {
      mountedRef.current = false
    }
  }, [ownerId, initialProduct?.id])

  const loadCategories = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve()
    if (!mountedRef.current) return
    setIsLoadingCategories(true)
    setCategoriesError(null)
    try {
      const tree = await getCategories(signal)
      if (!mountedRef.current) return
      const flattened = flattenCategoryTree(tree)
      setFlatCategories(flattened)
      setCategoriesLoaded(true)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      if (err instanceof Error && err.name === 'AbortError') return
      setCategoriesLoaded(false)
      setCategoriesError(
        mapAdminApiError(
          err,
          'Không thể tải cây danh mục linh kiện. Vui lòng tải lại trước khi lưu sản phẩm.'
        )
      )
    } finally {
      if (mountedRef.current) {
        setIsLoadingCategories(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => loadCategories(controller.signal))
    return () => {
      controller.abort()
    }
  }, [loadCategories])

  const compatibleCategories = useMemo(
    () =>
      flatCategories.filter((cat) => cat.componentType === draft.componentType),
    [flatCategories, draft.componentType]
  )

  const isDirty = useMemo(
    () => computeProductFormIsDirty(baselineDraft, draft, mode),
    [baselineDraft, draft, mode]
  )

  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    shouldBlockDirtyProductNavigation({
      isDirty,
      saveSuccessBypass: isSaveSuccessBypassRef.current,
      currentPathname: currentLocation.pathname,
      nextPathname: nextLocation.pathname,
    })
  )

  useEffect(() => {
    if (!isDirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isSaveSuccessBypassRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const handleComponentTypeSelect = (nextType: ComponentType) => {
    const decision = requestComponentTypeSwitch({
      currentDraft: draft,
      nextType,
      categories: flatCategories,
    })

    if (decision.requiresConfirmation) {
      setPendingComponentTypeSwitch(nextType)
      return
    }

    setDraft(decision.nextDraft)
    setValidationErrors({})
  }

  const handleConfirmTypeSwitch = () => {
    if (pendingComponentTypeSwitch === null) return
    const nextDraft = applyConfirmedComponentTypeSwitch({
      currentDraft: draft,
      nextType: pendingComponentTypeSwitch,
      categories: flatCategories,
    })
    setDraft(nextDraft)
    setPendingComponentTypeSwitch(null)
    setValidationErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmittingRef.current || isSavingProduct || isAdjustingStock) return

    const activeOwner = ownerIdRef.current
    const activeProductId = productIdRef.current
    const checkCurrent = () =>
      mountedRef.current &&
      ownerIdRef.current === activeOwner &&
      productIdRef.current === activeProductId

    isSubmittingRef.current = true
    setSaveSuccessMessage(null)

    try {
      await executeProductFormSave({
        mode,
        productId: initialProduct?.id,
        draft,
        categories: flatCategories,
        categoriesLoaded,
        isSavingProduct,
        isAdjustingStock,
        isContextCurrent: checkCurrent,
        createProduct: (payload) =>
          executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) => createProduct(payload, token),
          }),
        updateProduct: (id, payload) =>
          executeWithAdminAuth({
            authStatus,
            user,
            getAccessToken,
            isContextCurrent: checkCurrent,
            operation: (token) => updateProduct(id, payload, token),
          }),
        onValidationError: setValidationErrors,
        onSavingChange: onSavingProductChange,
        onApiError: setApiError,
        onSaveSuccess: (savedProduct) => {
          const updatedDraft = mapProductDetailToFormDraft(savedProduct)
          setBaselineDraft(updatedDraft)
          setDraft(updatedDraft)
          isSaveSuccessBypassRef.current = true

          if (mode === 'create') {
            navigate(`/admin/products/${savedProduct.id}/edit`, {
              replace: true,
              state: { justCreated: true },
            })
            return
          }

          isSaveSuccessBypassRef.current = false
          setSaveSuccessMessage('Đã lưu cập nhật thông tin sản phẩm thành công.')
          onProductSaved?.(savedProduct)
        },
      })
    } finally {
      isSubmittingRef.current = false
    }
  }

  const formDisabled = isSavingProduct || isAdjustingStock

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Banner lỗi danh mục nếu GET /categories thất bại */}
      {categoriesError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>{categoriesError}</span>
          </div>
          <button
            type="button"
            disabled={isLoadingCategories}
            onClick={() => void loadCategories()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white transition hover:bg-amber-800 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoadingCategories ? 'animate-spin' : ''}`}
            />
            Tải lại danh mục
          </button>
        </div>
      )}

      {/* Banner lỗi API hoặc thành công */}
      {apiError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="font-medium">{apiError}</div>
        </div>
      )}

      {saveSuccessMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="font-medium">{saveSuccessMessage}</div>
        </div>
      )}

      {/* Khối 1: Thông tin cơ bản & Phân loại */}
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Thông Tin Cơ Bản & Giá Bán
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Cấu hình tên sản phẩm, SKU, thương hiệu, phân loại linh kiện và mức giá niêm yết.
            </p>
          </div>
          {isDirty && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              Có thay đổi chưa lưu
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label
              htmlFor="product-name-input"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Tên sản phẩm <span className="text-rose-600">*</span>
            </label>
            <input
              id="product-name-input"
              type="text"
              maxLength={255}
              value={draft.name}
              disabled={formDisabled}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, name: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              placeholder="Ví dụ: CPU Intel Core i5-14600K (Up to 5.3GHz, 14 Nhân 20 Luồng, 24MB Cache, LGA1700)"
              className={`w-full rounded-lg border px-3.5 py-2 text-xs text-slate-900 transition outline-none ${
                validationErrors.name
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {validationErrors.name && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.name}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-sku-input"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Mã SKU <span className="text-rose-600">*</span>
            </label>
            <input
              id="product-sku-input"
              type="text"
              maxLength={100}
              value={draft.sku}
              disabled={formDisabled}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, sku: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              placeholder="Ví dụ: CPU-INTEL-14600K"
              className={`w-full rounded-lg border px-3.5 py-2 font-mono text-xs text-slate-900 transition outline-none ${
                validationErrors.sku
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {validationErrors.sku && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.sku}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-brand-input"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Thương hiệu (Brand) <span className="text-rose-600">*</span>
            </label>
            <input
              id="product-brand-input"
              type="text"
              maxLength={100}
              value={draft.brand}
              disabled={formDisabled}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, brand: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              placeholder="Ví dụ: Intel, ASUS, MSI, Corsair..."
              className={`w-full rounded-lg border px-3.5 py-2 text-xs text-slate-900 transition outline-none ${
                validationErrors.brand
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {validationErrors.brand && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.brand}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-component-type-select"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Loại linh kiện (ComponentType) <span className="text-rose-600">*</span>
            </label>
            <select
              id="product-component-type-select"
              value={draft.componentType}
              disabled={formDisabled}
              onChange={(e) =>
                handleComponentTypeSelect(Number(e.target.value) as ComponentType)
              }
              className={`w-full rounded-lg border px-3.5 py-2 text-xs text-slate-900 transition outline-none ${
                validationErrors.componentType
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            >
              {COMPONENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {validationErrors.componentType && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.componentType}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-category-select"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Danh mục sản phẩm <span className="text-rose-600">*</span>
            </label>
            <select
              id="product-category-select"
              value={draft.categoryId}
              disabled={formDisabled || isLoadingCategories}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, categoryId: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              className={`w-full rounded-lg border px-3.5 py-2 text-xs text-slate-900 transition outline-none ${
                validationErrors.categoryId
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            >
              <option value="">
                {isLoadingCategories
                  ? 'Đang tải danh mục...'
                  : compatibleCategories.length === 0
                    ? '-- Chưa có danh mục thuộc loại linh kiện này --'
                    : '-- Chọn danh mục --'}
              </option>
              {compatibleCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.pathNames.join(' / ')}
                </option>
              ))}
            </select>
            {validationErrors.categoryId && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.categoryId}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-price-input"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Giá bán hiện tại (VNĐ) <span className="text-rose-600">*</span>
            </label>
            <input
              id="product-price-input"
              type="number"
              min={1}
              step="any"
              value={draft.price}
              disabled={formDisabled}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, price: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              placeholder="Ví dụ: 7890000"
              className={`w-full rounded-lg border px-3.5 py-2 font-mono text-xs text-slate-900 transition outline-none ${
                validationErrors.price
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {validationErrors.price && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.price}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="product-original-price-input"
              className="mb-1 block text-xs font-bold text-slate-700"
            >
              Giá gốc niêm yết (VNĐ — Để trống nếu không giảm giá)
            </label>
            <input
              id="product-original-price-input"
              type="number"
              min={1}
              step="any"
              value={draft.originalPrice}
              disabled={formDisabled}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, originalPrice: e.target.value }))
                setSaveSuccessMessage(null)
              }}
              placeholder="Để trống hoặc nhập số >= giá bán hiện tại"
              className={`w-full rounded-lg border px-3.5 py-2 font-mono text-xs text-slate-900 transition outline-none ${
                validationErrors.originalPrice
                  ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-blue-600'
              } disabled:bg-slate-100`}
            />
            {validationErrors.originalPrice && (
              <p className="mt-1 text-xs font-medium text-rose-600">
                {validationErrors.originalPrice}
              </p>
            )}
          </div>

          {mode === 'create' ? (
            <div>
              <label
                htmlFor="product-initial-stock-input"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Số lượng tồn kho ban đầu <span className="text-rose-600">*</span>
              </label>
              <input
                id="product-initial-stock-input"
                type="number"
                min={0}
                step={1}
                value={draft.stockQuantity}
                disabled={formDisabled}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    stockQuantity: e.target.value,
                  }))
                }}
                placeholder="0"
                className={`w-full rounded-lg border px-3.5 py-2 font-mono text-xs text-slate-900 transition outline-none ${
                  validationErrors.stockQuantity
                    ? 'border-rose-400 bg-rose-50/30 focus:border-rose-600'
                    : 'border-slate-300 bg-white focus:border-blue-600'
                } disabled:bg-slate-100`}
              />
              {validationErrors.stockQuantity && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {validationErrors.stockQuantity}
                </p>
              )}
            </div>
          ) : (
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Trạng thái hiển thị trên cửa hàng (isActive)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Sản phẩm ngừng kinh doanh sẽ được ẩn khỏi danh sách mua hàng công khai và
                    PC Builder.
                  </span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    disabled={formDisabled}
                    onChange={(e) => {
                      setDraft((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                      setSaveSuccessMessage(null)
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      draft.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {draft.isActive
                      ? 'Đang kinh doanh (Active)'
                      : 'Ngừng kinh doanh / Đang ẩn'}
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Khối 2: Hình ảnh HTTPS URL */}
      <ProductMediaFields
        imageUrl={draft.imageUrl}
        additionalImages={draft.additionalImages}
        disabled={formDisabled}
        imageUrlError={validationErrors.imageUrl}
        additionalImagesError={validationErrors.additionalImages}
        onImageUrlChange={(url) => {
          setDraft((prev) => ({ ...prev, imageUrl: url }))
          setSaveSuccessMessage(null)
        }}
        onAdditionalImagesChange={(urls) => {
          setDraft((prev) => ({ ...prev, additionalImages: urls }))
          setSaveSuccessMessage(null)
        }}
      />

      {/* Khối 3: Thông số kỹ thuật theo ComponentType */}
      <ProductSpecificationFields
        componentType={draft.componentType}
        specDraft={draft.specDraft}
        disabled={formDisabled}
        errors={validationErrors}
        onChange={(nextSpecDraft) => {
          setDraft((prev) => ({ ...prev, specDraft: nextSpecDraft }))
          setSaveSuccessMessage(null)
        }}
      />

      {/* Thanh tác vụ Lưu / Quay lại */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <button
          type="button"
          onClick={() => navigate('/admin/products')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </button>

        <button
          type="submit"
          disabled={formDisabled || !categoriesLoaded}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSavingProduct ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === 'create' ? 'Tạo Sản Phẩm Mới' : 'Lưu Cập Nhật Sản Phẩm'}
        </button>
      </div>

      {/* Modal xác nhận đổi ComponentType khi đã nhập thông số */}
      {pendingComponentTypeSwitch !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Xác nhận đổi loại linh kiện?
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Bạn đang chuyển từ{' '}
                  <strong>{COMPONENT_TYPE_LABELS[draft.componentType]}</strong> sang{' '}
                  <strong>
                    {COMPONENT_TYPE_LABELS[pendingComponentTypeSwitch]}
                  </strong>
                  . Các thông số kỹ thuật đã nhập cho loại linh kiện hiện tại sẽ được đặt lại
                  để khớp với cấu trúc mới.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingComponentTypeSwitch(null)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Giữ nguyên
              </button>
              <button
                type="button"
                onClick={handleConfirmTypeSwitch}
                className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                Đồng ý chuyển đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận rời trang khi có thay đổi chưa lưu */}
      {blocker.state === 'blocked' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Rời trang khi chưa lưu thay đổi?
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  Biểu mẫu sản phẩm đang có thông tin chưa được lưu. Nếu rời khỏi trang lúc
                  này, các thay đổi vừa nhập sẽ bị mất.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => blocker.reset()}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Ở lại trang
              </button>
              <button
                type="button"
                onClick={() => blocker.proceed()}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Rời trang không lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
