import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ArrowRight,
  Flame,
} from 'lucide-react'
import type { Category } from '../features/products/productTypes'
import { getCategories } from '../features/products/productApi'
import { HomeCategoryMenu } from '../features/products/components/HomeCategoryMenu'
import { HomeBannerCarousel } from '../features/banners/components/HomeBannerCarousel'
import { HomeCategoryProductRows } from '../features/products/components/HomeCategoryProductRows'

export const HomePage: React.FC = () => {
  // Quản lý categories ở cấp HomePage để chia sẻ đồng bộ giữa Menu và các Rows sản phẩm
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState<Error | null>(null)
  const [categoriesRetryCount, setCategoriesRetryCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const controller = new AbortController()

    getCategories(controller.signal)
      .then((data) => {
        if (!isMounted) return
        setCategories(Array.isArray(data) ? data : [])
        setCategoriesError(null)
      })
      .catch((err: unknown) => {
        if (!isMounted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setCategoriesError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (isMounted) setIsLoadingCategories(false)
      })

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [categoriesRetryCount])

  const handleRetryCategories = useCallback(() => {
    setIsLoadingCategories(true)
    setCategoriesError(null)
    setCategoriesRetryCount((c) => c + 1)
  }, [])

  // Danh mục GỐC (parentId === null hoặc rỗng theo contract Category)
  const rootCategories = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) return []
    return categories.filter((cat) => !cat.parentId || cat.parentId.trim() === '')
  }, [categories])

  return (
    <div className="w-full flex flex-col space-y-12 sm:space-y-16 pb-16">
      {/* 1. HERO SECTION:
          Desktop: [Danh mục gốc ~256px] [Banner carousel lớn chiếm phần chính] [Dải tự chọn cấu hình gọn]
          Mobile/Tablet: Banner TRƯỚC khối danh mục
      */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
          {/* Menu Danh Mục Linh Kiện: Desktop ở cột trái (256px), Mobile hiển thị sau Banner (order-2) */}
          <div className="w-full lg:w-64 flex-shrink-0 order-2 lg:order-1">
            <HomeCategoryMenu
              initialCategories={categories}
              isLoadingCategories={isLoadingCategories}
              categoriesError={categoriesError}
              onRetryCategories={handleRetryCategories}
            />
          </div>

          {/* Vùng Phải trên Desktop: Banner Carousel lớn + dải Tự chọn cấu hình gọn */}
          <div className="w-full lg:flex-1 min-w-0 order-1 lg:order-2 flex flex-col gap-4">
            <HomeBannerCarousel />

            {/* Dải giới thiệu Tự chọn cấu hình gọn nằm ngay dưới Banner trên Desktop */}
            <div className="hidden lg:flex items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-red-100/70 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tự chọn cấu hình PC phù hợp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đối chiếu chuẩn socket, công suất nguồn và kích thước linh kiện trực quan.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0">
                <Link
                  to="/pc-builder"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Tự Chọn Cấu Hình</span>
                </Link>
                <Link
                  to="/products"
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
                >
                  <span>Linh Kiện</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Khối Giới Thiệu Tự Chọn Cấu Hình trên Mobile: hiển thị sau Menu (order-3) */}
          <div className="w-full block lg:hidden order-3 p-4 bg-white rounded-2xl border border-red-100/70 shadow-2xs">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Tự chọn cấu hình PC phù hợp</h3>
                <p className="text-[11px] text-slate-500">Đối chiếu chuẩn socket và công suất nguồn.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/pc-builder"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tự chọn cấu hình</span>
              </Link>
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-1 px-3.5 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200"
              >
                <span>Xem linh kiện</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. DÃY SẢN PHẨM THẬT THEO DANH MỤC GỐC TỪ BACKEND */}
      <HomeCategoryProductRows
        rootCategories={rootCategories}
        isLoadingCategories={isLoadingCategories}
        categoriesError={categoriesError}
        onRetryCategories={handleRetryCategories}
      />

      {/* 3. KHU VỰC GIỚI THIỆU TỰ CHỌN CẤU HÌNH GỌN GÀNG */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden border border-slate-800 shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800 rounded-full text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-red-500" />
              Tự Chọn Cấu Hình PC
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-4 text-white">
              Tự Tay Dựng Bộ Máy Tính Trong 3 Bước
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Chọn linh kiện trực quan, hệ thống tự động kiểm tra tương thích và tính toán công suất nguồn để bạn an tâm trước khi đặt mua.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 1</div>
              <h4 className="text-sm font-bold text-white mb-1">Chọn linh kiện</h4>
              <p className="text-xs text-slate-400">
                Thêm CPU, Mainboard, RAM, card đồ họa và các linh kiện cần thiết vào cấu hình.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 2</div>
              <h4 className="text-sm font-bold text-white mb-1">Xem giá &amp; tương thích</h4>
              <p className="text-xs text-slate-400">
                Xem tổng tiền tạm tính, ước tính công suất nguồn và kiểm tra các cảnh báo phần cứng.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl">
              <div className="text-xs text-red-400 font-bold mb-1 font-mono">BƯỚC 3</div>
              <h4 className="text-sm font-bold text-white mb-1">Lưu &amp; đặt hàng</h4>
              <p className="text-xs text-slate-400">
                Tải ảnh cấu hình dạng PNG về máy hoặc đăng nhập để lưu và thêm vào giỏ hàng.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400 font-mono">
              Hỗ trợ tùy chọn linh kiện linh hoạt theo ngân sách của bạn
            </div>
            <Link
              to="/pc-builder"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30"
            >
              <span>Tự chọn cấu hình ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
