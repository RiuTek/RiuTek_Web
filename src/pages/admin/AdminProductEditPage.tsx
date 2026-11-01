import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { getAdminProductById, isValidUuid } from '../../features/admin/adminApi'
import { mapAdminApiError } from '../../features/admin/adminConstants'
import { executeWithAdminAuth } from '../../features/admin/adminGuardHelper'
import { ProductForm } from '../../features/admin/components/ProductForm'
import { ProductStockSection } from '../../features/admin/components/ProductStockSection'
import type { ProductDetail } from '../../features/products/productTypes'

export const AdminProductEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { status: authStatus, user, getAccessToken } = useAuth()
  const ownerId = user?.id ?? null

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [expectedStockQuantity, setExpectedStockQuantity] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const [isAdjustingStock, setIsAdjustingStock] = useState(false)

  const justCreated = Boolean(
    (location.state as { justCreated?: boolean } | null)?.justCreated
  )

  const mountedRef = useRef(true)
  const ownerIdRef = useRef<string | null>(ownerId)
  const productIdRef = useRef<string | null>(id ?? null)
  const detailSeqRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    ownerIdRef.current = ownerId
    productIdRef.current = id ?? null
    return () => {
      mountedRef.current = false
      detailSeqRef.current += 1
    }
  }, [ownerId, id])

  const fetchProductDetail = useCallback(
    async (signal?: AbortSignal) => {
      const seq = ++detailSeqRef.current
      const activeOwner = ownerIdRef.current
      const activeProduct = productIdRef.current
      const isTicketCurrent = () =>
        mountedRef.current &&
        detailSeqRef.current === seq &&
        ownerIdRef.current === activeOwner &&
        productIdRef.current === activeProduct

      await Promise.resolve()
      if (!isTicketCurrent()) return

      if (!id || !isValidUuid(id)) {
        setLoadError('Id sản phẩm trên đường dẫn không hợp lệ.')
        setIsLoading(false)
        setProduct(null)
        return
      }

      setIsLoading(true)
      setLoadError(null)

      try {
        const detail = await executeWithAdminAuth({
          authStatus,
          user,
          getAccessToken,
          isContextCurrent: isTicketCurrent,
          operation: (token) => getAdminProductById(id, token, signal),
        })

        if (!isTicketCurrent()) return
        setProduct(detail)
        setExpectedStockQuantity(detail.stockQuantity)
      } catch (err: unknown) {
        if (!isTicketCurrent()) return
        if (err instanceof Error && err.name === 'AbortError') return
        setProduct(null)
        setLoadError(
          mapAdminApiError(
            err,
            'Không thể tải thông tin chi tiết sản phẩm. Vui lòng thử lại.'
          )
        )
      } finally {
        if (isTicketCurrent()) {
          setIsLoading(false)
        }
      }
    },
    [id, authStatus, user, getAccessToken]
  )

  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(() => fetchProductDetail(controller.signal))
    return () => controller.abort()
  }, [fetchProductDetail])

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-xs text-slate-600">
        <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
        <p className="font-medium">Đang tải thông tin sản phẩm quản trị...</p>
      </div>
    )
  }

  if (loadError || !product) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-8 text-center shadow-xs">
        <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
        <h2 className="mt-3 text-base font-bold text-slate-900">
          Không thể mở sản phẩm
        </h2>
        <p className="mt-1.5 text-xs text-slate-600">
          {loadError ?? 'Sản phẩm không tồn tại hoặc đã bị xóa.'}
        </p>
        <div className="mt-5 flex justify-center gap-2.5">
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Về danh sách sản phẩm
          </Link>
          <button
            type="button"
            onClick={() => void fetchProductDetail()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  const formKey = `${product.id}:${ownerId ?? 'anon'}`

  return (
    <div className="space-y-8">
      {/* Header trang */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/products"
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Danh sách sản phẩm
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
              Chỉnh Sửa Sản Phẩm & Tồn Kho
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                product.isActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {product.isActive ? 'Đang bán (Active)' : 'Đang ẩn (Inactive)'}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500">
            ID: {product.id} • SKU: <strong>{product.sku}</strong>
          </p>
        </div>

        {product.isActive && (
          <Link
            to={`/products/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Xem trên cửa hàng
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {justCreated && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="font-medium">
            Đã tạo sản phẩm mới thành công. Bạn có thể tiếp tục cập nhật thông tin hoặc kiểm
            tra lịch sử tồn kho bên dưới.
          </div>
        </div>
      )}

      {/* Phần 1: Form cập nhật thông tin sản phẩm (PUT /products/{id}) */}
      <ProductForm
        key={formKey}
        mode="edit"
        initialProduct={product}
        isAdjustingStock={isAdjustingStock}
        isSavingProduct={isSavingProduct}
        onSavingProductChange={setIsSavingProduct}
        onProductSaved={(saved) => {
          setProduct(saved)
          setExpectedStockQuantity(saved.stockQuantity)
        }}
      />

      {/* Phần 2: Điều chỉnh tồn kho & Lịch sử biến động kho tách biệt */}
      <ProductStockSection
        key={`stock-${formKey}`}
        productId={product.id}
        sku={product.sku}
        expectedStockQuantity={expectedStockQuantity}
        isSavingProduct={isSavingProduct}
        isAdjustingStock={isAdjustingStock}
        onAdjustingStockChange={setIsAdjustingStock}
        onExpectedStockQuantityChange={setExpectedStockQuantity}
      />
    </div>
  )
}
